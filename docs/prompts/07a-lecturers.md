Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/MEDIA.md, docs/PATTERNS.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 07a. Save this exact prompt as docs/prompts/07a-lecturers.md. In docs/ROADMAP.md, split item 07 into 07a (lecturer management, self-service profile, portfolio page) and 07b (staff directory, non-teaching staff, research page blocks, featured lecturer).

PRE-CHECK
- Stage 06 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/07a-lecturers from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for services, permissions, field allowlists, CSV import, slugs and the PDF pipeline checks. Follow docs/PATTERNS.md and docs/DESIGN.md and reuse existing components and services. Do not reopen decisions in DECISIONS.md. Run /security-review at the end and fix every real finding.

GOAL
The admin creates lecturer profiles and sends invites, lecturers sign in and complete their own portfolio, and each published lecturer has a public page at /lecturer/[slug]. This is the first stage where non-admin users operate the system, so ownership and field-level permissions matter most.

1. SCHEMA (one migration, tests included)
- LecturerProfile: add previousSlugs String[] (for redirects), supervisionText String? (rich text, "Students and supervision"), publishRequestedAt DateTime?. Keep everything else as in DATA-MODEL.md.
- Record the changes in docs/DATA-MODEL.md.

2. ADMIN: LECTURERS (/admin/lecturers, permission lecturers.manage)
- List with columns: name, rank, status (DRAFT, PUBLISHED, ARCHIVED), invite state (not invited, invited, accepted, expired), profile completeness (simple percentage), publish request badge. Filters by status and invite state, search by name.
- Create: full name, honorific, rank, official email. Creates a User with the LECTURER role plus a DRAFT LecturerProfile in one transaction. Reuse the Stage 03 invite flow and email template. A person who already holds another role (for example HOD) keeps those roles, and the LECTURER role is added.
- Slug generated from the name (lowercase, ASCII-folded, hyphenated, collision-safe suffix). Only admins can edit it, and changing a published slug pushes the old one into previousSlugs so the old URL redirects with a 308.
- Row actions: send or resend invite, copy invite link (shown once), publish, unpublish, archive and restore, deactivate and reactivate the account (a deactivated lecturer's profile must disappear from public queries immediately), edit any field on behalf of the lecturer (full audit trail), and "view as public" preview.
- Publishing rule: new profiles start DRAFT. The lecturer can request publishing once the minimum is complete (photo with alt text, bio, at least one research area). An admin approves by publishing. After first publication, the lecturer's edits go live immediately, every edit writes a ContentRevision and an AuditLog entry, and an admin can restore any version or unpublish. Record this as a decision in DECISIONS.md (the HOD may change it later).
- Bulk import: upload a CSV (columns fullName, honorific, rank, email; max 200 rows). Step 1 is a dry run showing valid rows, errors (bad email, unknown rank, duplicate email, duplicate in file) and rows that would be skipped. Step 2 creates the accounts and DRAFT profiles without sending any email. Step 3 is a separate "Send invites" action with a confirmation, sending sequentially with a small delay, showing per-row results and never aborting on one failure. Rank parsing is tolerant (Prof, Professor, Snr Lecturer, and similar) and unknown ranks are reported, never guessed.
- Create docs/lecturer-import-template.csv pre-filled with the academic staff names and ranks found on https://maths.oauife.edu.ng, with the email column empty. Do not invent emails or ranks. If a rank is unclear on the live site, leave it empty and say so in the audit entry.
- Dashboard cards: "Profiles awaiting publishing" and "Invites not yet accepted".

3. SELF-SERVICE: MY PROFILE (/admin/my-profile)
- A user with only the LECTURER role sees a minimal admin shell: My profile, Change password, Sign out. Every other /admin route stays 403.
- Editable by the lecturer (strict zod allowlist, called lecturerSelfEditSchema): photo (media picker, folder lecturers, alt text required), honorific, bio (rich text with a limited toolbar: bold, italic, lists, links, inline math), research areas (multi-select from published areas), office location, office hours, public email, phone, Google Scholar URL, ORCID (validate the ORCID format and checksum), ResearchGate URL, LinkedIn URL, supervisionText (rich text), publications, CV.
- NOT editable by the lecturer, enforced on the server by using a separate admin schema (lecturerAdminEditSchema) for the other fields: userId, slug, rank, status, order, isEmeritus, publishRequestedAt (they can only set it through the "Request publishing" action). Tests must try mass assignment (sending extra fields) and prove they are ignored or rejected.
- Public contact rules: the login email (User.email) is NEVER shown publicly. Only the separate publicEmail field is shown, and only if filled. Phone is shown only if filled. Both are empty by default.
- URL fields: https only, host allowlist per field (scholar.google.com, orcid.org, researchgate.net, linkedin.com). Reject javascript: and data: URLs.
- Publications manager: add, edit, remove and reorder (up and down buttons) with title, authorsText, venue, year, url (https only), doi (validated format). Limit 200 per lecturer.
- Every save writes ContentRevision and AuditLog, with a version history dialog and restore. Unsaved-changes warning. Autosave is NOT needed.
- "Request publishing" button with the completeness checklist. Show current status in plain language.
- Change password (/admin/my-profile/security): requires the current password, minimum 10 characters, rate limited, invalidates other sessions if feasible, and writes an AuditLog entry.

4. CV UPLOAD (first PDF pipeline)
- Before building, check Cloudinary's current documentation for PDF upload and delivery (resource type, the account setting that allows PDF and ZIP delivery, free-plan file size limits). Do not rely on memory. Summarise what you found in docs/MEDIA.md.
- Signed direct upload, folder oau-maths/lecturers/cv, PDF only, maximum 5 MB enforced client-side, in the signed parameters and again on the server after upload by fetching the resource details from Cloudinary (format and bytes). If verification fails, delete the asset and show a clear error. If feasible, also check the "%PDF" magic bytes with a ranged fetch.
- Create the Download row (category CV) and link it as cvDownloadId. Replacing a CV removes the old asset when unused. The public download filename is Surname-CV.pdf.
- After upload, the server tests whether the delivery URL actually works. If Cloudinary blocks PDF delivery, show an admin-readable message explaining which Cloudinary setting to enable.
- The signing route authorises by session and ownership: a lecturer can sign uploads only into their own CV folder path. Rate limit it.

5. PUBLIC PAGE: /lecturer/[slug]
- Published, non-deactivated profiles only. 404 for drafts and archived. If the slug matches a previousSlugs entry, redirect 308 to the current slug.
- Layout: photo (CloudImage with alt), name with honorific, rank, research areas as links to /research/[slug], bio, contact block (public email, phone, office, office hours, only what exists), links (Scholar, ORCID, ResearchGate, LinkedIn with rel="noopener noreferrer"), publications grouped by year, "Students and supervision", CV download button. A "Courses taught" block stays hidden until Stage 10 data exists. Empty sections hide themselves.
- Rich text goes through renderRichText. Public queries use explicit select with public-safe fields only. Never select User.email, passwordHash or token data.
- Metadata (title, description, OG image), breadcrumbs, schema.org Person JSON-LD, static generation with on-demand revalidation when a profile changes or is unpublished. Safe fallback when the database is unreachable.
- The owner and admins can open a DRAFT preview of the page behind a session check (noindex).
- Do not build /staff yet, that is Stage 07b. Until then, no public index page links to profiles.

6. TESTS
- Ownership: lecturer A cannot edit B's profile, publications, CV or request publishing for B (service level and action level). A user with no lecturer profile cannot use /admin/my-profile.
- Field allowlists and mass assignment, as above.
- Slugs: generation, collisions, redirect from previousSlugs, admin-only change.
- Public queries: exclude DRAFT, ARCHIVED and deactivated accounts, never return login email or hashes. Add a test that serialises the public query result and asserts the login email string is absent.
- CSV import: valid, invalid, duplicates, rank parsing, 200-row cap, no email sent in step 2, per-row failure handling in step 3 (mock Resend).
- Invite state derivation, publishing rule, URL and ORCID validators, PDF verification logic with mocked Cloudinary responses.
- Permissions matrix test updated for any new permission names.

7. PERFORMANCE AND DOCS
- Report First Load JS for /lecturer/[slug]. Editor and admin code must not appear in public bundles, and the bundle-leak guard must pass.
- docs/LECTURER-GUIDE.md: a one-page plain-language guide the HOD can send to lecturers (accepting the invite, completing the profile, requesting publishing, changing a photo or CV). No em dashes.
- Update docs/CONTENT-EDITING.md with lecturer onboarding for admins. Add decisions to docs/DECISIONS.md. Update docs/AUTH.md if permissions changed.

8. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: bulk import a small CSV with two of your own test addresses (dry run, create, send invites, and note that the Resend sandbox only delivers to the account owner's address, so use the dev fallback link for the others), accept an invite as a lecturer, complete the profile with photo and a PDF CV, request publishing, publish as admin, view /lecturer/[slug] on desktop and phone width, change the slug and confirm the old URL redirects, edit as the lecturer after publication and confirm it goes live, unpublish and confirm 404, deactivate the account and confirm the profile disappears, and confirm a LECTURER-only user gets 403 on every admin route except My profile.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 07a in docs/ROADMAP.md.
- Finish with: results of each step, the Cloudinary PDF findings, which ranks and names were pre-filled in the CSV template and which were left blank, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
