import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword, dummyHash } from "@/lib/password";
import { loginSchema } from "@/lib/validators/auth";
import type { Role } from "@prisma/client";

export const ROLES_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

type RolesToken = {
  id?: string;
  roles?: Role[];
  isActive?: boolean;
  rolesCheckedAt?: number;
};

/**
 * Re-reads isActive/roles from the database at most once per
 * ROLES_RECHECK_INTERVAL_MS. Exported standalone (rather than left
 * inline in the jwt callback) so the recheck gate itself — not just
 * its end-to-end effect — has a direct unit test.
 */
export async function refreshTokenRoles(
  token: RolesToken,
  dbClient: typeof db,
): Promise<RolesToken> {
  const lastChecked = token.rolesCheckedAt ?? 0;
  if (Date.now() - lastChecked < ROLES_RECHECK_INTERVAL_MS) {
    return token;
  }

  const dbUser = token.id
    ? await dbClient.user.findUnique({
        where: { id: token.id },
        include: { roles: true },
      })
    : null;

  return {
    ...token,
    isActive: dbUser?.isActive ?? false,
    roles: dbUser ? dbUser.roles.map((r) => r.role) : [],
    rolesCheckedAt: Date.now(),
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.user.findUnique({
          where: { email },
          include: { roles: true },
        });

        // Run a real hash verification even when there is no user, so
        // this path takes about as long as the wrong-password path
        // (login timing parity; not a cryptographic guarantee).
        const hashToCheck = user?.passwordHash ?? dummyHash;
        const passwordOk = await verifyPassword(hashToCheck, password);

        if (!user || !user.isActive || !user.passwordHash || !passwordOk) {
          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.roles = (user as { roles: Role[] }).roles;
        token.isActive = true;
        token.rolesCheckedAt = Date.now();
        return token;
      }

      const refreshed = await refreshTokenRoles(token as RolesToken, db);
      return { ...token, ...refreshed };
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = (token.roles as Role[]) ?? [];
      session.user.isActive = (token.isActive as boolean) ?? false;
      return session;
    },
  },
});
