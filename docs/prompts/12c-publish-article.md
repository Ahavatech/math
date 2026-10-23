# Stage 12c: Publish an accepted paper as an article

Branch: `stage/12c-publish-article`, from an updated `main`. Never push or merge.
Follow the Reporting rule in CLAUDE.md (9-part summary first, PR text last). Keep context lean: commit after each numbered step, paste short outputs only.
Never write "pre-existing", "unrelated" or "flaky" without reproducing on main in a worktree and pasting the result. Mocks are not proof: security and visibility proofs use the real test database with real rows.

## 0. Start
1. `git checkout main && git pull`, clean tree, `git checkout -b stage/12c-publish-article`, `npx prisma generate`.
2. Read CLAUDE.md, docs/SCOPE.md, docs/ROADMAP.md, docs/STATE.md, docs/DECISIONS.md, docs/JOURNAL.md, docs/AUTH.md, docs/DATA-MODEL.md, last 3 AUDIT.md entries.
3. Inspect the existing public journal code from Stage 11 (articles, issues, citation exports, JSON-LD, RSS, sitemap, public PDF handling) and the Stage 10 public file pipeline. REUSE them. Report in 10 lines what already exists and which models/routes this stage extends. Do not create parallel models.
4. Small carry-over from 12b, first commit: (a) a DB-backed test that a revision decision creates round N+1 and the author resubmission lands in it; (b) verify `journal:dev-fixture` create then `--remove` leaves zero rows (fix if not); (c) add to ROADMAP under Stage 13b/14: real HTTP curl verification of journal routes, manual browser checks, correct per-page First Load JS measurement (Turbopack does not print it; use a webpack build or the analyzer, and re-baseline against about 159 kB shared), the 22 lint warnings vs CI max-warnings, forgot-password and sendLecturerInvite timing under the full suite, and the reminder service script's server-only guard under tsx.

## 1. Decisions (record in docs/DECISIONS.md; if one conflicts with SCOPE or DECISIONS, stop and ask)
- Publication ends double-blind: the published article shows authors and affiliations. It never shows reviewer identity, reviews, decision letters, internal notes or private manuscript files. No open peer review.
- Only manuscripts with an ACCEPTED decision can be published. Publishing needs journal.editorial (SUPER_ADMIN, EiC, Editor) and the editor must not be conflicted with the manuscript (same COI rule). HOD read-only; ADMIN no access.
- Published metadata is a SNAPSHOT copied from the manuscript at publication (title, abstract, keywords, authors with order, affiliations, ORCID if present, corresponding author, subject area). Later edits to the manuscript do not change the article; edits to the article are editor actions with ContentRevision + AuditLog.
- The final published PDF is uploaded by the editor (typeset copy). It is stored in the public file pipeline, byte-identical (record sha256). The private manuscript files stay private forever.
- DOI is optional and entered manually by the editor (validated format 10.xxxx/...). No DOI minting in this stage.
- Retraction or removal never deletes: article status PUBLISHED, CORRECTED, RETRACTED; retracted articles keep their page with a notice and reason. Corrections add a dated notice.
- Reviewer acknowledgement: yearly list "Reviewers for {year}" shown only for reviewers who opted in (add `acknowledgementOptIn` boolean on ReviewerProfile, default false, reviewer sets it on their dashboard). Names only, no manuscript info.
- Continuous publication is supported: an article may be published into an issue or into "Articles in press / current volume".

## 2. Schema (one additive migration; read existing models first and extend)
Article (or extend existing): manuscriptId unique, slug unique, status (DRAFT, SCHEDULED, PUBLISHED, CORRECTED, RETRACTED), snapshot fields above, doi, articleNumber, pageRange, publishedAt, scheduledFor, licence (from JournalSettings), finalPdf reference + sha256, issueId nullable, retractionReason, notices (JSON or table: type, text, date). Issue/Volume: reuse Stage 11 models; ensure number, year, title, status DRAFT/PUBLISHED, publishedAt, ordering, optional cover image. ArticleAuthor rows (name, affiliation, orcid, isCorresponding, order). Manuscript status gains PUBLISHED via the state machine (extend manuscript-workflow.ts, do not bypass it). ReviewerProfile.acknowledgementOptIn.

