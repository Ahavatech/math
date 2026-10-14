Read CLAUDE.md, docs/SCOPE.md (section C), docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/MEDIA.md, docs/PATTERNS.md, docs/TIME.md, docs/STUDENTS.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 11. Save this exact prompt as docs/prompts/11-journal-public.md.

PRE-CHECK
- Stage 10 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/11-journal-public from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for the storage module, the file access policy, citation and metadata generation, visibility rules and permissions. Follow docs/PATTERNS.md and docs/DESIGN.md and reuse existing components (rich text editor and math, PDF upload pipeline, CloudImage, renderRichText, revisions, audit, revalidation, ICS and RSS helpers where relevant). Do not reopen decisions in DECISIONS.md. Never invent journal facts: do not seed an ISSN, a journal name, editors, issues or articles. Run /security-review at the end and fix every real finding.

GOAL
The journal's public home exists and the department can publish issues and articles (including back-catalogue papers) from /admin. Separately, the private storage layer and the file access policy for confidential manuscripts are built and tested now, so Stage 12 (submission and peer review) can use them. No author submission, reviewer or editor workflow in this stage.

1. PERMISSIONS
- journal.manage: journal settings, pages, editorial board. Held by SUPER_ADMIN, HOD and JOURNAL_EDITOR_IN_CHIEF.
- journal.edit: issues and articles. Held by the same roles plus JOURNAL_EDITOR.
- ADMIN holds neither unless they also hold a journal role. Reason: editorial independence. Record this as a decision for the HOD to confirm.
- Update rbac.ts, the full matrix test and docs/AUTH.md. Sidebar group "Journal" shows only what the role may open. A user with only a journal role gets a minimal admin shell like the lecturer one (Journal items, Change password, Sign out).

2. JOURNAL SETTINGS (/admin/journal/settings, permission journal.manage)
- A typed settings section using the Stage 05 registry: journal name, short name, ISSN (validated format NNNN-NNNN with check digit, optional), e-ISSN (optional), publisher text, frequency text, article licence (a controlled list: CC BY 4.0, CC BY-NC 4.0, CC BY-SA 4.0, All rights reserved, plus a custom text option), licence URL, contact address for the journal (validated email, optional, shown publicly only if filled), submissionsOpen Boolean default false (Stage 12 will use it), "Cite as" default publisher string.
- Until a journal name is set, public pages use the neutral fallback "Departmental Journal", and the admin shows a banner "Set the journal name, ISSN and licence before announcing the journal".
- Revisions, version history, audit, revalidation.

3. JOURNAL PAGES (/admin/journal/pages, permission journal.manage)
- Page records with slugs journal-about (aims and scope), journal-guidelines (author guidelines), journal-call-for-papers, journal-policies (peer review policy, ethics, open access, copyright). Rich text editor with math, status, preview. Seed neutral placeholders marked "Needs editor input" in the admin only. Never show placeholders publicly: a page whose body is empty or still a placeholder hides itself.

4. EDITORIAL BOARD (/admin/journal/board, permission journal.manage)
- Members: choose a published lecturer profile (name, photo, affiliation pulled live) OR enter an external member (name, affiliation, country, optional ORCID with checksum validation, optional URL https only, optional photo with alt). Role title (Editor-in-Chief, Associate Editor, Editorial Board Member, Advisory Board Member, or custom), order with up and down buttons, isActive.
- Public queries show active members only. If a linked lecturer is unpublished or deactivated, the member disappears from the public board. Never expose a login email.

