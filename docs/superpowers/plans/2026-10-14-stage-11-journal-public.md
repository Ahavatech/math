# Stage 11 plan: Journal public side + private storage/access policy

## Scope confirmed
Public journal (settings, pages, board, issues, articles, citations, Scholar/DC/JSON-LD meta, RSS) +
PDF route reusing the Stage 07a pipeline, plus private storage and manuscript access policy built
and tested now for Stage 12. No submission/review UI.

## Schema changes (one migration)
- `Article`: add `previousSlugs String[] @default([])`, `type ArticleType @default(RESEARCH_ARTICLE)`,
  `receivedAt DateTime? @db.Date`, `acceptedAt DateTime? @db.Date`.
- `EditorialBoardMember`: add external-member fields `affiliationCountry String?`, `orcid String?`,
  `externalUrl String?`, `photoId String?` (+ MediaAsset relation), `isExternal Boolean @default(false)`
  (true when `lecturerProfileId` is null and the row is a manually entered member).
- No new top-level models needed: JournalIssue/Article/ArticleAuthor/EditorialBoardMember/Manuscript*
  already exist from Stage 02. Journal settings live in the existing SiteSetting registry (keys
  `journal.settings`). Journal pages reuse the existing `Page` model (slugs `journal-about` etc.),
  same as every other Page-backed section.
- `ManuscriptFile.storageKey` already exists and is never a URL - private-storage.ts writes there.

## New permission
`journal.manage` (SUPER_ADMIN, HOD, JOURNAL_EDITOR_IN_CHIEF). `journal.edit` gains JOURNAL_EDITOR
(already there) - no role change needed for journal.edit's existing set beyond confirming it. ADMIN
gets neither (decision, confirm in DECISIONS.md for HOD).

## Build order (test-first where the prompt requires it)
1. rbac.ts + matrix test + docs/AUTH.md.
2. env.ts: PRIVATE_STORAGE_DIR required in production, default `./.private-storage` in dev.
3. src/lib/private-storage.ts + tests (hostile keys, atomic write, sha256/size, content verification,
   streaming response helper).
4. src/server/services/manuscript-access.ts + tests (full role/relation matrix).
5. src/lib/validators/journal.ts: ISSN checksum, ORCID checksum, DOI format, licence enum, keyword
   normalisation, article input schema, settings schema.
6. src/lib/citation.ts: APA string, BibTeX, RIS generators + tests (special chars, Yoruba names, LaTeX).
7. src/lib/journal-meta.ts: Scholar citation_* tags, Dublin Core, schema.org JSON-LD + tests.
8. Migration + schema.prisma changes, DATA-MODEL.md update.
9. Services: journal-settings (registry entries), journal-pages (reuse Page service patterns),
   journal-board, journal-issues, journal-articles (slug/previousSlugs, visibility, duplicate guard,
   publishing checklist).
10. Article PDF: downloads-signing-style route scoped to journal.edit, folder oau-maths/journal/articles,
    reuse the CV/downloads verification pattern. Public PDF stream route with visibility check.
11. Admin UI: /admin/journal/settings, pages, board, issues, articles (+ new/edit/import-free CRUD,
    reorder, checklist), sidebar group gating, minimal-shell for journal-only roles.
12. Public UI: /journal, /journal/about|guidelines|call-for-papers|policies, /journal/editorial-board,
    /journal/issues(+[volume]/[number]), /journal/articles(+[slug], cite.bib, cite.ris, pdf),
    /journal/rss.xml. Nav "Journal" -> /journal.
13. journal:dev-fixture script (+ --remove), private-storage:orphans script.
14. GET /api/journal/files/[fileId] route.
15. Docs: docs/JOURNAL.md, CONTENT-EDITING.md additions, DECISIONS.md entries, DATA-MODEL.md/AUTH.md
    updates (done incrementally alongside each piece above).
16. Full test suite, lint, typecheck, build, bundle-leak guard, First Load JS for /journal and
    /journal/articles/[slug].
17. Manual verification walkthrough per the prompt's section 12 checklist.
18. /security-review, fix findings, AUDIT.md entry, ROADMAP.md tick.

## Decisions to record
- journal.manage vs journal.edit split, ADMIN excluded from both (editorial independence).
- Editorial confidentiality: HOD/ADMIN get no manuscript file access without a journal editor role.
- Same-domain PDF route (never expose raw Cloudinary URL) for Scholar crawlability + decision #4.
- Private storage on local disk (PRIVATE_STORAGE_DIR, atomic writes, sharded random keys).
- Journal article PDF size cap: 10MB (matches the existing downloads/CV Cloudinary pipeline ceiling,
  Scholar's own 5MB *recommendation* is softer guidance, not a hosting requirement - noted in JOURNAL.md).
