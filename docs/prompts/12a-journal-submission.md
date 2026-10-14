# Stage 12a: Journal submission and editor screening

Read CLAUDE.md, docs/STATE.md, docs/ROADMAP.md, the last entry of AUDIT.md, docs/JOURNAL.md, docs/AUTH.md and docs/DATA-MODEL.md. Search docs/DECISIONS.md for the journal, access and retention entries instead of reading it whole. For the spam module read src/server/services/alumni-spam.ts directly. This is Stage 12a. In docs/ROADMAP.md split item 12 into 12a (author accounts, submission, editor screening) and 12b (reviewers, rounds, decisions, publishing accepted papers).

PRE-CHECK
- Stage 11 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/12a-journal-submission from main.

PROCESS
- Superpowers writing-plans, then test-driven development for the state machine, access policy, conflict-of-interest rules, upload streaming, validation, reference numbers and permissions. Reuse the spam module, private storage module, manuscript access policy, rich text editor, revisions pattern, audit service and Resend wrapper.
- Do not reopen decisions in DECISIONS.md. New decisions get new numbers. Never delete old ones.
- This stage handles confidential unpublished research and accepts uploads from the public internet, so be strict. Never put manuscript titles, abstracts, filenames, author names or letter bodies in emails, logs or AuditLog summaries. Use ids.
- While working, run only the test files relevant to what you changed. Run lint, typecheck, the full test suite and build once at the end.
- Run /security-review at the end and fix every real finding.

GOAL
An author can register, verify their email, submit a manuscript with files, track it, fix technical problems and withdraw. Journal editors can screen submissions: assign a handling editor, return for technical fixes, desk reject, or approve for peer review. Reviewer assignment and everything after it is Stage 12b.

0. DECISIONS FIRST (docs only, one commit, add to DECISIONS.md and JOURNAL.md)
- Permission journal.editorial (handle manuscripts): SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR only. journal.edit and journal.manage keep their Stage 11 meaning.
- Permission journal.manuscripts.read (read only): SUPER_ADMIN, HOD, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR. The HOD may open the manuscript list and detail page and download files through the policy route, and nothing else: no assigning, returning, rejecting, approving or notes. The HOD never sees reviews or reviewer identities. ADMIN has no access. This amends the Stage 11 rule that denied the HOD. Record it as a new decision. Update the Stage 11 matrix test expectation (HOD without an editor role: read-only access).
- Every read of a manuscript detail page or file by SUPER_ADMIN or HOD is audit-logged (actor id and manuscript id only). Developers use only fixture data in development.
- Conflict of interest: a user who is the submitter of a manuscript, or whose user id or verified email matches any author email on it, has no editorial or read access to it (list, detail, files, actions), whatever their roles, including HOD and SUPER_ADMIN. They keep ordinary author access to their own manuscript.
- Manuscript files go to our own server's private storage, never Cloudinary.
- Reference numbers look like MS-YYYY-NNNN, assigned at final submission.
- Authors are responsible for anonymising their manuscript. Files reach reviewers as submitted. The system warns but never alters files.
- Retention: submitted manuscripts, files, editorial events and decisions are kept permanently, including rejected and withdrawn ones. No purge for submitted manuscripts. Only INCOMPLETE drafts never submitted are purged, after 60 days. The author agreement text and the draft privacy section say this plainly, marked "Needs OAU legal review". Add to the Stage 14 roadmap: private storage in offsite backups, a disk usage alert, and a review of the retention wording.

