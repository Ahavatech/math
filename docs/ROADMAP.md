# ROADMAP.md

Tick items as they are completed and note the AUDIT.md entry number.

- [x] 01 Foundation: scaffold, tooling, folder structure, CI, security workflow (Entry 001)
- [x] 02 Database: Prisma schema for all modules, migrations, seed, AuditLog (Entry 002 — migration generated offline, not yet applied to a live database; see Open issues)
- [x] 03 Auth and admin shell: Auth.js, roles, RBAC, invite and reset flows with Resend, admin layout (Entry 004 — real email delivery blocked until a verified Resend sending domain is configured; see Open issues)
- [x] 04 Design system and public layout: Impeccable direction, header, footer, navigation from settings (Entry 005 — palette/fonts proposed, pending HOD confirmation; First Load JS over 130kB target, see Open issues)
- [x] 05 Media pipeline and site content: Cloudinary upload with compression, site settings editor, homepage, about, HOD address (Entry 007 — manual file-upload step of the walkthrough still needs to be done by hand, see Open issues)
- [x] 06 Programmes and research areas: admin CRUD and public pages (Entry 013 — found the M.Sc. actually lists 10 specialisations, not 9 as the prompt assumed; found the ADMIN role already holds site.edit same as HOD, conflicting with the prompt's "ADMIN-only user gets 403" test assumption, see Open issues)
- [x] 07a Lecturer management: admin creates profiles and sends invites, CSV bulk import, lecturer self-service profile (photo, bio, research areas, contact, links, publications, CV), publish/unpublish workflow, /lecturer/[slug]
- [x] 07b Staff directory and research page blocks: /staff with search and filters, non-teaching staff cards, emeriti section, "Lecturers in this area" and "Selected publications" blocks on /research/[slug], featured lecturer on the homepage
- [x] 08 News and events: admin CRUD, upcoming and past, flyers, galleries, calendar export
- [x] 09 Alumni: form links, pending queue, approval, duplicate checks, public directory (Entry 019)
- [x] 10 Student resources: handbook pages, course catalogue, downloads, academic calendar (Entry 020)
- [x] 11 Journal public side: landing, issues, articles, editorial board, private file storage (Entry 023)
- [ ] 12 Journal submission and peer review: authors, editors, reviewers, rounds, notifications
- [ ] 13 Search, SEO, accessibility and performance, end-to-end tests. Reduce First Load JS on public routes from about 197 kB gzip toward 130 kB. Use the bundle analyzer, check lucide icon imports and base-ui usage, and confirm no admin-only libraries leak into public routes. Measure First Load JS the same way every time (standalone production server). Earlier stages used a different method, so compare against the 159 kB baseline, not older numbers.
- [ ] 14 Hardening and deployment: security pass, backups, Nginx, process manager, docs, training and handover. Also add the Content-Security-Policy header (deferred from Stage 03, which added the other baseline security headers in next.config.ts). Production seed must exclude [SAMPLE] data and test accounts. Seed adds missing NavItems with an order that does not collide with existing ones (Staff and Journal collided on a seeded database). Schedule `npm run alumni:cleanup-orphans` and `npm run alumni:purge-rejected` (e.g. a daily cron job). The `/privacy` page is a plain-language draft (flagged in `/admin/pages`) and needs review by OAU legal or the department's data protection officer before the alumni form is sent to real alumni. Schedule `npm run contact:purge-archived` alongside the alumni cleanup scripts. Schedule `npm run private-storage:orphans` the same way, and include `PRIVATE_STORAGE_DIR` in the backup job. The journal.manage/journal.edit vs ADMIN split (DECISIONS.md #54) still needs the HOD's confirmation.
