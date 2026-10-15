# STUDENTS.md

How the student resources modules (handbook, courses, downloads, academic calendar) and the
contact inbox work, for anyone maintaining this code later. See docs/prompts/10-student-resources.md
for the original spec and AUDIT.md's Stage 10 entry for what was built.

## Contact inbox

- `/admin/messages` lists every `ContactMessage`, filterable by status (NEW, READ, REPLIED,
  ARCHIVED) and type, with a search box. Opening a NEW message marks it READ automatically.
- "Reply" is a `mailto:` link only - this app never sends email to a submitter itself, and there
  is no auto-reply.
- An ALUMNI-type message has its reference extracted (`src/lib/alumni-reference.ts`'s
  `extractAlumniRef`, matching the exact "Alumni entry X" / "Reference: X" text the public alumni
  card's removal-request link prefills) and resolved back to the entry
  (`findAlumniEntryByReference`), so the admin can jump straight to `/admin/alumni/[id]` to
  withdraw or erase it. The entry's private email is shown next to the sender's email so the admin
  can verify they match before acting - see docs/ALUMNI.md's removal procedure.
- A `contact.notificationEmail` site setting (empty by default) triggers a short notification
  email on every new message, through the same Resend wrapper as every other email in this app
  (console fallback in development). The notification never includes the message body, only the
  sender's name, the type, and a link to the admin message - see `src/server/services/contact-notification.ts`.
  A send failure is caught and logged, never blocking the submission.
- Spam controls on the public form (`src/server/actions/contact.ts`) mirror the alumni
  submission form's: a honeypot, an HMAC-signed minimum fill time (`src/lib/form-spam.ts`, shared
  between alumni and contact), a per-IP rate limit, and a same-email-and-subject duplicate check
  within one hour. Every one of these returns the exact same calm success response as a genuine
  submission, without creating a row - a bot gets no signal about which check it failed, or that
  it failed at all. Only a genuine input problem (bad email, empty field) returns a real error.
- `npm run contact:purge-archived` (dry run by default, `--apply` to delete) permanently deletes
  ARCHIVED messages whose `updatedAt` (the moment they were archived) is more than 12 months old -
  the retention period the privacy notice commits to. Stage 14 is expected to schedule this.

## searchText normalisation

`src/lib/search-text.ts`'s `normalizeSearchText` is the one function that computes both a stored
`searchText` column (handbook pages, courses) and a search query's comparison value: strip HTML
tags (including a `<script>`/`<style>` block's content entirely), NFKD-fold diacritics (the same
Yoruba-diacritic coverage as `src/lib/text-search.ts`'s NFD fold, plus compatibility
decompositions NFD alone misses), lowercase, collapse whitespace. `searchText` is recomputed on
every save and is never selected in any public response - it exists only to be queried against.

## Handbook

