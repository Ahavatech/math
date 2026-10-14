# JOURNAL.md

What exists now (Stage 11), what Stage 12 adds, and the research behind the public side's two hardest requirements: Google Scholar indexing and private manuscript storage.

## What exists now

- **Settings** (`/admin/journal/settings`, `journal.manage`): name, short name, ISSN/e-ISSN, publisher, frequency, licence (CC BY 4.0 / CC BY-NC 4.0 / CC BY-SA 4.0 / All rights reserved / Custom), contact email, `submissionsOpen` (unused until Stage 12), a default "cite as" publisher string. Lives in the `SiteSetting` registry under the key `journal.settings`. Until a name is set, every public page falls back to "Departmental Journal" and the admin shows a banner asking the HOD/editor-in-chief to set the name, ISSN and licence first.
- **Pages** (`/admin/journal/pages`, `journal.manage`): four fixed `Page` rows (`journal-about`, `journal-guidelines`, `journal-call-for-papers`, `journal-policies`), rich text with math, seeded with a "Needs editor input." placeholder that is never shown publicly.
- **Editorial board** (`/admin/journal/board`, `journal.manage`): a member is either a linked, published `LecturerProfile` (name/photo/affiliation pulled live, disappears the moment the profile is unpublished or the account deactivated) or an external entry (name, affiliation, country, ORCID, an https-only URL, an optional photo). Ordered with up/down buttons, `isActive` toggle.
- **Issues and articles** (`/admin/journal/issues` and `/admin/journal/articles`, `journal.edit`): issues have volume/number/year/title/description/cover/status, unique `(volume, number)`, archived rather than deleted. Articles have title, rich-text abstract, up to 10 normalised/deduplicated keywords, up to 20 ordered authors (name/affiliation/ORCID/private email/optional lecturer link), an optional issue (no issue = "online first"), page range, type, DOI, licence (falls back to the journal default), received/accepted dates, a PDF, status and a slug auto-derived from the title until the article is first published, after which the slug is fixed. A title-blur check warns (never blocks) on a likely duplicate in the same issue. Publishing needs title, abstract, at least one author and a verified PDF - shown as a live checklist on the edit page.
- **Public pages**: `/journal`, `/journal/about|guidelines|call-for-papers|policies`, `/journal/editorial-board`, `/journal/issues` (+ `/journal/issues/[volume]/[number]`), `/journal/articles` (20/page, year/type filters, diacritic-insensitive server-side search), `/journal/articles/[slug]` (Scholar/Dublin Core/JSON-LD metadata, "how to cite" with APA/BibTeX/RIS, PDF button), `/journal/rss.xml` (latest 20 articles).
- **Visibility rule**: an article is public only when its own status is `PUBLISHED` and (it has no issue, i.e. online-first, or its issue is also `PUBLISHED`). Unpublishing an issue hides every article in it and 404s their PDF routes - computed at read time, never a stored flag.
- **Article PDFs**: reuse the Stage 07a signed-upload pattern into `oau-maths/journal/articles`, served from our own domain at `GET /journal/articles/[slug]/pdf` (never the raw Cloudinary URL). Draft/hidden articles, or ones whose issue was unpublished, 404.
- **Private storage and the manuscript file access policy** are built and tested now (see below) but have no UI yet - Stage 12 adds submission, review and the upload route that actually uses them.

## Google Scholar inclusion guidelines (fetched 2026-10-14, not from memory)

Source: `scholar.google.com/intl/en/scholar/inclusion.html`.