1. SCHEMA (one migration, tests included)
- User: add emailVerifiedAt DateTime?. Backfill for existing users who have a passwordHash.
- UserToken type: add EMAIL_VERIFY (24 hours, single use, hash only, like the others).
- ManuscriptStatus: add INCOMPLETE (draft) and RETURNED_TO_AUTHOR.
- Manuscript: add reference String? unique, articleType (reuse the article type enum), coverLetter String? (plain text, max 5000), suggestedReviewers Json? and excludedReviewers Json? (up to 5 each of name, affiliation, email), anonymisedConfirmedAt DateTime?, agreementVersion String?, agreementAcceptedAt DateTime?, submittedAt DateTime?.
- ManuscriptFileKind: add TITLE_PAGE. Add a test that reviewers can never read it (reviewer kinds stay MANUSCRIPT, SUPPLEMENTARY, REVISED, RESPONSE_TO_REVIEWERS).
- New ManuscriptEvent: manuscriptId, type (CREATED, SUBMITTED, FILE_ADDED, FILE_REMOVED, EDITOR_ASSIGNED, RETURNED_TO_AUTHOR, RESUBMITTED, DESK_REJECTED, APPROVED_FOR_REVIEW, WITHDRAWN, INTERNAL_NOTE), actorId nullable, visibleToAuthor Boolean, note String? (plain text, max 2000), createdAt. Index on manuscriptId and createdAt.
- New JournalCounter: year Int primary key, value Int. Reference numbers use an atomic upsert increment inside the submit transaction. Test concurrent submissions for uniqueness.
- Create ManuscriptRound number 1 at final submission.
- Update docs/DATA-MODEL.md including the private fields list (author emails, suggested and excluded reviewers, cover letter, internal notes, all files).

2. STATE MACHINE (src/server/services/manuscript-workflow.ts)
One transition table and function for every status change, with allowed actor roles, preconditions, resulting event and audit entry, each in a transaction, rejecting illegal moves. Transitions: INCOMPLETE to SUBMITTED; SUBMITTED to SCREENING (editor assigned or opens it); SUBMITTED or SCREENING to RETURNED_TO_AUTHOR; RETURNED_TO_AUTHOR to SCREENING (author resubmits); SUBMITTED or SCREENING to REJECTED (desk reject); SUBMITTED or SCREENING to UNDER_REVIEW (approve); withdrawal from INCOMPLETE (deletes the draft and its files), or from SUBMITTED, SCREENING or RETURNED_TO_AUTHOR (to WITHDRAWN). Test every legal and illegal transition and who may perform each.

3. AUTHOR ACCOUNTS
- /journal/register, only while submissionsOpen is true: name, email, password (min 10 characters), privacy consent, honeypot, HMAC minimum fill time and a per-IP rate limit (5 per hour) from the spam module. Creates an active User with the AUTHOR role and emailVerifiedAt null, and sends a verification email. The response is identical whether or not the email exists (an existing address gets an "you already have an account" email instead).
- /journal/verify/[token] verifies the email. Resend verification is rate limited (3 per hour per email and per IP).
- An AUTHOR-only user lands on /journal/dashboard after login. Validate any next parameter as a same-origin relative path only (open redirect tests).
- Unverified users cannot create manuscripts. Invited users (lecturers, editors) are already verified. A user gets the AUTHOR role when they create their first manuscript. AUTHOR-only users get 403 on every /admin route.

4. SUBMISSION WIZARD (/journal/submit, session and verified email required)
- If submissionsOpen is false: a friendly closed page. Existing drafts stay editable but cannot be finally submitted while closed.
- Server-side autosave on each step (draft = Manuscript with status INCOMPLETE).
  1) Article type, title (plain text up to 300 characters, inline math allowed), abstract (rich text with math, sanitised, up to 3000 characters of text), keywords (3 to 10).
  2) Authors, 1 to 20, each with name, affiliation, email, optional ORCID (checksum validated), exactly one corresponding author. The submitting user's email must be in the list, or the submitter ticks "I am submitting on behalf of all authors, who have agreed".
  3) Files and details: exactly one MANUSCRIPT file (PDF or DOCX), optional TITLE_PAGE, optional SUPPLEMENTARY files, cover letter (plain text), suggested and excluded reviewers (optional), and an "anonymised" confirmation with plain guidance on removing author names, affiliations, acknowledgements and file properties.
  4) Agreement: constant JOURNAL_AUTHOR_AGREEMENT_V1 in code with checkboxes (original work, not under consideration elsewhere, all authors approved, ethics and conflicts disclosed, the journal licence from settings accepted, blind peer review understood, permanent retention of the editorial record understood). Mark the text "Needs editor and legal review". Store version and timestamp.
  5) Review summary and Submit.