- Two-level tree only (`HandbookPage.parentId`), enforced in `src/server/services/handbook.ts`:
  a page can be nested under a top-level page, but a page already nested cannot itself become a
  parent. Reordering swaps `order` with the adjacent sibling in the same `parentId` scope
  (PATTERNS.md's up/down convention).
- Changing a published page's slug pushes the old one into `previousSlugs`, which
  `findHandbookPageBySlugOrPrevious` uses for a 308 redirect - the same pattern as
  `LecturerProfile`/`NewsPost`/`Event`.
- The public detail page's table of contents (`src/lib/toc.ts`) is generated from the rendered
  HTML's own `h2`/`h3` tags and injects matching `id` attributes into them, so the TOC's links
  actually land somewhere; repeated heading text gets a numeric suffix to keep ids unique.
- Search (`/students/handbook?q=`) is self-contained for this stage (a future global-search stage
  will build something broader): it filters `PUBLISHED` pages by `searchText`, ranks a title match
  above a body-only match, and works without JavaScript (a plain GET form).
- A print stylesheet (`src/app/globals.css`'s `@media print` block, plus `print:hidden` on the
  table of contents and prev/next navigation) hides the site header, footer and breadcrumb trail
  when a handbook page is printed.

### Markdown importer

- `npm run handbook:import` (dry run by default, `--apply` to write) reads `.md` files from
  `docs/handbook-import/` (see that folder's own README for the front matter format) and creates
  `DRAFT` pages only.
- `src/lib/markdown-to-html.ts` is a small, hand-written Markdown-to-HTML converter (not a full
  CommonMark implementation - the handbook's content is plain structured text, so a full parser is
  more surface area than the job needs, the same reasoning DECISIONS.md #43 gives for ICS/RSS).
  Every character of the input is HTML-escaped before any markdown rule is applied, so a literal
  `<script>` in a source file can never become a real tag; a link's target is checked against an
  explicit scheme allowlist (`https`, `http`, `mailto`, or a relative path) before becoming a real
  `href`. The converter's output still passes through `sanitizeRichText` as a second, independent
  layer before being stored.
- `$...$` becomes an inline math span and `$$...$$` a display math span, in the exact
  `<span data-latex="..." data-display="...">` shape the rich text editor's own math node produces,
  so `renderRichText` renders imported math identically to hand-typed math.
- The importer never overwrites a page that already exists (matched by slug) - a re-run after an
  admin has edited a page skips that file and reports why, rather than touching it.
- `docs/handbook-import/SAMPLE-welcome.md` is a clearly marked sample file demonstrating the
  format end to end.

## Course catalogue

- `Course.code` is normalised to "MTH 101" form (`src/lib/validators/course.ts`'s
  `normalizeCourseCode`) regardless of how an admin or a CSV row writes it.
- Prerequisites are a self-referential many-to-many (`Course.prerequisites`/`requiredFor`).
  `src/server/services/courses.ts` rejects a course listing itself as its own prerequisite and
  walks the prerequisite graph to reject any cycle a proposed change would create, both on a
  single edit and across an entire CSV import batch.
- CSV import (`code,title,units,level,semester,programme,elective,prerequisites,description`,
  prerequisite codes separated by `;`, maximum 500 rows) is a two-step dry-run/commit flow
  (`src/lib/course-import.ts` for pure validation, `commitCourseImport` for the write): the dry
  run reports per-row errors (invalid code, duplicate within the file, unknown prerequisite code,
  a cycle entirely within the file, or a code that already exists), and the commit step creates
  every valid row as `DRAFT` first, then links prerequisites in a second pass so a row can
  reference a prerequisite defined later in the same file.
- The public catalogue (`/students/courses`) filters by programme/level/semester as plain URL
  query parameters (works without JavaScript) and groups results by level. A course's lecturer
  links only ever show published, active-account lecturers (the same visibility rule the staff
  directory and lecturer pages already use).
- The "Courses taught" block on `/lecturer/[slug]` and the "Courses" block on `/programmes/[level]`
  (placeholders left by Stage 07a/06) are now wired to real data.

## Downloads

- Reuses the Stage 07a PDF verification pattern (`src/server/services/lecturer-cv.ts`): format
  must be `pdf`, size capped (10MB here, vs the CV pipeline's 5MB), re-fetched from Cloudinary's
  own API rather than trusted from the client. `/api/downloads-signing` is a separate signing
  route from both `/api/upload-signing` (which only ever signs image formats) and
  `/api/lecturer-cv-signing` (which scopes the folder to one lecturer's own profile) - this one
  checks `students.manage` and signs into the single shared `oau-maths/downloads` folder.
- `CV` is excluded everywhere in this module (`listDownloadsAdmin`, `listDownloadsPublic`) - CV
  downloads are created only through the lecturer CV upload pipeline and must never appear in the
  general-purpose downloads listing.
- Replacing a file (`replaceDownloadFile`) registers the new upload first, then deletes the old
  Cloudinary asset - never the other way round, so a failed new upload never leaves the download
  with no file at all.
- Reordering swaps `order` with the adjacent sibling within the same `category`.

## Academic calendar

- `AcademicCalendarEntry.startDate`/`endDate` are calendar dates with no time-of-day and no
  timezone - see docs/TIME.md's "Academic calendar dates" section. There is no status field: an
  entry is either on the calendar or it isn't.
- The public page groups entries by `session`, with past entries (end date, or start date if no
  end date, before now) collapsed into a `<details>` disclosure per session.
- `/students/calendar/feed.ics` reuses `src/lib/ics.ts`'s escaping/folding exactly, through a new
  `generateAllDayIcsFeed` export: `DTSTART;VALUE=DATE` with no time component, and an exclusive
  `DTEND` (the day after the entry's own last day, or `startDate + 1` day when no `endDate` is
  given) - this is what RFC 5545 requires for an all-day event's end date.

## Students hub

`/students` is a Page record (slug `students-intro`, seeded `PUBLISHED` with a neutral
placeholder flagged for HOD review in `/admin/pages`) followed by a card per module - each card
hides itself when that module currently has no public content at all, so an empty catalogue or an
empty calendar never shows a dead link.