**Required meta tags** (a page missing any of these "will be processed as if they had no meta tags at all"):
- `citation_title` - the paper's title only, never the journal/book name.
- `citation_author` - one tag per author, each in a separate tag, no affiliations/degrees in the value.
- `citation_publication_date` - the real publication date (not a repository entry date), in `"YYYY/M/D"` form (unpadded - Scholar's own example is `"2010/5/12"`), or a bare year.

**Recommended for a journal article** (used here when the data exists): `citation_journal_title`, `citation_issn`, `citation_volume`, `citation_issue`, `citation_firstpage`, `citation_lastpage`. Dublin Core (`DC.*`) is explicitly a last resort ("work poorly for journal papers"), so this app emits the Highwire `citation_*` tags as primary and `DC.*` alongside them, never instead.

**PDF hosting**: `citation_pdf_url` must be an absolute URL "in the same subdirectory as the HTML abstract page" and must actually be linked from that page (an unlinked PDF "would be processed as a separate document without the meta tags"). PDFs should carry searchable text and, per Scholar's own recommendation, **not exceed 5MB**; avoid Type 3 fonts. `robots.txt` must not block the crawler, and articles should be reachable from the homepage within about ten simple HTML links.

**One article per page, no access barriers**: "each article and abstract in a separate HTML or PDF file", each with "its own unique URL"; the site must not require sign-in, software, or dismissing anything before the abstract is visible; the full text or complete abstract must be visible on the page itself, not only in meta tags.

**Page structure** (for sites without meta tags, used here as a secondary signal since this app does set the tags): title as the largest text in an `<h1>`/`<h2>`, authors nearby and slightly smaller, a bibliographic citation line near the title, sentence-case section headings, a "References" heading with formal citations in an `<ol>`.

### Where this app's build differs from the 5MB recommendation

Scholar's 5MB figure is crawling/indexing guidance, not a hosting requirement of this app's own. Academic PDFs with figures or scanned appendices routinely exceed 5MB, and the existing Cloudinary pipeline this stage reuses (Stage 07a's CV upload, Stage 10's downloads) already caps uploads well above that. This app's own cap for article PDFs is **10MB**, matching the downloads pipeline's ceiling rather than Scholar's narrower indexing preference - an editor uploading a larger, scanned or figure-heavy paper is not blocked by this app, even though Scholar itself may decline to index a PDF over 5MB. This is recorded as a decision (DECISIONS.md).

## Visibility rule (full statement)

`isArticlePublic(article)` (`src/server/services/journal-articles.ts`):

```
status === "PUBLISHED" AND (issue === null OR issue.status === "PUBLISHED")
```

Every public query, the PDF route, and the citation/metadata routes all re-derive this from the live `status` columns on every request - nothing is cached as a separate "is this visible" flag, so unpublishing an issue takes effect everywhere (list, detail, PDF, cite.bib/cite.ris) the moment it happens, with no revalidation lag beyond the page's own `revalidate = 300`.

## Citation formats

Hand-written, not a dependency, for the same reasoning DECISIONS.md already gives for ICS/RSS and the handbook's Markdown converter: the formats are simple enough that a dependency is more audit surface than the job needs, and the one real risk - a title or author name breaking the record's own delimiters (CRLF in RIS, unescaped braces in BibTeX) - is exactly the thing hand-rolled escaping gets right once.

- **APA**: `Surname, I., & Surname, I. (Year). Sentence-case title. Journal Name, Vol(Issue), pp-pp. https://doi.org/...` - omits any segment (volume/issue/pages/DOI) that is missing.
- **BibTeX** (`/journal/articles/[slug]/cite.bib`): escapes `% & _ { }` (never `$` or `^`, so LaTeX math in a title round-trips safely), strips control characters so a title cannot inject a second `@article{...}` entry.
- **RIS** (`/journal/articles/[slug]/cite.ris`): strict two-letter-code `  - ` line format, CRLF line endings per the RIS spec, control characters stripped from every field so a value cannot inject a new tag line.

## Private storage design (for Stage 12)

`src/lib/private-storage.ts`: a small `{ put, openRead, remove, exists }` interface, with a local-disk implementation rooted at `PRIVATE_STORAGE_DIR` (required in production, defaults to `./.private-storage` in development - both outside the web root and the Next.js `public/` folder).

- **Keys**: 32 random bytes, base64url, sharded into two 2-character directory levels (`ab/cd/efgh...`). Always server-generated; `resolveStorageKeyPath` additionally rejects any key that is absolute, contains `..`, a backslash, a colon, or a null byte, or does not have exactly three URL-safe-base64 segments - defence in depth even though a key is never taken from user input.
- **Writes**: stream to a temp file (`<key>.<random>.tmp`) while computing sha256 and size, enforcing a max-size cap mid-stream (default 25MB) so an oversized upload is rejected without ever finishing the write; verify the declared kind against the temp file's actual bytes; `chmod 0600` where the OS supports it (a no-op on Windows); atomic `rename` into place. A failed put always removes the temp file.
- **Content verification**: PDF (`%PDF-` magic bytes), DOCX (ZIP signature plus a raw substring search for `word/document.xml` - zip entry names are stored as plain text in the format, so this needs no zip-parsing dependency), ZIP (signature only, for supplementary files), TEX (rejected if it contains a null byte, i.e. is not plain text). Everything else - executables, HTML, SVG, a double extension - is rejected.
- **Streaming response helper**: not yet a shared function for Stage 11 (only one route uses it so far, `/api/journal/files/[fileId]`) - `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, no `Range` support.
- **Orphan script**: `npm run private-storage:orphans` (dry run by default, `--apply` to delete) lists files on disk no `ManuscriptFile` row references, and rows whose file is missing. Stage 14 is expected to schedule this (e.g. a daily cron job) and include `PRIVATE_STORAGE_DIR` in backups.

## Manuscript file access policy (for Stage 12)

`src/server/services/manuscript-access.ts`'s `canReadManuscriptFile`/`canDownloadAs` are pure functions over a role/relation description, never a database call themselves - `src/server/services/manuscript-file-download.ts` loads the real rows and delegates to them. The policy checks **role membership directly** (`hasRole`), not `hasPermission`: HOD and ADMIN hold `journal.edit`/`journal.manage` for issues/settings, but that must never silently grant manuscript access, so the check deliberately bypasses the permission layer for this one decision.

| Caller | Access |
|---|---|
| SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR | Any file, any kind, any round |
| HOD, ADMIN (without also holding a journal editor role) | None |
| AUTHOR | Any file of a manuscript they submitted (`submittedById`), any round |
| REVIEWER | Only through their own `ReviewAssignment` with status `ACCEPTED` or `SUBMITTED`, only that assignment's round, only kinds `MANUSCRIPT`/`SUPPLEMENTARY`/`REVISED`/`RESPONSE_TO_REVIEWERS` - never `COPYEDITED`, never another round. `INVITED`/`DECLINED`/`EXPIRED` assignments grant nothing. |
| Everyone else, or a deactivated user | None |

`canDownloadAs` additionally decides the filename shown: a reviewer always gets `manuscript-round-N.pdf` (blind review - even the filename could reveal the author), everyone else with access sees the real stored name.

`GET /api/journal/files/[fileId]`: requires a session, applies the policy, rate-limits (30/min per user), streams through private storage, writes one `AuditLog` row per successful download (actor id and file id only, never a name or filename). A file the caller may not see and a `fileId` that does not exist both return **404**, identically - this route never reveals existence via a 403.

`npm run journal:dev-fixture` (refuses to run with `NODE_ENV=production`): creates one `[DEV FIXTURE]`-tagged manuscript with a file, an author, an accepted reviewer assignment, an unassigned reviewer and an editor, so the policy can be checked by hand against a running app. `--remove` deletes everything it created, including the file and its now-empty shard directories.

## Backup and orphan procedure

- `PRIVATE_STORAGE_DIR` must be included in whatever backup job Stage 14 sets up for the database - a `ManuscriptFile` row with no corresponding file on disk is unrecoverable.
- `npm run private-storage:orphans` should run on the same schedule as the existing `alumni:cleanup-orphans`/`alumni:purge-rejected`/`contact:purge-archived` scripts (docs/ROADMAP.md's Stage 14 entry already lists those three; this one joins them).

## What Stage 12a adds

Stage 12a adds the author-facing submission workflow and the editor screening tools. After this stage:

- Authors can register at `/journal/register` (submissionsOpen must be true), verify their email, sign in, and access `/journal/dashboard`. Registration uses a 24-hour single-use EMAIL_VERIFY token.
- A verified author creates a manuscript draft and completes the 5-step submission wizard: (1) article type/title/abstract/keywords, (2) authors with ORCID validation, (3) files and anonymisation confirmation, (4) author agreement (JOURNAL_AUTHOR_AGREEMENT_V1, stored version+timestamp), (5) review and submit. Server-side autosave after each step. Works without JavaScript (server actions with redirects). Mobile-first.
- On final submission: reference number assigned (MS-YYYY-NNNN, atomic JournalCounter), ManuscriptRound 1 created, status changes from INCOMPLETE to SUBMITTED, confirmation email sent to author (reference only), notification sent to editors (reference + link, no title).
- Authors track their submissions on `/journal/dashboard` with plain-language statuses and can withdraw pending submissions.
- Editors access `/admin/journal/manuscripts` (gated by `journal.manuscripts.read`). They can: assign a handling editor, return for technical fixes (message required), desk-reject (letter required, stored as EditorialDecision DESK_REJECT), or approve for peer review. Only the EiC and the handling editor may desk-reject or approve. The HOD sees the list and detail but has no action controls.
- Conflict of interest: a user who submitted or is an author on a manuscript gets no editorial or read access to it (list, detail, files), regardless of roles (DECISIONS.md #59). Every SUPER_ADMIN/HOD detail-page or file read is audit-logged (ids only).
- `npm run journal:purge-drafts` (dry run by default, `--apply`): deletes INCOMPLETE drafts untouched for 60 days with their files. Submitted manuscripts are never selected.
- Email templates (React Email, plain text, no em dashes): verification, already-registered, submission-received, new-submission-to-editors, returned-to-author, decision-available, moved-to-review. Reference and sign-in link only — never title, author name, abstract, filename or letter body.

### Updated manuscript file access policy

| Caller | Access | Audit required |
|---|---|---|
| SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR (not conflicted) | Any file, any kind, any round | SUPER_ADMIN: yes |
| HOD (not conflicted, not in editorial roles) | Any file, any kind, except TITLE_PAGE — read only, no actions | yes |
| AUTHOR (own manuscript) | Any file of their own manuscript, any round | no |
| REVIEWER | Only their assigned round, only MANUSCRIPT/SUPPLEMENTARY/REVISED/RESPONSE_TO_REVIEWERS — never TITLE_PAGE | no |
| Conflicted user (submitter or email-matching author), ADMIN, inactive user | None — 404 identical to not-found | no |

## What Stage 12 will add (original note)

- Author registration/login against the existing `AUTHOR` role and manuscript submission UI, writing through `private-storage.ts` for the first time.
- Editor screening, reviewer invitation/accept/decline, review reports and recommendations, editorial decisions per round - all against the `Manuscript`/`ManuscriptRound`/`ReviewAssignment`/`Review`/`EditorialDecision` models that already exist in the schema (Stage 02).
- The actual upload route for manuscript files (this stage builds only the *download* side).
- `submissionsOpen` (already in `journal.settings`) gating the "Submit a manuscript" button on `/journal`, which this stage keeps hidden regardless of that setting since the route does not exist yet.
- Email notifications at each workflow step (Resend, per docs/SCOPE.md's module C).