- Text handling: Unicode letters including Yoruba diacritics, NFC, trim, length caps, plain text where specified, angle brackets rejected, everything escaped on output.
- Submit (one transaction): final validation, assign the reference, create round 1, status SUBMITTED, event, audit; then emails (best effort, never blocking). The submitter gets a confirmation with the reference only. Editors holding journal.editorial (excluding conflicted ones) get "New submission MS-YYYY-NNNN received" with a link, never the title.
- Text steps work without JavaScript (server actions with redirects). Mobile-first.
- DOCX: read docProps/core.xml safely (zip bomb and size limits) and warn if creator or lastModifiedBy contain a name. Warn only. For PDFs show the generic warning.

5. UPLOAD ROUTES
- POST /api/journal/manuscripts/[id]/files (kind and filename in headers, raw body streamed to private storage, no multipart buffering, no whole-file memory use). Requires session, verified email, ownership, status INCOMPLETE or RETURNED_TO_AUTHOR. Limits: 25 MB per file, 100 MB and 10 files per manuscript, aborting mid-stream and cleaning partial files. Use the Stage 11 content verification. One MANUSCRIPT file at a time (replacement removes the old file from disk). Record sha256, size, mime, sanitised original name.
- DELETE /api/journal/manuscripts/[id]/files/[fileId] with the same checks.
- Same-origin enforcement (Origin or Sec-Fetch-Site) plus a custom request header, since route handlers have no built-in CSRF protection. Rate limit uploads per user (30 per hour). Generic errors, never paths.
- Check the installed Next.js version's documentation (not memory) for body size handling, and document the reverse proxy settings Stage 14 needs (client_max_body_size, timeouts).

6. AUTHOR DASHBOARD (/journal/dashboard, outside /admin)
- "My submissions": reference (drafts show none), title, plain-language status ("Draft", "Received", "With the editor", "Needs your attention", "In peer review", "Not accepted", "Withdrawn"), dates. Continue draft, withdraw (confirmation, optional reason), delete draft.
- /journal/dashboard/[id]: author-visible event timeline, files with downloads through the policy route, the editor's message when returned with an "Upload corrected files and resubmit" flow (only allowed fields editable), and the desk-rejection letter when rejected. Authors never see internal notes or other people's data.
- Account settings: change name and password with the existing security flow.

7. EDITOR SCREENING (admin)
- /admin/journal/manuscripts and /admin/journal/manuscripts/[id]. Add "Manuscripts" to the sidebar and the minimal journal-only shell. Dashboard card "Awaiting screening".
- List: reference, title, authors, status, submitted date, handling editor, days waiting. Filters by status and handling editor, search by reference, title or author name (diacritic insensitive). Conflicted manuscripts never appear and the detail route returns 404 for conflicted users. Users with only journal.manuscripts.read (the HOD) see the same list and detail but no action controls.
- Update src/server/services/manuscript-access.ts so conflict of interest denies file reads too. Tests for: editor who is submitter, editor whose email matches a co-author, SUPER_ADMIN or HOD who is an author, and the same user keeping author access to their own manuscript.
- Detail: metadata, abstract, authors with affiliations and emails, cover letter, suggested and excluded reviewers, agreement record, DOCX metadata warning, files (editors see original filenames, downloads through the policy route, audited), event timeline, and "Add internal note" (editor-only events).
- Actions (journal.editorial only; each with state check, audit, event, and email where noted): assign or reassign handling editor (the EiC may assign any non-conflicted editor, an editor may take an unassigned manuscript); return to author for technical fixes (message required, author gets a "sign in" notice); desk reject (letter required, stored as an EditorialDecision of type DESK_REJECT, author emailed only that a decision is available, the letter shows on the dashboard); approve for peer review (status UNDER_REVIEW, round 1 open, author emailed a notice). Only the EiC and the handling editor may reject or approve.
- Email templates (React Email, plain, no em dashes): verification, already registered, submission received, new submission to editors, returned to author, decision available, moved to peer review. Reference and sign-in link only. Console fallback in development.

