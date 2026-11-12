import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { verifyPassword, dummyHash } from "@/lib/password";
import { loginSchema } from "@/lib/validators/auth";
import { clientIpFromHeaders } from "@/lib/login-throttle";
import { env } from "@/lib/env";
import {
  checkLoginAttempt,
  claimFailedLoginAlert,
  recordSuccessfulLogin,
} from "@/server/services/login-attempts";
import { isSessionRevoked } from "@/server/services/sessions";
import { verifySecondFactor } from "@/server/services/two-factor";
import { sendFailedLoginAlertEmail } from "@/lib/email";
import type { Role } from "@prisma/client";

// How often a signed-in user's account state (active, roles, password change)
// is re-read from the database. A deactivated or demoted account therefore
// loses access within this long; shorter means faster, at one small query per
// signed-in user per interval.
export const ROLES_RECHECK_INTERVAL_MS = 60 * 1000;

// A session lasts 12 hours from sign-in, then the person must sign in again.
// It is not extended while they work: the proxy only reads the cookie (see
// src/proxy.ts), so nothing but signing in ever issues one.
export const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

/**
 * Thrown from the credentials check when a sign-in attempt is over the rate
 * limit. It is a CredentialsSignin so Auth.js treats it as a failed sign-in
 * (no session, no detail leaked to the browser except this code).
 */
export class RateLimitedSignin extends CredentialsSignin {
  code = "rate_limited";
}

/** The password was right and this account needs a second-factor code. */
export class TotpRequiredSignin extends CredentialsSignin {
  code = "totp_required";
}

/** The second-factor code was missing its match. */
export class TotpInvalidSignin extends CredentialsSignin {
  code = "totp_invalid";
}

type RolesToken = {
  id?: string;
  sid?: string;
  roles?: Role[];
  isActive?: boolean;
  rolesCheckedAt?: number;
  passwordChangedAt?: number | null;
};

/**
 * Re-reads isActive/roles from the database at most once per
 * ROLES_RECHECK_INTERVAL_MS. Exported standalone (rather than left
 * inline in the jwt callback) so the recheck gate itself — not just
 * its end-to-end effect — has a direct unit test.
 *
 * Also compares the user's current passwordChangedAt against the value
 * stamped into the token at login: a changed password marks the token
 * inactive on its next recheck, which invalidates other sessions within
 * ROLES_RECHECK_INTERVAL_MS (there is no server-side session store for a
 * JWT strategy, so this is the best-effort invalidation that is feasible
 * here, not an instant one).
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

  const dbPasswordChangedAt = dbUser?.passwordChangedAt?.getTime() ?? null;
  const passwordChanged =
    token.passwordChangedAt != null && dbPasswordChangedAt !== token.passwordChangedAt;

  return {
    ...token,
    isActive: passwordChanged ? false : dbUser?.isActive ?? false,
    roles: dbUser ? dbUser.roles.map((r) => r.role) : [],
    rolesCheckedAt: Date.now(),
  };
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SECONDS },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        totp: {},
      },
      async authorize(credentials, request) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Throttle here, not only in the login form's server action: the
        // /api/auth/callback/credentials endpoint reaches this code too, and
        // a limit that only the form enforces can be walked around.
        if (!(await checkLoginAttempt(db, clientIpFromHeaders(request?.headers), email)).allowed) {
          throw new RateLimitedSignin();
        }

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
          // Warn the owner after repeated failures. Never let this change what
          // the visitor sees or how long it takes.
          void claimFailedLoginAlert(db, email)
            .then((owner) => (owner ? sendFailedLoginAlertEmail({ to: owner.email, name: owner.name }) : undefined))
            .catch((error) => console.error("Failed-sign-in alert failed:", error));
          return null;
        }

        // Second factor, for accounts that have turned it on. Reached only
        // with the right password, and counted by the same attempt limit.
        if (user.totpEnabledAt) {
          const supplied = typeof credentials?.totp === "string" ? credentials.totp.trim() : "";
          if (!supplied) throw new TotpRequiredSignin();
          const codeOk = await verifySecondFactor(db, user.id, supplied, env.AUTH_SECRET);
          if (!codeOk) throw new TotpInvalidSignin();
        }

        await recordSuccessfulLogin(db, email);

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role),
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        // An identifier for this one sign-in, so it can be ended on the server.
        token.sid = crypto.randomUUID();
        token.sessionExpiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
        token.roles = (user as { roles: Role[] }).roles;
        token.isActive = true;
        token.rolesCheckedAt = Date.now();
        token.passwordChangedAt = (user as unknown as { passwordChangedAt: number | null }).passwordChangedAt;
        return token;
      }

      // Signed out (or revoked) on the server: this cookie is dead even though
      // its signature is still valid.
      if (await isSessionRevoked(db, token.sid as string | undefined)) {
        return { ...token, isActive: false, roles: [] };
      }

      const refreshed = await refreshTokenRoles(token as RolesToken, db);
      return { ...token, ...refreshed };
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.roles = (token.roles as Role[]) ?? [];
      session.user.isActive = (token.isActive as boolean) ?? false;
      session.sessionId = token.sid as string | undefined;
      session.sessionExpiresAt = token.sessionExpiresAt as number | undefined;
      return session;
    },
  },
});
