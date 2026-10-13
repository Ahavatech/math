Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/MEDIA.md, docs/PATTERNS.md, docs/TIME.md, docs/ALUMNI.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 10. Save this exact prompt as docs/prompts/10-student-resources.md.

PRE-CHECK
- Stage 09 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/10-student-resources from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for services, importers, search normalisation, prerequisite rules, ICS and permissions. Follow docs/PATTERNS.md and docs/DESIGN.md and reuse existing components, the spam module, the rich text pipeline and the PDF upload pipeline. Do not reopen decisions in DECISIONS.md. Never invent academic facts: do NOT seed any courses, handbook text, calendar dates or downloads. Run /security-review at the end and fix every real finding.

GOAL
Students can find the handbook, courses, the academic calendar and forms in one place, and the department can manage all of it from /admin. The contact form also becomes safe and usable, because alumni removal requests depend on it.

0. CONTACT INBOX AND CONTACT FORM HARDENING (do first)
- New permission contact.manage held by SUPER_ADMIN, HOD and ADMIN. Update rbac.ts, the matrix test and docs/AUTH.md.
- /admin/messages: list with status (NEW, READ, REPLIED, ARCHIVED) and type filters, search, detail view, status changes with audit entries. "Reply" is a mailto: link only. The app never sends email to submitters. Opening a NEW message marks it READ.
- If a message has type ALUMNI and a ref, resolve the public reference and link to that entry in /admin/alumni so the admin can withdraw or erase it. Show the entry's private email next to the message email so the admin can verify they match.
- Notify the department of new messages: add a SiteSetting "Contact notification address" (validated email, empty by default). When set, send a short Resend email with the sender's name, the type and a link to the admin message. Never include the message body. Failure must never block the submission. Dev uses the console fallback.
- Harden the public /contact form with the existing spam module: honeypot, HMAC-signed minimum fill time, per-IP rate limit (5 per hour), same-email-and-subject duplicate rejection within 1 hour, maximum lengths, plain text only, valid email. No auto-reply. Same calm success message whether or not a check silently failed.
- Update the draft /privacy text to mention contact form messages and that messages are kept for 12 months after archiving. Add script contact:purge-archived (dry run by default, --apply) for ARCHIVED messages older than 12 months. Document that Stage 14 schedules it.
- Dashboard card "New messages". Sidebar item Messages.

1. SCHEMA (one migration, tests included)
- Course: add slug (unique, derived from the code, for example "mth-101"), programmeLevel (BSC, MSC, PHD, required), isElective Boolean default false, searchText String (normalised, see below). Keep prerequisites and lecturers as implicit many-to-many relations.
- HandbookPage: add previousSlugs String[], searchText String, summary String?.
- Download: ensure category supports CV, HANDBOOK, FORM, GUIDELINE, TIMETABLE, OTHER (extend the existing enum or string safely). Add uploadedById if missing.
- AcademicCalendarEntry: dates are calendar dates (no time, no timezone). Record this in docs/TIME.md.
- searchText rule: strip HTML, fold diacritics (NFKD and Yoruba marks), lowercase, collapse spaces, computed in the service on every save. Search queries are normalised the same way.
- New permission students.manage held by SUPER_ADMIN, HOD and ADMIN, covering handbook, courses, downloads and calendar. Update rbac.ts, the matrix test and docs/AUTH.md.
- Update docs/DATA-MODEL.md.

2. HANDBOOK
- /admin/handbook: tree of pages, maximum two levels, add, edit, move under a parent, reorder with up and down buttons, archive and restore. Fields: title, slug (auto, unique, editable, old slugs go to previousSlugs and redirect 308), summary, rich text body (existing editor with math), status. Revisions, audit, version history and revalidation as in the pattern.
- Importer: npm script handbook:import that reads Markdown files from a folder (default docs/handbook-import/) with front matter (title, slug, parent, order, summary). Dry run by default (--apply to write). Converts Markdown to HTML, converts $...$ and $$...$$ into the existing math nodes, sanitises with the existing allowlist, creates DRAFT pages only, never overwrites a page an admin has edited (skip and report). Create docs/handbook-import/README.md with the format and one clearly marked SAMPLE file. Tests for conversion, math, sanitisation of script payloads, nesting and no-overwrite.
- Public /students/handbook (start page with the tree and a prominent "Download the handbook PDF" button, shown only if a Download with category HANDBOOK exists) and /students/handbook/[slug]: sidebar tree on desktop, collapsible on mobile, automatic table of contents from h2 and h3 headings, previous and next links, "Last updated" date, breadcrumbs, renderRichText, print stylesheet. Old slugs redirect.
- Handbook search on /students/handbook?q= using searchText (server rendered, works without JavaScript, diacritic insensitive, title matches ranked first, snippets with the match highlighted safely). Stage 13 will build global search later, so keep this self-contained.