8. PUBLIC PAGES, DOCS AND SCRIPTS
- /journal: show the "Submit a manuscript" button and a short "For authors" steps block only while submissionsOpen is true. The journal nav strip shows Register, Log in or Dashboard as appropriate.
- docs/JOURNAL-AUTHOR-GUIDE.md: plain-language author instructions the editor can adapt. Do not publish it automatically.
- Update the draft privacy section: what is collected from authors, who sees what (editors and the HOD see manuscripts, reviewers will see the manuscript but never author identity, authors never see reviewer identity), and permanent retention (needs OAU legal review).
- npm script journal:purge-drafts (dry run by default, --apply): deletes INCOMPLETE manuscripts untouched for 60 days with their files. Extend private-storage:orphans to cover the new files. Document scheduling for Stage 14.
- Update journal:dev-fixture and its --remove for the new models and files.
- Update docs/STATE.md with a short Stage 12a entry, and docs/AUTH.md with the new permissions.

9. TESTS (beyond those named above)
- State machine: all legal and illegal transitions and actors.
- Registration and verification: identical responses, token rules, rate limits, unverified users blocked, open-redirect cases, role assignment on first manuscript.
- Validation: every wizard field including Yoruba names, ORCID checksum, author counts, one corresponding author, keyword limits, injection payloads in title and abstract.
- Uploads: streaming without whole-file buffering, size caps mid-stream with cleanup, content verification (renamed executables, HTML as PDF, zip bombs, double extensions, traversal names), ownership, status gating, cross-origin and missing-header rejection, rate limit, replacement removing the old file.
- Reference numbers: format, concurrent uniqueness, year rollover.
- Access policy: full matrix including conflict of interest, TITLE_PAGE never reaching reviewers, HOD read-only (including no reviews and no actions), ADMIN always denied, audit entries for HOD and SUPER_ADMIN reads.
- Dashboard: authors see only their own manuscripts and visible events. 404 for others.
- Emails: none contains titles, abstracts, filenames, author names or letter bodies (assert on rendered output). Failure never blocks submit or decisions.
- Purge in dry run and apply modes, and that submitted manuscripts are never selected. Fixture create and remove.
- Permissions: LECTURER-only, ADMIN-only and AUTHOR-only get 403 or 404 on /admin/journal/manuscripts. Journal editors and the HOD can open it, only editors can act. Update the matrix test.
- Public serialisation tests show no new public page exposes manuscript data. The bundle-leak guard passes. Report First Load JS for /journal/submit and /journal/dashboard.

10. VERIFY AND REPORT
Do these yourself with scripts, curl, database queries, filesystem checks and the dev fixture (no screenshots unless something looks wrong). Use the browser tool only for one pass through the core flow (register with the console-fallback link, verify, draft, upload, submit, editor opens it):
- Hostile uploads (an .exe renamed to .pdf, HTML renamed to .pdf, an oversize file) are rejected; uploaded files exist only in the private directory and no public URL reaches them.
- Reference number and the editor notification in the console.
- As an editor: download a file (audited), add an internal note, assign, return for fixes, author resubmits; desk reject a second manuscript and read the letter as the author; approve a third; withdraw a fourth.
- An editor who is also an author cannot see their own manuscript; the HOD can read but not act and sees no reviews; ADMIN cannot open manuscripts; an AUTHOR-only user gets 403 on /admin.
- submissionsOpen false shows the closed state. journal:purge-drafts dry run. journal:dev-fixture then --remove leaves nothing behind.
Then:
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry and tick Stage 12a in docs/ROADMAP.md.
- Finish with: results of each step, deviations, anything I must do by hand (list the UI checks you did NOT do in a browser so I can do them), and a ready-to-paste PR title and description.