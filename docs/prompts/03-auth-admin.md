Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 03. Save this exact prompt as docs/prompts/03-auth-admin.md.

PRE-CHECK
- Stage 02 must be merged into main and main must be up to date. If not, stop and tell me.
- DATABASE_URL, TEST_DATABASE_URL, AUTH_SECRET, AUTH_URL, RESEND_API_KEY and EMAIL_FROM must be set in .env. If any is missing, stop and tell me which. Never print their values.
- Then create branch stage/03-auth-admin from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for rbac, tokens, password handling, rate limiting and services. Do not reopen decisions in DECISIONS.md. If something below conflicts with the schema, record a deviation instead of silently changing the schema. Run /security-review at the end and fix every real finding.

GOAL
Working authentication, role-based access, the invite and password reset flows by email, and a functional admin shell with a users manager. No public site work and no design polish, this is the foundation every later stage depends on.

1. AUTH.JS
- Install Auth.js v5 (next-auth beta) and use the Credentials provider with the JWT session strategy. No database session tables, per DECISIONS.md.
- Hash passwords with argon2id (@node-rs/argon2). If it fails to build, fall back to bcryptjs and record it as a deviation.
- Session carries user id and roles. Deactivated users must lose access quickly: re-check isActive and roles from the database in the jwt callback at most every 5 minutes, and always inside requireRole and requirePermission for mutations and private reads.
- Use the proxy or middleware convention of the installed Next.js version for coarse route protection (session present on /admin and /journal/dashboard). Real authorisation happens on the server in the service layer, never only in the proxy.
- Session cookies must be httpOnly, sameSite lax, and secure in production. Document what is needed behind Nginx (trusted host, AUTH_URL).

2. RBAC
- src/lib/rbac.ts: a permission matrix mapping the roles from SCOPE.md to named permissions (for example users.manage, site.edit, lecturers.manage, news.manage, events.manage, alumni.review, journal.edit, journal.review, journal.submit, own_profile.edit).
- Helpers: getCurrentUser, requireUser, requireRole, requirePermission, canEditLecturerProfile(user, profile) with an ownership check.
- A user can hold several roles. Tests must cover the whole matrix, one case per role and permission, plus ownership.

3. TOKENS
- src/server/services/tokens.ts for INVITE (7 days) and PASSWORD_RESET (1 hour).
- 32 random bytes, base64url, shown once. Store only a sha256 hash. Single use. Creating a new token invalidates earlier unused tokens of the same type for that user.
- Tests: only the hash is stored, expired and used tokens are rejected, reuse is rejected, a new token invalidates the old one.

4. FLOWS
- /login: generic error message that never reveals whether the email exists. Inactive users cannot sign in. Update lastLoginAt.
- /accept-invite/[token]: set password (minimum 10 characters), mark token used, then send the user to login.
- /forgot-password: always shows the same message whether or not the email exists, and sends a reset link only if the user exists and is active.
- /reset-password/[token]: set a new password, mark token used.
- Logout.
- Rate limiting on login, forgot-password and accept/reset: src/lib/rate-limit.ts, in-memory sliding window by IP and by email, behind an interface so it can be swapped for a shared store later. Record the single-instance limitation in DECISIONS.md.
- Validate every input with zod schemas in src/lib/validators.

5. EMAIL
- src/lib/email.ts wraps Resend. Templates in src/emails/ built with React Email: invite and password reset. Plain, warm, short, no em dashes. Links use AUTH_URL.
- In development with no RESEND_API_KEY, print the email to the console instead of sending. This fallback must be impossible in production.
- Update src/lib/env.ts: AUTH_SECRET, AUTH_URL, EMAIL_FROM required now. RESEND_API_KEY required when NODE_ENV is production.

6. ADMIN SHELL
- /admin layout: sidebar and top bar, using shadcn components, functional and clean (the design pass comes in Stage 04). The sidebar lists sections the current role may see. Sections for later stages appear as disabled "coming soon" items.
- /admin dashboard: simple cards with counts read from the database (users, lecturers, pending alumni, upcoming events). Zero is fine.
- /admin/users, restricted to SUPER_ADMIN: list users with roles and status; invite a user with one or more roles; edit roles; deactivate and reactivate; resend invite. A SUPER_ADMIN cannot remove their own SUPER_ADMIN role or deactivate themselves.
- Every user action writes an AuditLog entry through a service (actor, action, entity, summary, ip, user agent). Never log passwords, tokens or full emails in the summary.
- Unauthorised access shows a clean 403 page. Unknown routes show 404.

7. FIRST ADMIN
- Add npm script admin:invite that creates an invite for SEED_ADMIN_EMAIL and prints the invite URL in the terminal. It must refuse to run when NODE_ENV is production.

8. HARDENING
- Add baseline security headers in the Next.js config: X-Content-Type-Options, Referrer-Policy, X-Frame-Options (or frame-ancestors), Permissions-Policy. Leave CSP for Stage 14 and note it in the roadmap.
- Constant-time handling is not needed for hash lookups, but make login timing similar for unknown email and wrong password (run a dummy hash).

9. DOCS
- docs/AUTH.md: flows, token rules, the permission matrix as a table, session behaviour, deployment notes.
- Add decisions to docs/DECISIONS.md: argon2id, JWT with database recheck, in-memory rate limit, Resend development fallback, users page is SUPER_ADMIN only.

10. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each result: run admin:invite, accept the invite, log in, reach /admin, confirm a user with only the LECTURER role gets a 403 on /admin/users, deactivate that user and confirm they lose access, run the forgot and reset password flow, and confirm the reset link cannot be used twice.
- Run /security-review. Fix every real finding and list them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 03 in docs/ROADMAP.md.
- Finish with the results of each step, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
