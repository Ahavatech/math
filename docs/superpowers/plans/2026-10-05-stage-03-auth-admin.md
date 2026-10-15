# Stage 03: Auth and Admin Shell — Implementation Plan

**Goal:** Auth.js v5 Credentials+JWT auth, RBAC, invite/reset token flows by email, admin shell with users manager. No schema changes needed — User/UserRole/UserToken/AuditLog already cover everything (verified against docs/DATA-MODEL.md).

**Spec:** docs/prompts/03-auth-admin.md (full detail, not retyped here).

**Stack additions:** `next-auth@beta` (v5), `@node-rs/argon2`, `resend`, `react-email` + `@react-email/components`, shadcn components (button, input, label, card, table, badge, select, dialog, dropdown-menu, sonner, avatar, separator).

**Review focus:**
- A deactivated user's existing session must stop working within 5 minutes (jwt callback re-check), not just at next login.
- Token reuse: consuming a token twice, or using an expired/invalidated-by-newer-token token, must fail — tested against a real database.
- `/login` must look identical (timing + message) for "no such user" and "wrong password" — dummy hash on the no-user path.
- A SUPER_ADMIN cannot deactivate or de-role themselves via the users admin UI (server-enforced, not just hidden button).
- Every admin mutation writes AuditLog with no password/token/full-email leakage into `summary`.

## Tasks

1. **Dependencies + env** — install packages above; update src/lib/env.ts (AUTH_SECRET/AUTH_URL/EMAIL_FROM required now, RESEND_API_KEY required when NODE_ENV=production); install shadcn components.
2. **Password hashing (TDD)** — src/lib/password.ts (hash/verify via @node-rs/argon2, dummyHash for timing parity); tests first.
3. **Tokens service (TDD)** — src/server/services/tokens.ts (issue/consume for INVITE 7d / PASSWORD_RESET 1h, sha256-hash-only storage, single-use, newer token invalidates older unused ones of same type+user); tests against TEST_DATABASE_URL in tests/unit/database/ pattern (skip-if-no-db).
4. **RBAC (TDD)** — src/lib/rbac.ts (permission matrix + getCurrentUser/requireUser/requireRole/requirePermission/canEditLecturerProfile); exhaustive matrix tests, no DB needed (pure functions + mocked session).
5. **Rate limiting (TDD)** — src/lib/rate-limit.ts (in-memory sliding window, interface-based); tests for window behavior.
6. **Validators** — src/lib/validators/auth.ts (zod schemas: login, acceptInvite, forgotPassword, resetPassword, inviteUser, editUserRoles).
7. **Auth.js wiring** — src/auth.ts (NextAuth config: Credentials provider, jwt session, jwt/session callbacks with 5-min DB recheck), src/proxy.ts (coarse route protection for /admin, /journal/dashboard).
8. **Audit service** — src/server/services/audit.ts (log(actor, action, entityType, entityId, summary, req) — ip/userAgent from request headers).
9. **Email** — src/lib/email.ts (Resend wrapper, console-fallback only when NODE_ENV!==production and no RESEND_API_KEY), src/emails/invite.tsx + password-reset.tsx (React Email).
10. **User service** — src/server/services/users.ts (inviteUser, editRoles, deactivate, reactivate, resendInvite — each audit-logged, self-protection checks).
11. **Server actions + pages** — /login, /accept-invite/[token], /forgot-password, /reset-password/[token], logout; /admin layout+dashboard, /admin/users (SUPER_ADMIN only); /403, not-found.
12. **Hardening** — next.config.ts security headers.
13. **First admin script** — scripts/admin-invite.ts + `admin:invite` npm script (refuses in production).
14. **Docs** — docs/AUTH.md; docs/DECISIONS.md additions.
15. **Verify** — lint/typecheck/test/build; manual flow walkthrough; `/security-review`; AUDIT.md entry + ROADMAP tick.