3. COURSE CATALOGUE
- /admin/courses: list with filters (programme, level, semester, status), search, create, edit, archive and restore. Fields: code (normalise to "MTH 101", validate letters plus three digits), title, units (1 to 12), level (100 to 900), semester (FIRST or SECOND), programmeLevel, isElective, description (rich text), prerequisites (multi-select of other courses, must reject itself and any cycle, with tests), lecturers (multi-select of published lecturer profiles), status. Revisions, audit, revalidation.
- CSV import: columns code, title, units, level, semester, programme, elective, prerequisites (codes separated by ;), description. Maximum 500 rows. Step 1 dry run with valid rows, errors, duplicates, unknown prerequisite codes and cycles. Step 2 commit creates DRAFT courses and links prerequisites after all rows exist. Never overwrites an existing course. Per-row results.
- Public /students/courses: table with code, title, units, level, semester, with filters by programme, level and semester as URL query parameters (works without JavaScript), plus search by code or title (diacritic insensitive). Group by level. Print stylesheet. Empty state.
- /students/courses/[slug]: details, prerequisites as links, "Required for" (reverse prerequisites), lecturers as links to their pages, programme link. 
- Enable the hidden blocks built earlier: "Courses taught" on /lecturer/[slug] and "Courses" on /programmes/[level]. Revalidate those pages when courses or lecturer links change.

4. DOWNLOADS
- /admin/downloads: list, upload, edit, reorder within category, archive. Reuse the Stage 07a PDF pipeline (signed direct upload, PDF only, size limit and delivery checks from docs/MEDIA.md, folder oau-maths/downloads). Fields: title, description, category, file, order, status. Show file size. Replacing a file removes the old asset when unused.
- Public /students/downloads grouped by category, each with title, description, size and a clear download link. The CV category belongs to lecturers and must never appear here. Empty state.

5. ACADEMIC CALENDAR
- /admin/calendar: CRUD for entries (session label such as 2026/2027, title, start date, optional end date, description). Revalidation and audit.
- Public /students/calendar: grouped by session, current and upcoming highlighted, past collapsed. Dates formatted in a single shared helper. 
- /students/calendar/feed.ics: valid RFC 5545 all-day events (DTSTART;VALUE=DATE, exclusive DTEND), reusing the existing ICS module with the same escaping and injection protections. Add a "Subscribe" and "Download .ics" control.

6. STUDENTS HUB AND NAVIGATION
- /students hub page: intro text (editable as a Page record with slug "students-intro", seeded with a neutral placeholder marked for HOD review in the admin only), then cards for Handbook, Courses, Calendar and Downloads, each hiding itself when it has no content. Links to the programme pages.
- Enable "Students" in header and footer navigation through data, and the admin sidebar items Handbook, Courses, Downloads, Calendar, Messages. Fix the nav order collision rule (new items go after the current maximum).
- Dashboard cards: "Courses", "Handbook pages", "New messages".

7. TESTS
- Contact: inbox permission matrix, status transitions, ALUMNI ref resolution, honeypot, tampered timestamp, rate limit, duplicate within 1 hour, notification email never contains the body, failure does not block, purge script dry run and apply.
- searchText normalisation with Yoruba diacritics for handbook and courses.
- Handbook: nesting limit, slug redirect, importer (dry run, apply, no overwrite, math, XSS payloads), table of contents generation, public queries exclude DRAFT and ARCHIVED.
- Courses: code normalisation, prerequisite self and cycle rejection, CSV import (valid, invalid, duplicates, unknown prerequisites, 500-row cap), reverse prerequisites, public filters, lecturer link visibility rules (only published, active lecturers).
- Downloads: category separation (CV never listed), PDF verification with mocked Cloudinary, replace removes old asset.
- Calendar: date-only handling, ICS all-day output (exclusive end, escaping, folding, injection attempts).
- Permissions: LECTURER-only gets 403 on every new admin route. ADMIN, HOD and SUPER_ADMIN can use them.
- Public serialisation tests: no private fields in any new public page payload.
- Bundle-leak guard still passes. Report First Load JS for /students, /students/handbook/[slug], /students/courses and /students/calendar.

8. DOCS
- docs/STUDENTS.md: modules, importer formats, search behaviour, print, ICS, retention. Update docs/CONTENT-EDITING.md with "Add a handbook page", "Import the handbook", "Import the course list", "Add a form to Downloads", "Update the calendar" and "Answer a contact message", in plain language, no em dashes. Add decisions to docs/DECISIONS.md.

9. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: submit the contact form at phone width and see it in the inbox, trip the honeypot and the rate limit if you can do so reliably, send an ALUMNI removal message with a real ref and follow the link to the entry, create handbook pages by hand and by importing the SAMPLE file, search with a Yoruba-marked term, check the table of contents and print preview, import a small course CSV (use clearly fake codes like TST 101 and delete them afterwards), check prerequisite links and the lecturer link, enable the courses blocks on a lecturer and a programme page, upload a PDF to Downloads, add calendar entries and import the .ics feed into a real calendar app, and confirm a LECTURER-only user gets 403 on all new admin routes.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 10 in docs/ROADMAP.md.
- Finish with: results of each step, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
