# DECISIONS.md

Decisions below are settled. Do not reopen them without asking. Add new decisions at the bottom with a date.

| # | Date | Decision |
|---|---|---|
| 1 | 2026-10-05 | Build with Next.js (App Router, TypeScript, Tailwind, shadcn/ui). |
| 2 | 2026-10-05 | Database is PostgreSQL, accessed with Prisma. |
| 3 | 2026-10-05 | Authentication is Auth.js with roles and invite links. The admin creates each lecturer profile, and the lecturer receives an invite link to set their own password. |
| 4 | 2026-10-05 | Images are compressed and stored in Cloudinary. Public PDFs (published articles, handbook, forms, CVs) go to Cloudinary too, with PDF delivery enabled in its security settings. |
| 5 | 2026-10-05 | Manuscripts under review and reviewer reports are private. They are stored on the backend server disk and served only through an authorised route. |
| 6 | 2026-10-05 | Email is sent through Resend. The department domain needs SPF and DKIM records to verify the sender. |
| 7 | 2026-10-05 | The university provides frontend hosting only. The backend runs on a KVM 1 VPS bought for the project. |
| 8 | 2026-10-05 | The journal lives at /journal inside the same app, with author submission and peer review in the first release. OJS is not used. |
| 9 | 2026-10-05 | Alumni all fill the form again. The 519 recorded graduates are not seeded publicly. They may be kept as a private cross-check list in the admin. |
| 10 | 2026-10-05 | Everything dynamic is editable through the admin, including the HOD welcome address and picture. |
| 11 | 2026-10-05 | No em dashes in UI copy, emails or docs. |
| 12 | 2026-10-05 | A user can hold several roles at once (UserRole is a many-to-many join on User and a role enum, unique per pair), not a single role column on User. |
| 13 | 2026-10-05 | Auth.js uses the Credentials provider with JWT sessions. There are no Auth.js Account, Session or VerificationToken tables; our own User/UserRole/UserToken models are the full account model. |
| 14 | 2026-10-05 | Every image reference on a content model is a nullable relation to MediaAsset, never a raw URL column. |
| 15 | 2026-10-05 | Public content is never hard-deleted. Removing it sets ContentStatus to ARCHIVED instead. |
| 16 | 2026-10-05 | Stage 02's first Prisma migration was generated offline with `prisma migrate diff --from-empty` because this machine had neither Docker nor a local PostgreSQL server at the time. Resolved in Stage 02b: Docker Desktop and docker-compose.yml's local Postgres are now running, the migration applied cleanly with no drift, and the seed and database-backed tests all run and pass against it. |
| 17 | 2026-10-05 | Article.issueId is onDelete: Restrict, not Cascade. A JournalIssue cannot be deleted while it still has articles attached, since a published article's record must not disappear as a side effect of deleting its issue. |
| 18 | 2026-10-05 | CoursePrerequisite and CourseLecturer are implicit many-to-many relations (named via Prisma's @relation(...), which also names the underlying join table), not explicit join models, since the spec lists no extra fields on either join. |
| 19 | 2026-10-05 | Passwords are hashed with argon2id (@node-rs/argon2), which built and ran natively on this machine, so no bcryptjs fallback was needed. |
| 20 | 2026-10-05 | Sessions are JWT-only (decision #13); the jwt callback re-checks isActive and roles from the database at most every 5 minutes, so a deactivated user or a role change takes effect within 5 minutes without requiring a fresh sign-in. |
| 21 | 2026-10-05 | Rate limiting (login, forgot-password, token consumption) is an in-memory sliding window, single process only. It does not share state across multiple instances. If the app is ever deployed behind more than one Node instance, this must move to a shared store (e.g. Redis) behind the same RateLimiter interface in src/lib/rate-limit.ts. |
| 22 | 2026-10-05 | In development, with no RESEND_API_KEY set, outgoing email is printed to the console instead of sent. This fallback throws instead of silently no-op-ing when NODE_ENV is production, so it cannot accidentally reach production. |
| 23 | 2026-10-05 | /admin/users is restricted to the SUPER_ADMIN role specifically (not the users.manage permission in the abstract), enforced server-side in the page itself, not just hidden from the nav. |
| 24 | 2026-10-05 | HOD holds every content permission. users.manage stays SUPER_ADMIN only. |

## Open questions
- Does the university frontend hosting run Node.js? If not, the whole Next.js app runs on the KVM 1 and the university host only handles the domain or a redirect.
- Where does PostgreSQL run (same VPS or a managed provider)?
- Who obtains the Crossref membership if DOIs are wanted?
- Statistics split: remove Statistics content or cross-link it?
- Pricing and payment terms.
