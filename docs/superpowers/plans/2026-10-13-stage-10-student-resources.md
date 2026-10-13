# Stage 10: Student Resources Implementation Plan

> Executed natively in-session, task by task, same as Stages 02-09 (see AUDIT.md). No subagent dispatch. A full `/security-review` runs at the end.

**Goal:** Students find the handbook, courses, academic calendar and downloads in one place; the department manages all of it from /admin. The contact form becomes safe and usable (inbox + hardening), since the alumni removal flow depends on it.

**Spec:** docs/prompts/10-student-resources.md

## Global constraints
- Never invent academic facts: no seeded courses, handbook text, calendar dates or downloads.
- Reuse: spam module pattern (src/server/services/alumni-spam.ts), rich text pipeline (sanitize-html.ts, rich-text-editor), PDF pipeline (lecturer-cv.ts pattern), ICS module (src/lib/ics.ts), text-search fold (src/lib/text-search.ts), PATTERNS.md's service-layer/revision/audit/revalidation conventions.
- searchText: strip HTML tags, NFKD-fold diacritics, lowercase, collapse whitespace - one shared helper, used identically for storage and query.
- No em dashes in docs/UI copy.

## Task 0: Contact inbox + hardening (do first - alumni depends on it)
- Add `contact.manage` permission (rbac.ts + matrix test + docs/AUTH.md).
- `src/lib/validators/contact.ts`: extend schema with spam fields (honeypot, formToken, formRenderedAt) like alumni's schema.
- `src/server/services/contact-spam.ts` OR reuse alumni-spam.ts's exported primitives directly (signFormTimestamp/verifyMinFillTime/checkHoneypot are generic already) + new contact-specific rate limiter and a duplicate-within-1-hour check (email+subject).
- `src/server/services/contact.ts`: add `listContactMessages`, `getContactMessageAdmin`, `setContactMessageStatus` (marks READ on open, audit-logged status changes), `resolveAlumniRefForMessage` (uses alumni-reference.ts's hash to find the matching AlumniEntry by recomputing the hash over candidate ids - needs a lookup helper; since the hash isn't reversible, iterate: actually simplest is to search AlumniEntry by id where alumniPublicReference(id) === ref - requires a full table scan reference match; acceptable at this data volume, implement as `findAlumniEntryByReference`).
- SiteSetting `contact.notificationEmail` (validated email, default "").
- `src/server/actions/contact.ts`: wire spam checks into submitContactMessageAction (mirrors alumni-submit.ts's pattern) + fire-and-forget notification email (no body).
- `/admin/messages` (list w/ filters+search, detail page, status actions) + dashboard card + sidebar item.
- `scripts/contact-purge-archived.ts` (dry-run default).
- Update draft privacy text (retention: 12 months after archiving).

## Task 1: Schema migration
- Course: `slug` unique, `programmeLevel ProgrammeLevel`, `isElective Boolean @default(false)`, `searchText String @default("")`.
- HandbookPage: `previousSlugs String[] @default([])`, `searchText String @default("")`, `summary String?`.
- Download: category stays a validated string (already untyped), add `uploadedById String?` + relation.
- AcademicCalendarEntry: `endDate` becomes optional (`DateTime?`).
- `students.manage` permission.
- `src/lib/search-text.ts`: shared normalize function with tests (Yoruba diacritics).
- Update docs/DATA-MODEL.md, docs/TIME.md (calendar entries are date-only), docs/AUTH.md.

## Task 2: Handbook
- `src/server/services/handbook.ts`: admin CRUD (2-level nesting enforced), reorder, archive/restore, slug-change pushes previousSlugs, searchText computed on save, public queries (listHandbookTreePublic, getHandbookPageBySlugPublic, findHandbookPageBySlugOrPrevious, searchHandbookPublic).
- `src/lib/markdown-to-html.ts`: minimal Markdown->HTML (headings, paragraphs, lists, bold/italic, links) + `$...$`/`$$...$$` -> the editor's `<span data-latex>` node shape, tested against XSS payloads (sanitized after conversion, same sanitizeRichText pipeline).
- `scripts/handbook-import.ts` + `docs/handbook-import/README.md` + `docs/handbook-import/SAMPLE-welcome.md`.
- Admin UI `/admin/handbook` (tree, add/edit/move/reorder/archive).
- Public `/students/handbook` + `/students/handbook/[slug]` (TOC from h2/h3, prev/next, breadcrumbs, print stylesheet, redirect via previousSlugs) + `?q=` search.

## Task 3: Courses
- `src/lib/validators/course.ts`: code normalization/validation, units/level bounds.
- `src/server/services/courses.ts`: CRUD, prerequisite self/cycle rejection (graph cycle check), reverse-prerequisite query, CSV import (dry-run/commit, 500-row cap), public queries.
- Admin UI `/admin/courses` (list+filters+CRUD, CSV import wizard).
- Public `/students/courses` (filters via query params, grouped by level) + `/students/courses/[slug]`.
- Enable hidden "Courses taught" block on `/lecturer/[slug]` and "Courses" block on `/programmes/[level]`.

## Task 4: Downloads
- `src/server/services/downloads.ts`: reuse PDF-verification logic pattern from lecturer-cv.ts (format/size/delivery checks), CRUD, reorder within category, replace-removes-old-asset.
- Admin UI `/admin/downloads`.
- Public `/students/downloads` grouped by category, CV category excluded.

## Task 5: Calendar
- `src/server/services/academic-calendar.ts`: CRUD, public listing grouped by session, ICS feed builder (all-day, DTSTART;VALUE=DATE, exclusive DTEND) built on src/lib/ics.ts's primitives (extend ics.ts with an all-day event variant rather than duplicating escaping logic).
- Admin UI `/admin/calendar`.
- Public `/students/calendar` + `/students/calendar/feed.ics`.

## Task 6: Students hub + nav
- Seed `students-intro` Page (PUBLISHED, neutral placeholder, flagged via pages.legalReviewFlags-style new key `pages.hodReviewFlags` or reuse importFlags pattern - use `pages.importFlags` since this is "needs HOD review" semantically, not legal).
- `/students` hub page: self-hiding cards.
- Enable Students in header/footer nav (seed), admin sidebar items, dashboard cards.

## Task 7: Tests
Per-task tests are written alongside each task above (TDD). Add cross-cutting permission tests (LECTURER-only 403 on every new admin route) and public serialization tests at the end of Task 2-5 respectively.

## Task 8: Docs
docs/STUDENTS.md, docs/CONTENT-EDITING.md additions, DECISIONS.md entries.

## Task 9: Verify
lint/typecheck/test/build, manual walkthrough, /security-review, AUDIT.md entry, ROADMAP.md tick.
