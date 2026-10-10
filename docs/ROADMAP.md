# ROADMAP.md

Tick items as they are completed and note the AUDIT.md entry number.

- [x] 01 Foundation: scaffold, tooling, folder structure, CI, security workflow (Entry 001)
- [x] 02 Database: Prisma schema for all modules, migrations, seed, AuditLog (Entry 002 — migration generated offline, not yet applied to a live database; see Open issues)
- [x] 03 Auth and admin shell: Auth.js, roles, RBAC, invite and reset flows with Resend, admin layout (Entry 004 — real email delivery blocked until a verified Resend sending domain is configured; see Open issues)
- [x] 04 Design system and public layout: Impeccable direction, header, footer, navigation from settings (Entry 005 — palette/fonts proposed, pending HOD confirmation; First Load JS over 130kB target, see Open issues)
- [x] 05 Media pipeline and site content: Cloudinary upload with compression, site settings editor, homepage, about, HOD address (Entry 007 — manual file-upload step of the walkthrough still needs to be done by hand, see Open issues)
- [x] 06 Programmes and research areas: admin CRUD and public pages (Entry 013 — found the M.Sc. actually lists 10 specialisations, not 9 as the prompt assumed; found the ADMIN role already holds site.edit same as HOD, conflicting with the prompt's "ADMIN-only user gets 403" test assumption, see Open issues)
- [ ] 07 Lecturers: admin creates profiles, invites, /lecturer/[slug], staff directory, non-teaching staff
- [ ] 08 News and events: admin CRUD, upcoming and past, flyers, galleries, calendar export
- [ ] 09 Alumni: form links, pending queue, approval, duplicate checks, public directory. Before building the photo upload, switch the `alumni` Cloudinary folder to `type: authenticated` with signed delivery URLs (DECISIONS.md #33) — a pending/unapproved alumni photo must not get a public, forever-fetchable URL the instant it's uploaded. Implement DECISIONS.md #34: upload as `authenticated`, show pending photos to admins only via short-lived signed URLs, move to public delivery on approval (check the current Cloudinary API for changing delivery type first), delete from Cloudinary and remove the MediaAsset row on rejection, and authorise the alumni upload-signing route by a valid unexpired alumni link token with per-link/per-IP rate limits, a size cap and the same format allowlist.
- [ ] 10 Student resources: handbook pages, course catalogue, downloads, academic calendar
- [ ] 11 Journal public side: landing, issues, articles, editorial board, private file storage
- [ ] 12 Journal submission and peer review: authors, editors, reviewers, rounds, notifications
- [ ] 13 Search, SEO, accessibility and performance, end-to-end tests. Reduce First Load JS on public routes from about 197 kB gzip toward 130 kB. Use the bundle analyzer, check lucide icon imports and base-ui usage, and confirm no admin-only libraries leak into public routes.
- [ ] 14 Hardening and deployment: security pass, backups, Nginx, process manager, docs, training and handover. Also add the Content-Security-Policy header (deferred from Stage 03, which added the other baseline security headers in next.config.ts).
