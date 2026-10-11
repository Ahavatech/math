Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/PATTERNS.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 07b. Save this exact prompt as docs/prompts/07b-staff-directory.md.

PRE-CHECK
- Stage 07a must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/07b-staff-directory from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for services, ordering, search and public-safe queries. Follow docs/PATTERNS.md and docs/DESIGN.md and reuse existing components. Do not reopen decisions in DECISIONS.md. Run /security-review at the end and fix every real finding.

GOAL
Visitors can find people. A public staff directory with search and filters, a managed non-teaching staff list, lecturers and publications appearing on research area pages, and a featured lecturer on the homepage. After this stage, the lecturer pilot can start.

1. SCHEMA (one small migration, tests included)
- NonTeachingStaff: add showContact Boolean default false. Email and phone are shown publicly only when showContact is true. Document it in docs/DATA-MODEL.md.

2. ADMIN: NON-TEACHING STAFF (/admin/staff, permission lecturers.manage)
- List, create, edit, archive via isActive, reorder with up and down buttons. Fields: name, position, photo (media picker, alt required, optional), email, phone, showContact, order. Revisions and audit as in the pattern.
- Seed from the live site, idempotently and never overwriting admin edits: O. O. Akeju (Confidential Secretary I), Tunde-Adedipe Olubusola (Confidential Secretary), Ms. F. C. Famose (Senior Lab. Superintendent), Mr. Odewumi Stephen (Data Entry / Clerical Officer), Mr. Ijiwande Funminiyi (Principal Office Assistant). Names and positions only, no emails or phones, showContact false. Mark them "Imported from the old site, needs HOD review" in the admin only. Re-check the live page with curl through Bash before seeding and report any difference from this list.

3. LECTURER ORDERING (admin)
- In /admin/lecturers add up and down reordering of the order field. Public default sort: rank seniority (Professor first, then Associate Professor, Senior Lecturer, Lecturer I, Lecturer II, Assistant Lecturer, Graduate Assistant, Other), then admin order, then family name. A profile with the HOD role shown first is NOT automatic, use order for that. Tests for the sort and for reordering edge cases.

4. PUBLIC: /staff
- Sections: Academic staff (published, non-emeritus, active accounts), Emeriti and former staff (published with isEmeritus), Non-teaching and administrative staff (active). Empty sections hide themselves. With no published profiles yet, show a friendly empty state.
- Search and filters: name search, rank filter, research area filter. Implement with URL query parameters on the server so it works without JavaScript, then progressively enhance with a small client component only if it keeps the route's First Load JS no higher than other public pages. Name search must be case and accent insensitive, so "Adeshola" finds "Adéṣọlá" (fold diacritics and Yoruba marks on both sides). Tests with Yoruba names.
- PersonCard for each lecturer: photo, honorific and name, rank, up to three research areas, link to /lecturer/[slug]. Non-teaching cards show name, position, photo if any, and contact only when showContact is true.
- Public queries use explicit select with public-safe fields only. Never select User.email or any hash. Add a serialisation test asserting login emails never appear in the /staff payload.
- Metadata, breadcrumbs, structured headings, static generation with on-demand revalidation whenever a lecturer or non-teaching staff record changes, is published, unpublished, deactivated or reordered. Safe fallback when the database is unreachable.
- Enable "Staff" in the header and footer navigation (label "Staff", not "Staffs") through the navigation data, not code, and enable the admin sidebar entry.

5. RESEARCH AREA PAGES
- On /research/[slug] enable the two blocks built in Stage 06: "Lecturers in this area" (published, non-emeritus, active profiles linked to the area, as PersonCards) and "Selected publications" (up to 8 most recent publications across those lecturers, showing the lecturer's name with a link). Both hide when empty. Revalidate the area page when a linked lecturer or publication changes.

6. HOMEPAGE: FEATURED LECTURER AND STAFF STAT
- Add a Site Settings section "Featured lecturer" with a mode: Manual (choose one published profile) or Automatic (deterministic daily rotation among published profiles that have a photo and a bio). Default Automatic. The homepage block hides itself if no eligible profile exists. Revisions and audit as usual.
- Confirm the "Academic staff" stat counts published, non-emeritus, active profiles automatically, and that its editor label says which mode is active. Report the current computed value.
- Add admin dashboard cards: "Published lecturers" and "Non-teaching staff".

7. TESTS
- Directory queries: only published, active, non-emeritus in the main list; emeriti separate; deactivated accounts and archived profiles excluded everywhere including research pages and the homepage.
- Search and filters including Yoruba diacritics, combined filters, empty results.
- Non-teaching contact visibility rule. Seed idempotency and no overwrite.
- Featured lecturer selection: manual, automatic determinism, ineligible profile handling.
- Permissions: LECTURER-only gets 403 on /admin/staff; roles with lecturers.manage can use it.
- Bundle-leak guard still passes.

8. DOCS
- Update docs/CONTENT-EDITING.md (non-teaching staff, ordering, featured lecturer) and docs/LECTURER-GUIDE.md if anything changed. Add decisions to docs/DECISIONS.md. Add a "Pilot rollout" section to docs/CONTENT-EDITING.md: invite two or three lecturers first, then the rest in batches.

9. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: seed the staff, view /staff on desktop and phone width, search with a diacritic name, filter by rank and research area, reorder lecturers and see the public order change, check a research area page shows its lecturers and publications, set the featured lecturer manually then back to automatic, archive a non-teaching record and confirm it disappears, and confirm a LECTURER-only user gets 403 on /admin/staff.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 07b in docs/ROADMAP.md.
- Finish with: results of each step, any difference between the seeded non-teaching list and the live site, the computed "Academic staff" stat, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