## 3. Services (extend existing patterns: service layer, AuditLog, ContentRevision, revalidation)
- `article-publication.ts`: prepare from accepted manuscript (snapshot), validate (title, abstract, authors, final PDF present, licence set), schedule, publish (atomic: article status, manuscript status, ManuscriptEvent, revalidate, author email), unpublish to DRAFT only before first publish; after publish use correct/retract.
- Issues: create, edit, reorder articles within an issue (up/down), publish issue, archive.
- Notices: add correction, retract (reason required, audit-logged).
- Public-safe selects for every public query. A public query must be unable to return manuscript, review, assignment, decision or reviewer data.
- Author emails: "accepted, publication being prepared" and "your article is published" (link only, no abstract).

## 4. Pages
- Admin: `/admin/journal/articles` (list by status, prepare from accepted manuscripts, edit metadata, upload final PDF, assign to issue, schedule, publish, correct, retract), `/admin/journal/issues` (CRUD, ordering, publish). Accepted manuscripts show a "Prepare for publication" action on the manuscript page for eligible editors only.
- Public: `/journal/issues`, `/journal/issues/[volume]/[issue]`, `/journal/articles/[slug]` (title, authors, affiliations, abstract with math rendering, keywords, DOI link, licence, dates, how to cite, PDF download, notices), `/journal/reviewers/[year]` acknowledgement list, "Articles in press" listing. Reuse Stage 11 layout; no UI redesign (a UI pass comes later).
- SEO and indexing: JSON-LD ScholarlyArticle, Google Scholar tags (citation_title, citation_author, citation_publication_date, citation_journal_title, citation_volume, citation_issue, citation_pdf_url, citation_doi), canonical URLs, sitemap entries, RSS item per article, BibTeX and RIS downloads per article (extend the existing exports). Retracted articles stay indexable with the notice.

## 5. Tests (real test DB, unique per-run data, no global deletes)
State machine additions; only ACCEPTED can be prepared; conflicted editor, HOD and ADMIN blocked; snapshot independence (edit manuscript after publish, article unchanged); publish atomicity; final PDF sha256 equals upload; DOI validation; retract keeps page and adds notice; scheduled publish via script; DB-backed public leak test: with reviewers, reviews, decision letter, private files and internal events all present, serialize every public page's data, public API, RSS, sitemap, JSON-LD, citation meta and BibTeX/RIS, and assert none contains reviewer ids/names/emails, review text, decision letter, commentsToEditor, private storage keys or internal notes; acknowledgement list shows only opted-in names; emails contain no abstract; permissions matrix updated; dev-fixture covers an issue, a published article and removal.

## 6. Scripts and docs
- `scripts/journal-publish-scheduled.ts` (dry-run default, `--apply`, idempotent) for SCHEDULED articles; npm script `journal:publish-scheduled`. Add to the Stage 14 scheduled-jobs list.
- Docs: docs/JOURNAL.md (publication flow, states, public visibility table), docs/JOURNAL-EDITOR-GUIDE.md (plain language: accept, prepare, publish, correct, retract), AUTH.md, DATA-MODEL.md, STATE.md, ROADMAP tick for 12c.

## 7. Verify (paste real output)
Run the app and show real HTTP output: published article page and PDF download work for an anonymous visitor; the private manuscript file URL stays 404/401; an unpublished or draft article returns 404 publicly; a retracted article shows the notice; RSS, sitemap and citation exports contain the article and no private data; HOD and ADMIN cannot publish; a conflicted editor cannot publish; scheduled script dry run and `--apply` twice publish once. Build, measure First Load JS for the new public pages correctly (webpack build or analyzer) against main, and run the leak guard (no client chunk contains private-storage, argon2 or server-only services). Full suite twice, typecheck, lint, build.

## 8. Finish
Conventional commits, AUDIT.md entry (never edit old ones), then the 9-part summary with real counts and commit hashes, a coverage table for sections 1 to 7 (built and tested with test name, built but untested, missing), UI checks not done in a browser, then the PR text. Do not push.
