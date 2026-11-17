import NextAuth, { CredentialsSignin, type Session } from "next-auth";
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
import { relyingPartyFor, verifyLogin } from "@/server/services/passkeys";
import { checkPersistentLimit } from "@/server/services/rate-limits";
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

const nextAuth = NextAuth({
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
          if (!codeOk) {
            void claimFailedLoginAlert(db, email)
              .then((owner) => (owner ? sendFailedLoginAlertEmail({ to: owner.email, name: owner.name }) : undefined))
              .catch((error) => console.error("Failed-sign-in alert failed:", error));
            throw new TotpInvalidSignin();
          }
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
          // A password alone is one factor; a password with a verified code is two.
          strong: Boolean(user.totpEnabledAt),
        };
      },
    }),
    // Signing in with a passkey: a fingerprint, face or device PIN on a device
    // the person registered. Phishing-resistant and strong on its own.
    Credentials({
      id: "passkey",
      credentials: { challengeId: {}, response: {} },
      async authorize(credentials, request) {
        const challengeId = typeof credentials?.challengeId === "string" ? credentials.challengeId : "";
        const raw = typeof credentials?.response === "string" ? credentials.response : "";
        if (!challengeId || !raw || raw.length > 20_000) return null;

        const ip = clientIpFromHeaders(request?.headers);
        const limit = await checkPersistentLimit(db, { name: "passkey-login", key: ip, limit: 20, windowMs: 60_000 });
        if (!limit.allowed) throw new RateLimitedSignin();

        let response;
        try {
          response = JSON.parse(raw);
        } catch {
          return null;
        }
        const verified = await verifyLogin(db, { challengeId, response }, relyingPartyFor(env.AUTH_URL));
        if (!verified) return null;

        const user = await db.user.findUnique({ where: { id: verified.userId }, include: { roles: true } });
        if (!user || !user.isActive) return null;

        await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles.map((r) => r.role),
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? null,
          strong: true,
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
        token.strong = (user as unknown as { strong?: boolean }).strong === true;
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
      session.strong = token.strong === true;
      session.sessionId = token.sid as string | undefined;
      session.sessionExpiresAt = token.sessionExpiresAt as number | undefined;
      return session;
    },
  },
});

export const { handlers, signIn, signOut } = nextAuth;

/**
 * The current session, or null. A session whose account has been
 * deactivated, whose password changed since it began, or that was signed out
 * on the server comes back as null, exactly like no session at all. Without
 * this, a page that only asked "is there a session?" would keep working for a
 * cookie that has been revoked.
 */
export async function auth(): Promise<Session | null> {
  const session = await nextAuth.auth();
  if (!session?.user || session.user.isActive !== true) return null;
  return session;
}