5. ISSUES AND ARTICLES (/admin/journal/issues and /admin/journal/articles, permission journal.edit)
- Issues: volume, number, year, optional title and description, cover image (alt required), status DRAFT, PUBLISHED or ARCHIVED, publishedAt. Unique volume and number. Archive instead of delete. A published issue cannot be deleted. Show the number of articles.
- Articles: title, abstract (rich text with math, sanitised), keywords (up to 10, normalised and deduplicated), authors (up to 20, each with name, affiliation, optional ORCID with checksum, optional private email, order with up and down buttons, optional link to a lecturer profile), issue (optional, "online first" allowed), page range, article type (Research article, Review, Short communication, Other), received and accepted dates (date only, optional, shown publicly if present), DOI (validate the format 10.xxxx/..., optional, shown as a https://doi.org/ link; do not claim to register DOIs), licence (defaults from settings, overridable), PDF (see section 6), status, publishedAt, slug (auto from the title, unique, editable until first publication, old slugs redirect 308 via previousSlugs, add the column if missing).
- Visibility rule: an article is public only when its status is PUBLISHED and its issue (if any) is PUBLISHED. Unpublishing an issue hides its articles. Test this thoroughly.
- Duplicate guard: warn on an existing article with the same normalised title in the same issue.
- Revisions, audit, version history, revalidation of the article, issue, journal home and archive pages.
- Publishing requires: title, abstract, at least one author, PDF uploaded and verified. Show a checklist.

6. ARTICLE PDFS (public, follows DECISIONS #4)
- Reuse the Stage 07a PDF pipeline (signed direct upload to Cloudinary, PDF only, folder oau-maths/journal/articles). Use the size limit recorded in docs/MEDIA.md. If journal articles may reasonably exceed it, stop and tell me before building a workaround.
- Before building, fetch Google Scholar's current inclusion guidelines (https://scholar.google.com/intl/en/scholar/inclusion.html) and record what they require for citation meta tags and for where the PDF must be hosted. Summarise in docs/JOURNAL.md. Do not rely on memory.
- Serve each published article's PDF from our own domain through GET /journal/articles/[slug]/pdf, which checks visibility, streams the file from Cloudinary with Content-Type application/pdf, Content-Disposition inline with a clean filename (Surname-Year-ShortTitle.pdf), X-Content-Type-Options nosniff and a sensible public Cache-Control. Use this URL for the download button and for citation_pdf_url. Never reveal the raw Cloudinary URL in public HTML. Draft or hidden articles return 404 for this route.
- Replacing a PDF removes the old asset when unused. Verify format and size on the server after upload, as in the CV pipeline.

7. PUBLIC PAGES
- /journal: journal name and short description, latest issue, latest articles (6), call for papers (if published), buttons for About, Guidelines, Editorial board and Archive. The "Submit a manuscript" button appears only when submissionsOpen is true AND Stage 12's route exists (for now keep it hidden). Hide any empty block.
- /journal/about, /journal/guidelines, /journal/call-for-papers, /journal/policies: render the Page records, hide when empty. A nav strip inside /journal for these.
- /journal/editorial-board: grouped by role, ordered. 
- /journal/issues: archive grouped by year, newest first, with cover and article count. /journal/issues/[volume]/[number]: issue details and article list (title, authors, pages, type, PDF link). Redirect nothing else, 404 for hidden issues.
- /journal/articles: all published articles, newest first, 20 per page, filter by year and type, server-side keyword and title search (diacritic insensitive, using normalised text, works without JavaScript).
- /journal/articles/[slug]: title, authors with affiliations (ORCID links with rel="noopener noreferrer"), abstract (renderRichText), keywords as links to the filtered list, dates, DOI, licence badge with link, issue link, PDF button, "How to cite" block (see below), "Share" via plain links only (no third party scripts).
- How to cite: generate in-house with tests. Show an APA-style string. Provide /journal/articles/[slug]/cite.bib (BibTeX) and /journal/articles/[slug]/cite.ris (RIS) as downloadable files with correct escaping (BibTeX special characters, LaTeX in titles preserved safely, RIS line formats, CRLF injection protected).
- Google Scholar and indexing metadata on every article page: citation_title, citation_author (one tag per author), citation_publication_date, citation_journal_title, citation_issn when present, citation_volume, citation_issue, citation_firstpage and citation_lastpage when present, citation_doi when present, citation_pdf_url, citation_abstract_html_url, citation_keywords, citation_language. Follow the guidelines you fetched. Add schema.org ScholarlyArticle JSON-LD (escape < as < as in earlier stages). Add Dublin Core tags (DC.title, DC.creator, DC.date, DC.identifier). Test the generated tags, including a title with LaTeX, a name with Yoruba diacritics and an abstract with quotes.
- /journal/rss.xml: latest 20 published articles, well-formed, escaped, tested.
- All public queries use explicit select with public-safe fields. NEVER select author emails, submittedById, internal notes, manuscript data or Cloudinary raw URLs. Add serialisation tests.
- Metadata, Open Graph, breadcrumbs everywhere, static generation with on-demand revalidation, safe fallback when the database is unreachable, no hydration mismatches. Enable "Journal" in header and footer navigation through data (it exists in the seeded navigation, make sure it points to /journal).

8. PRIVATE STORAGE (for Stage 12, built and tested now)
- src/lib/private-storage.ts with a small interface (put, openRead, remove, exists) and a local-disk implementation rooted at PRIVATE_STORAGE_DIR. PRIVATE_STORAGE_DIR is required in production (update env.ts) and defaults to ./.private-storage in development. It must be outside the web root and the Next.js public folder.
- Storage keys are generated server-side (random, 32 bytes base64url, sharded into two-level directories). Never derive a path from user input. Reject any key that resolves outside the root (path traversal, symlinks, absolute paths, null bytes). Tests with hostile inputs.
- Writes are atomic (temporary file then rename), directories mode 0700 and files 0600 where the OS supports it. Compute and return sha256 and size while streaming. Enforce a maximum size per call (parameter, default 25 MB). Never load whole files into memory: use streams.
- Content verification on put: allowed kinds are PDF (check %PDF magic bytes), DOCX (zip signature and presence of word/document.xml), and TEX or ZIP supplementary files as a small allowlist; reject everything else, including executables, HTML, SVG and double extensions disguised as allowed types. The original filename is stored only as metadata, sanitised, never used in a path.
- A reusable streaming response helper for private files: Content-Disposition attachment, X-Content-Type-Options nosniff, Cache-Control private, no-store, Content-Length, no Range support for now.
- npm script private-storage:orphans (dry run by default, --apply to delete): lists files on disk not referenced by any ManuscriptFile row and rows whose file is missing. Document that Stage 14 schedules it and includes the directory in backups.

9. FILE ACCESS POLICY (for Stage 12, built and tested now)
- src/server/services/manuscript-access.ts: canReadManuscriptFile(user, file) and canDownloadAs(user, file) returning allowed or denied plus the display filename. Rules:
  - SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF and JOURNAL_EDITOR: may read any manuscript file. HOD and ADMIN get NO access to manuscripts unless they also hold a journal editor role (editorial confidentiality). Record this as a decision.
  - AUTHOR: may read files of manuscripts they submitted (submittedById), all rounds, but never reviews or editor-only material.
  - REVIEWER: may read files of a manuscript only through a ReviewAssignment with status ACCEPTED or SUBMITTED, only for the round of that assignment, and only kinds MANUSCRIPT, SUPPLEMENTARY, REVISED and RESPONSE_TO_REVIEWERS. Never COPYEDITED files and never other rounds. INVITED, DECLINED and EXPIRED assignments get no access. Reviewers see a generic display filename (manuscript-round-N.pdf), never the original filename (blind review).
  - Everyone else: denied. Deactivated users: denied.
- A route GET /api/journal/files/[fileId] that requires a session, loads the ManuscriptFile, applies the policy, streams through the private storage helper and writes an AuditLog entry per successful download (actor id, file id, no filenames or names). Rate limit downloads per user. Return 404 (not 403) for files the user may not see, so existence is not leaked.
- No upload route or submission UI in this stage. Add a dev-only script journal:dev-fixture (refuses to run in production) that creates one clearly marked fixture manuscript with a file, an author, a reviewer assignment and an editor so access can be checked by hand, and journal:dev-fixture --remove deletes everything it created.
- Tests: full matrix (every role and relation, every file kind, every assignment status, wrong round, deactivated user, HOD without an editor role, cross-author access), filename blinding, 404 behaviour, audit entry content, rate limit, hostile fileId values.

10. TESTS (beyond those above)
- Settings validation (ISSN checksum, licence list). Board visibility rules including unpublished lecturers. Issue and article visibility rule combinations. Slug and redirect behaviour. Publishing checklist. Keyword normalisation. DOI and ORCID validators. Citation formats (APA, BibTeX, RIS) with special characters, Yoruba names and LaTeX. Scholar and Dublin Core tags. RSS well-formedness. Search with diacritics. XSS payloads in abstract and title. Permissions: LECTURER-only gets 403 on /admin/journal routes, ADMIN gets 403 unless it also holds a journal role, journal-only roles get the minimal shell and cannot open other admin routes.
- Bundle-leak guard must still pass. Report First Load JS for /journal and /journal/articles/[slug].

11. DOCS
- docs/JOURNAL.md: what exists now, Scholar findings, visibility rules, citation formats, storage design, access policy table, backup and orphan procedure, what Stage 12 will add. Update docs/CONTENT-EDITING.md with "Set up the journal", "Add the editorial board", "Publish an issue and articles" in plain language, no em dashes. Add decisions to docs/DECISIONS.md (journal.manage vs journal.edit, editorial confidentiality, same-domain PDF route, private storage on disk). Update docs/AUTH.md and docs/DATA-MODEL.md.

12. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: set the journal settings, add a board with one lecturer and one external member, create an issue, create an article with two authors, a math abstract and a PDF, publish it, view every public page at phone width, view the page source and confirm the Scholar tags, open the PDF route and confirm the PDF opens from our domain and the page source never shows a raw Cloudinary URL, download the .bib and .ris files and import one into a reference manager if available, unpublish the issue and confirm the article and its PDF route 404, confirm a LECTURER-only user and an ADMIN-only user get 403 on /admin/journal, and run journal:dev-fixture then check the file route as: the author (allowed), another user (404), the assigned reviewer (allowed, generic filename), an unassigned reviewer (404), an editor (allowed), HOD without an editor role (404). Then run journal:dev-fixture --remove and confirm nothing remains on disk or in the database.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 11 in docs/ROADMAP.md.
- Finish with: results of each step, the Scholar findings, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
