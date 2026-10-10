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
| 25 | 2026-10-06 | Math notation renders via KaTeX's renderToString on the server, with trust:false (refuses \href/\includegraphics and similar commands that could otherwise embed a javascript: URL or external resource) and throwOnError:false. The resulting HTML is KaTeX's own structured markup, not raw passthrough of the input, which is why inserting it via dangerouslySetInnerHTML is safe; katex/dist/katex.min.css is imported only inside the Math component file so it ships only on pages that actually render math. |
| 26 | 2026-10-10 | Image uploads use signed direct uploads: the browser asks a server route for a signature (after a permission check), then uploads straight to Cloudinary. The server never proxies the file bytes, and it re-fetches the resulting asset's real width/height/bytes from Cloudinary's API before writing a MediaAsset row, so a MediaAsset never trusts client-supplied dimensions. |
| 27 | 2026-10-10 | Images are compressed and re-encoded to WebP in the browser (max 2000px long edge, target under 400KB, GPS EXIF stripped) before upload, to keep Cloudinary usage and page weight down on a free-tier plan. |
| 28 | 2026-10-10 | Only jpg, png, webp and avif are accepted for image upload. SVG is never accepted, since an SVG can carry embedded script and would defeat the point of sanitizing everything else. |
| 29 | 2026-10-10 | Rich text (HOD welcome address, Page bodies) is sanitized with a strict tag/attribute allowlist (sanitize-html) both on save and again on render, so a compromised admin session or a future rendering bug cannot turn stored HTML into script execution. |
| 30 | 2026-10-10 | Site settings live in one typed registry (src/server/services/site-settings.ts): every key has a zod schema, a default and a label, and getSetting/setSetting are the only way to read or write one. An unknown key or a value that fails its schema is rejected outright rather than partially applied; a row that fails to parse (e.g. from a stale schema) falls back to that key's default rather than reaching a page as undefined. |
| 31 | 2026-10-10 | Every settings save and Page save writes a ContentRevision alongside the AuditLog entry, so each editable section has its own restorable version history, viewable and restorable from the admin UI without needing database access. |
| 32 | 2026-10-10 | Navigation items are reordered with explicit up/down buttons that swap the `order` field with an adjacent sibling, not a drag-and-drop library, per the prompt's constraint. |
| 33 | 2026-10-10 | Every image uploaded through the media pipeline (src/app/api/upload-signing/route.ts) uses Cloudinary's default public delivery type (`type: upload`): the resulting URL is fetchable by anyone who has it, forever, regardless of app-level approval state. This is fine for content that is meant to be public the moment it is saved (site logo, hero image, published lecturer/news photos). It is not fine for the `alumni` folder once Stage 09 builds the public alumni submission form: an alumnus's photo would become a live, world-fetchable URL the instant it is uploaded, independent of "alumni entries are never public until approved." Before Stage 09 ships alumni photo uploads, switch the `alumni` folder (and any other pending-until-approved folder) to Cloudinary's `type: authenticated` with signed, time-limited delivery URLs generated at render time, instead of serving the stored MediaAsset.url directly. |
| 34 | 2026-10-10 | Alumni photos upload as Cloudinary type authenticated while the entry is PENDING and are shown to admins only through short-lived signed URLs. On approval the asset moves to public delivery (verify the current Cloudinary API for changing delivery type before building). On rejection the asset is deleted from Cloudinary and its MediaAsset row removed. The alumni upload signing route authorises by a valid, unexpired alumni link token (not a session), with per-link and per-IP rate limits, a strict size cap and the same format allowlist. All other folders stay public by design. Draft-content image URLs are unguessable but fetchable, risk accepted. |

## Open questions
- Does the university frontend hosting run Node.js? If not, the whole Next.js app runs on the KVM 1 and the university host only handles the domain or a redirect.
- Where does PostgreSQL run (same VPS or a managed provider)?
- Who obtains the Crossref membership if DOIs are wanted?
- Statistics split: remove Statistics content or cross-link it?
- Pricing and payment terms.
