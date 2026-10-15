# Authentication and access

## Flows

| Flow | Route | Notes |
| --- | --- | --- |
| Sign in | `/login` | Credentials provider. Generic "Incorrect email or password" error that never reveals whether the email exists. Inactive users cannot sign in. Updates `lastLoginAt` on success. Rate limited by IP and by email. |
| Accept invite | `/accept-invite/[token]` | Sets a password (minimum 10 characters), consumes the INVITE token, sends the user to `/login`. Does not sign them in automatically. |
| Forgot password | `/forgot-password` | Always shows the same message regardless of whether the email exists. Sends a reset link only when the user exists and is active. Rate limited by IP and by email. |
| Reset password | `/reset-password/[token]` | Sets a new password, consumes the PASSWORD_RESET token. |
| Sign out | server action `logoutAction` | Clears the session, redirects to `/login`. |
| Change password | `/admin/my-profile/security` | Requires the current password. Minimum 10 characters. Rate limited (5/min by user, 5/min by IP). Writes an AuditLog entry and stamps `User.passwordChangedAt`, which signs out other active sessions within 5 minutes - see "Session behaviour" below. |

## Token rules

- `src/server/services/tokens.ts` issues and consumes `UserToken` rows.
- 32 random bytes, base64url-encoded, shown once to the caller. Only a sha256 hash is ever persisted (`UserToken.tokenHash`).
- INVITE tokens expire in 7 days, PASSWORD_RESET tokens in 1 hour, EMAIL_VERIFY tokens in 24 hours.
- A token is single-use: consuming it sets `usedAt`, and a second consume attempt on the same token returns `null`.
- Issuing a new token of a given type for a user invalidates (marks used) any earlier unused token of that same type for that user, so only the newest token can ever work.
- Consuming a token of the wrong type, or past its `expiresAt`, returns `null` the same way an invalid token does — callers cannot distinguish "wrong type" from "expired" from "already used" from "never existed", which is intentional (no information leakage).

## Permission matrix

Derived from docs/SCOPE.md's "Roles and admin control" table. `users.manage` belongs only to `SUPER_ADMIN` (Stage 03's `/admin/users` is restricted to that role specifically, not just the permission).

