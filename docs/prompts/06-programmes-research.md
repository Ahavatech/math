Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/MEDIA.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 06. Save this exact prompt as docs/prompts/06-programmes-research.md.

PRE-CHECK
- Stage 05 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/06-programmes-research from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for services, ordering, slug and status rules and permissions. Follow docs/DESIGN.md and the Impeccable design context. Reuse the Stage 05 components (rich text editor, media picker, CloudImage, renderRichText, revision and audit services, revalidation). Do not rebuild them. Do not reopen decisions in DECISIONS.md. Run /security-review at the end and fix every real finding.

GOAL
The HOD can create and edit programmes, specialisations and research areas from /admin, and the public site shows them on proper pages. This is the first full admin-to-public content module, so it also sets the pattern later stages (lecturers, news, events) will copy.

1. DATA FROM THE LIVE SITE
- Use WebFetch on https://maths.oauife.edu.ng to collect: the descriptions and durations of the B.Sc., M.Sc. and Ph.D. programmes, any admission requirements stated, the M.Sc. specialisations (the live site lists 9), and the description text for each of the 9 research areas.
- Seed these through an idempotent seed or script. Hard rule: the seed must NEVER overwrite a record or field the admin has edited. Only create missing records or fill fields that are empty. Mark seeded records "Imported from the old site, needs HOD review" in the admin only.
- Do not invent text. Where the live site has nothing, leave a clearly marked placeholder in the admin and hide that field on the public page.
- Check whether the live site lists anything that now belongs to the separate Statistics department (the split happened in January 2025). Do not remove or rewrite anything. Report what you found in the audit entry so I can raise it with the HOD.

2. ADMIN: PROGRAMMES (/admin/programmes, permission site.edit)
- List the three programmes with status. Edit: title, summary, rich text body, duration, admission requirements (rich text), status. The level (BSC, MSC, PHD) and its URL slug are fixed and cannot be changed or deleted.
- Specialisations manager inside each programme: add, edit, remove (archive), reorder with up and down buttons. Each has title and description.
- Every save writes a ContentRevision and an AuditLog entry, with version history and restore as in Stage 05. Revalidate affected public pages on save.

3. ADMIN: RESEARCH AREAS (/admin/research, permission site.edit)
- List with status and order. Create, edit, archive and restore. Fields: title, slug (generated from the title, editable, unique, with a collision-safe suffix), summary, rich text body, image from the media library (alt text required), status, order with up and down buttons.
- Show on each area which lecturers are attached (read only for now, the attachment itself happens on the lecturer profile in Stage 07).
- Archived areas disappear from the public site but their slug redirects to /research. Never hard delete.
- Same revision, audit and revalidation behaviour.

4. PUBLIC PAGES
- /programmes: overview of the three programmes.
- /programmes/[level] with level slugs bsc, msc, phd mapped to the enum, plus 404 for anything else. Show summary, body, duration, admission requirements and specialisations (M.Sc. and any other programme that has them). Add a "Courses" block that is hidden until Stage 10 data exists.
- /research: grid or list of published areas in the admin-defined order.
- /research/[slug]: image, summary, body, and two blocks that hide themselves when empty: "Lecturers in this area" (published, non-emeritus profiles linked to the area, as PersonCards) and "Selected publications" (from those lecturers). Both stay hidden until Stage 07 data exists.
- Public queries return only PUBLISHED records and only public-safe fields (see docs/DATA-MODEL.md). Static generation with generateStaticParams and on-demand revalidation. Safe fallback when the database is empty or unreachable.
- Metadata per page (title, description, Open Graph image from the cover). Breadcrumbs on every page. Semantic headings, correct image sizes and a priority image only where it is the LCP.
- Update the homepage research section and the header and footer links so they point to the real pages. Enable the "Programmes" and "Research" items in the admin sidebar.

5. TESTS
- Services: ordering and reordering edge cases (first, last, single item), slug generation and collisions, archive and restore, public queries exclude DRAFT and ARCHIVED, level slug mapping, the seed never overwrites admin edits (test by editing then re-running the seed).
- Permissions: a LECTURER-only and an ADMIN-only user get 403 on /admin/programmes and /admin/research. HOD and SUPER_ADMIN can edit.
- Sanitisation: a script payload in a body field is neutralised on save and on render.

6. PERFORMANCE
- Report First Load JS for the new public routes. The editor and admin code must not appear in public bundles, and the Stage 05 bundle-leak guard must still pass.

7. DOCS
- docs/PATTERNS.md: a short guide to the admin-to-public content pattern used here (service layer, revisions, audit, revalidation, public-safe selects, archive instead of delete, up and down ordering), so later stages follow the same steps.
- Add any new decisions to docs/DECISIONS.md. Update docs/CONTENT-EDITING.md with how to edit programmes and research areas, in plain language, no em dashes.

8. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: edit a programme and see it live on the public page, add and reorder specialisations, create a research area with an image, archive it and confirm it disappears and redirects, restore an earlier version, and confirm LECTURER-only gets 403.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 06 in docs/ROADMAP.md.
- Finish with: results of each step, what was imported and what was left as placeholder, the Statistics-split findings, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