As of Stage 06 (see DECISIONS.md's entry amending #23/#24), `site.edit` and `academics.manage` are two separate permissions: `site.edit` covers site settings, navigation, pages and the HOD welcome address (HOD and SUPER_ADMIN only); `academics.manage` covers programmes and research areas (SUPER_ADMIN, HOD and ADMIN). ADMIN no longer holds `site.edit`.

| Role | Permissions |
| --- | --- |
| SUPER_ADMIN | everything |
| HOD | site.edit, academics.manage, lecturers.manage, news.manage, events.manage, alumni.review, contact.manage, students.manage, journal.manage, journal.edit, journal.manuscripts.read, own_profile.edit |
| ADMIN | academics.manage, lecturers.manage, news.manage, events.manage, alumni.review, contact.manage, students.manage, own_profile.edit |
| LECTURER | own_profile.edit |
| JOURNAL_EDITOR_IN_CHIEF | journal.manage, journal.edit, journal.editorial, journal.manuscripts.read, own_profile.edit |
| JOURNAL_EDITOR | journal.edit, journal.editorial, journal.manuscripts.read, own_profile.edit |
| REVIEWER | journal.review, own_profile.edit |
| AUTHOR | journal.submit, own_profile.edit |

A user can hold several roles; their effective permissions are the union of every role they hold. `canEditLecturerProfile(user, profile)` additionally allows a lecturer to edit their own profile (`user.id === profile.userId`) even without `lecturers.manage`.

### Journal (Stage 12a)

`journal.editorial` (SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR) gates every editorial action on a manuscript: assigning a handling editor, returning to author, desk-rejecting, and approving for peer review. `journal.manuscripts.read` (SUPER_ADMIN, HOD, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR) gates read-only access to the manuscript list and detail pages. The HOD holds `journal.manuscripts.read` but not `journal.editorial` — they may open any manuscript and download files but may not perform any editorial action. ADMIN holds neither (editorial independence, DECISIONS.md #54).

Authors register on `/journal/register` without an admin invite. Registration uses an email-verified `emailVerifiedAt` flag on `User`. Unverified authors cannot create or submit manuscripts. The `EMAIL_VERIFY` token type (`UserTokenType`) expires in 24 hours, is single-use and hash-only, like the other token types.

Conflict of interest (DECISIONS.md #59): a user who is the submitter or an author of a manuscript has no editorial or read access to it regardless of their roles, including SUPER_ADMIN and HOD. The conflict check is computed in the service layer before any role or permission check.

### Journal (Stage 11)

`journal.manage` (SUPER_ADMIN, HOD, JOURNAL_EDITOR_IN_CHIEF) covers `/admin/journal/settings`, `/admin/journal/pages` and `/admin/journal/board`. `journal.edit` (the same roles plus JOURNAL_EDITOR) covers `/admin/journal/issues` and `/admin/journal/articles`. ADMIN holds neither unless it also holds a journal role (DECISIONS.md #54, editorial independence - pending HOD confirmation). The admin sidebar's "Journal" group shows only the items a role's permissions allow; a role holding only a journal permission (no other admin permission) gets a minimal shell of just those Journal items plus Change password and Sign out, the same idea as the existing lecturer-only shell. The manuscript file access policy (`src/server/services/manuscript-access.ts`, for Stage 12) deliberately checks role membership instead of these permissions - see DECISIONS.md #55 and docs/JOURNAL.md.

### Contact inbox and student resources (Stage 10)

`contact.manage` (HOD, ADMIN, SUPER_ADMIN) covers `/admin/messages`: reading, status changes, and resolving an alumni removal-request's reference. `students.manage` (HOD, ADMIN, SUPER_ADMIN) covers the handbook, course catalogue, downloads and academic calendar admin areas. Neither is held by `LECTURER`, matching every other content-manager permission.

### Alumni (Stage 09)

`alumni.review` (HOD, ADMIN, SUPER_ADMIN) covers the whole `/admin/alumni` area: the review queue, link management, inline edits, approve/reject/withdraw/restore and the duplicate-handling actions. "Erase permanently" is a further, narrower restriction checked on top of `alumni.review`: only a user who also holds the `HOD` or `SUPER_ADMIN` role may erase an entry (`hasRole(user, ["HOD", "SUPER_ADMIN"])`, checked in `src/server/actions/alumni-review.ts`'s `eraseAlumniEntryAction`, not just hidden from `ADMIN` in the UI). The public alumni submission form (`/alumni/submit/[token]`) and its upload-signing route need no session at all - they are authorized by a valid alumni link token instead, the only place in this app where a mutation is authorized by something other than a signed-in user's permissions.

### Media folder permissions

Each Cloudinary media folder (`src/lib/media-folders.ts`) requires the permission of the content it belongs to, not a single blanket permission: `site` (identity, hero, HOD photo) needs `site.edit`; `research` needs `academics.manage`; `lecturers`, `news`, `events` and `alumni` need their own matching `*.manage`/`alumni.review` permission. This means ADMIN can upload research area images but not the site logo or HOD photo, even though both now only required `site.edit` before Stage 06 split the two apart.

## Session behaviour

- Strategy: JWT, no database session table (Auth.js `Account`/`Session`/`VerificationToken` tables do not exist — see DECISIONS.md #13).
- The JWT carries `id`, `roles`, `isActive`, and the `passwordChangedAt` timestamp that was current at login.
- On every request, the `jwt` callback checks whether more than 5 minutes have passed since the roles/active-status were last read from the database (`rolesCheckedAt`). If so, it re-reads `User.isActive` and `UserRole` fresh from the database. This means a deactivated user, or one whose roles changed, loses access within 5 minutes without needing to sign out and back in.
- That same recheck also compares the token's stamped `passwordChangedAt` against the database value; a mismatch (the password changed since this token was issued) marks the token inactive, so changing your password signs out other active sessions within 5 minutes (see DECISIONS.md #37 - a JWT strategy with no server-side session store has no way to invalidate a session instantly).
- `src/proxy.ts` (Next.js's `proxy` convention) gives coarse protection: no session at all on `/admin/*` or `/journal/dashboard/*` redirects to `/login`. This is not where real authorization happens — every page and server action re-checks via `src/lib/rbac.ts`'s `requireRole`/`requirePermission`, because the proxy only knows "signed in or not," never which role or permission a specific action needs.
- Cookies: `httpOnly`, `sameSite: lax` (Auth.js defaults), `secure` automatically when the app runs with `NODE_ENV=production` over HTTPS.

## Deployment notes (behind Nginx)

- `AUTH_URL` must be the externally reachable HTTPS URL of the site (e.g. `https://maths.oauife.edu.ng`). Auth.js uses it to build absolute links (invite/reset emails) and to validate the request's origin.
- `trustHost: true` is set in `src/auth.ts` because the app runs behind a reverse proxy; Nginx must forward `X-Forwarded-Host` and `X-Forwarded-Proto` correctly, or Auth.js's origin checks will reject requests.
- `AUTH_SECRET` must be a long random value, set identically across any process that verifies sessions, and never committed.

## Rate limiting

- `src/lib/rate-limit.ts`'s `InMemoryRateLimiter` is a single-process, in-memory sliding window. It does **not** share state across multiple Node instances — see DECISIONS.md for the explicit single-instance limitation this creates, and what must change if the app is ever deployed with more than one instance.
- Applied to: login (5/min by IP, 5/min by email), forgot-password (3/min by IP, 3/min by email), and token consumption on accept-invite/reset-password (10/min by IP).
