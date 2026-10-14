# Stage 12a: Journal Submission and Editor Screening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authors can register, verify, submit manuscripts through a 5-step wizard, track and withdraw submissions; journal editors can screen submissions (assign, return for fixes, desk-reject, approve for peer review).

**Architecture:** Schema additions on top of the existing Manuscript model; a state machine service owns all transitions; upload routes stream directly to private storage; 5-step autosaving wizard uses server actions with redirects (no JS required); author UI lives under /journal (outside /admin); editor UI under /admin/journal/manuscripts.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma 7, Auth.js JWT sessions, private-storage.ts (Stage 11), React Email, Resend, Zod, Vitest.

**Spec:** docs/prompts/12a-journal-submission.md

## Global Constraints

- Never put manuscript titles, abstracts, filenames, author names or letter bodies in emails, logs or AuditLog summaries — use ids only.
- Files go to private storage (PRIVATE_STORAGE_DIR), never Cloudinary.
- Reference numbers: `MS-YYYY-NNNN`, assigned at final submission via atomic JournalCounter upsert.
- Text: Unicode including Yoruba diacritics, NFC, trimmed, length caps, angle brackets rejected.
- Email: plain text, no em dashes, reference and sign-in link only.
- Server-side auth check on every mutation and private read; hiding a button is not security.
- Conflict of interest: submitter or email-matching author has no editorial/read access.
- TITLE_PAGE files never reach reviewers.
- Retention: submitted manuscripts permanent; INCOMPLETE deleted after 60 days.
- No secrets in repo; env vars validated in src/lib/env.ts.

## Review Focus

1. **Concurrent reference number generation**: two simultaneous `submit` transactions must not produce the same MS-YYYY-NNNN — covered by Task 5, step asserting unique refs under contention.
2. **Zip bomb in DOCX upload**: a deeply nested zip that expands to gigabytes must be rejected before OOM — covered by Task 7, step asserting 25 MB stream abort with partial file cleanup.
3. **Conflict-of-interest bypass**: a JOURNAL_EDITOR_IN_CHIEF who submits a paper must not see it in the list or detail — covered by Task 3, COI matrix test.
4. **Open redirect after login**: `?next=https://evil.com` on /journal/dashboard must redirect to /journal/dashboard, not to evil — covered by Task 4, registration redirect test.
5. **Email content leakage**: no rendered email must contain a manuscript title, author name, filename or letter body — covered by Task 9, email-content assertion test.

---

## Task 0: Branch setup and ROADMAP split

**Files:**
- Modify: `docs/ROADMAP.md`
- No code changes.

- [ ] **Step 1:** `git checkout main && git pull` — confirm tip is `0d2bac2`.
- [ ] **Step 2:** `git checkout -b stage/12a-journal-submission`
- [ ] **Step 3:** In `docs/ROADMAP.md`, replace item 12 with:
  ```
  - [ ] 12a Journal submission: author accounts, submission wizard, editor screening
  - [ ] 12b Journal peer review: reviewer assignment, rounds, decisions, publishing
  ```
- [ ] **Step 4:** `git add docs/ROADMAP.md && git commit -m "docs: split roadmap item 12 into 12a (submission) and 12b (peer review)"`

---

## Task 1: Decisions, JOURNAL.md and AUTH.md update (docs-only commit)

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `docs/JOURNAL.md`
- Modify: `docs/AUTH.md`
- Modify: `docs/DATA-MODEL.md`

- [ ] **Step 1:** In `docs/DECISIONS.md`, add entries (next available numbers after #57):
  - #58: `journal.editorial` (handle manuscripts) held by SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR. `journal.manuscripts.read` (list and read manuscripts, download files) held by SUPER_ADMIN, HOD, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR. HOD has read-only access including file downloads but no editorial actions. ADMIN has no manuscript access (editorial independence). Amends Stage 11 rule that denied HOD.
  - #59: Conflict of interest — a user who is the submitter of a manuscript, or whose user id or verified email matches any ManuscriptAuthor email, has no editorial or read access (list, detail, files, actions) to that manuscript regardless of roles, including HOD and SUPER_ADMIN. They keep ordinary author access to their own submissions.
  - #60: Every read of a manuscript detail page or file by SUPER_ADMIN or HOD is audit-logged (actor id and manuscript id only).
  - #61: INCOMPLETE drafts (never submitted) are purged after 60 days via `npm run journal:purge-drafts`. Submitted manuscripts and their editorial records are kept permanently (no purge). Author agreement text and privacy section are marked "Needs OAU legal review". Add to Stage 14: private storage in offsite backups, disk usage alert, retention wording review.
  - #62: DOCX metadata: read `docProps/core.xml` safely (zip bomb + size limits) and warn if creator/lastModifiedBy contain a name. Warn only — never alter files.

- [ ] **Step 2:** Update `docs/JOURNAL.md`: add a "Stage 12a" section describing the new submission and screening flows. Update the manuscript file access policy table to add HOD read-only row and COI denial row.

- [ ] **Step 3:** Update `docs/AUTH.md`: add `journal.editorial` and `journal.manuscripts.read` to the permissions table.

- [ ] **Step 4:** Update `docs/DATA-MODEL.md`: add new fields (reference, articleType, coverLetter, suggestedReviewers, excludedReviewers, anonymisedConfirmedAt, agreementVersion, agreementAcceptedAt, submittedAt, emailVerifiedAt on User), add ManuscriptEvent and JournalCounter models to private-fields list.

- [ ] **Step 5:** `git add docs/ && git commit -m "docs: Stage 12a decisions, JOURNAL.md, AUTH.md, DATA-MODEL.md"`

---

## Task 2: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261014120000_journal_submission/migration.sql`
- Modify: `src/server/services/tokens.ts` (add EMAIL_VERIFY TTL)
- Modify: `src/lib/rbac.ts` (add new permissions)
- Test: `tests/unit/database/schema-shape.test.ts` (add TITLE_PAGE/INCOMPLETE/RETURNED_TO_AUTHOR assertions)

**Interfaces:**
- Produces: `ManuscriptStatus` enum values `INCOMPLETE`, `RETURNED_TO_AUTHOR`; `ManuscriptFileKind` value `TITLE_PAGE`; `UserTokenType` value `EMAIL_VERIFY`; `Manuscript` new fields; `ManuscriptEvent` model; `JournalCounter` model; `emailVerifiedAt` on `User`.

- [ ] **Step 1:** In `prisma/schema.prisma`:
  - Add `EMAIL_VERIFY` to `UserTokenType` enum.
  - Add `emailVerifiedAt DateTime?` to `User`.
  - Add `INCOMPLETE` (before SUBMITTED) and `RETURNED_TO_AUTHOR` to `ManuscriptStatus` enum.
  - Add `TITLE_PAGE` to `ManuscriptFileKind` enum.
  - Add to `Manuscript`: `reference String? @unique`, `articleType ArticleType @default(RESEARCH_ARTICLE)`, `coverLetter String?`, `suggestedReviewers Json?`, `excludedReviewers Json?`, `anonymisedConfirmedAt DateTime?`, `agreementVersion String?`, `agreementAcceptedAt DateTime?`, `submittedAt DateTime?`.
  - Add `ManuscriptEvent` model: `id String @id @default(cuid())`, `manuscriptId String`, `type ManuscriptEventType`, `actorId String?`, `visibleToAuthor Boolean @default(false)`, `note String?`, `createdAt DateTime @default(now())`. Index on `manuscriptId` and `createdAt`. Relations to `Manuscript (onDelete: Cascade)` and `User? (onDelete: SetNull)`. Add relation array on `Manuscript`.
  - Add `ManuscriptEventType` enum with values: `CREATED SUBMITTED FILE_ADDED FILE_REMOVED EDITOR_ASSIGNED RETURNED_TO_AUTHOR RESUBMITTED DESK_REJECTED APPROVED_FOR_REVIEW WITHDRAWN INTERNAL_NOTE`.
  - Add `JournalCounter` model: `year Int @id`, `value Int`. (No timestamps, no relations — just a counter row per year for atomic increment.)
  - Add `ManuscriptRound.openedAt DateTime @default(now())` (rename from submittedAt — the round is opened at submission, used as-is; the per-round detail will be set correctly in the state machine).

  Actually, looking at the existing schema: `ManuscriptRound` has `submittedAt DateTime`. The prompt says "Create ManuscriptRound number 1 at final submission." The existing field name is fine; keep it as `submittedAt` and set it to `now()` at submission time.

  Add `@@index([manuscriptId, createdAt])` to `ManuscriptEvent`.

- [ ] **Step 2:** Add `journal.editorial` and `journal.manuscripts.read` to `PERMISSIONS` and `ROLE_PERMISSIONS` in `src/lib/rbac.ts`:
  - `journal.editorial`: SUPER_ADMIN, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR
  - `journal.manuscripts.read`: SUPER_ADMIN, HOD, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR

- [ ] **Step 3:** In `src/server/services/tokens.ts`, add `EMAIL_VERIFY: 24 * 60 * 60 * 1000` (24 hours) to `TOKEN_TTL`.

- [ ] **Step 4:** Generate the migration:
  ```bash
  npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20261014120000_journal_submission/migration.sql
  ```
  (Adjust: use `--from-migrations` / `--to-schema-datamodel` pattern the project already uses — check existing migration for the right flags.)
  
  Actually, based on Entry 001 which used `prisma migrate diff --from-empty`, and Entry 023 which used a named migration, generate with:
  ```bash
  npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --script
  ```
  Save output to the migration file; create the migration_lock entry.

  Include the backfill: `UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "passwordHash" IS NOT NULL AND "emailVerifiedAt" IS NULL;`

- [ ] **Step 5:** Write failing tests in `tests/unit/database/schema-shape.test.ts`:
  ```typescript
  it("ManuscriptStatus includes INCOMPLETE and RETURNED_TO_AUTHOR", () => {
    const content = fs.readFileSync("prisma/schema.prisma", "utf-8");
    expect(content).toContain("INCOMPLETE");
    expect(content).toContain("RETURNED_TO_AUTHOR");
  });
  it("ManuscriptFileKind includes TITLE_PAGE", () => {
    expect(content).toContain("TITLE_PAGE");
  });
  it("UserTokenType includes EMAIL_VERIFY", () => {
    expect(content).toContain("EMAIL_VERIFY");
  });
  it("ManuscriptEvent model exists", () => {
    expect(content).toContain("model ManuscriptEvent");
  });
  it("JournalCounter model exists", () => {
    expect(content).toContain("model JournalCounter");
  });
  ```
- [ ] **Step 6:** Run `npm run test -- tests/unit/database/schema-shape.test.ts` — expect FAIL.
- [ ] **Step 7:** Implement schema changes (Step 1-4 above).
- [ ] **Step 8:** Run `npm run test -- tests/unit/database/schema-shape.test.ts` and `npx prisma validate` — both must pass.
- [ ] **Step 9:** `git commit -m "feat(journal): schema additions for manuscript submission (Stage 12a)"`

---

## Task 3: Manuscript access policy update (COI + HOD read-only + TITLE_PAGE)

**Files:**
- Modify: `src/server/services/manuscript-access.ts`
- Test: `tests/unit/journal/__tests__/manuscript-access.test.ts` (update existing + new COI cases)

**Interfaces:**
- New param on `canReadManuscriptFile` / `canDownloadAs`: `conflictOfInterest: boolean` — caller computes it, function applies it.
- HOD with `journal.manuscripts.read` but no editorial role: access granted unless COI, but download filename is the real name (same as editor).
- TITLE_PAGE: reviewers never see it even if round/status match.

- [ ] **Step 1:** Write failing tests:
  ```typescript
  it("COI: editor who submitted the manuscript is denied", ...)
  it("COI: editor whose email matches a co-author is denied", ...)
  it("COI: SUPER_ADMIN who is an author is denied", ...)
  it("COI: HOD who is an author is denied", ...)
  it("COI: author keeps own-manuscript access even when COI flagged for editorial", ...)
  it("HOD without editor role: reads any non-COI manuscript", ...)
  it("HOD: cannot read TITLE_PAGE", ...)
  it("reviewer: cannot read TITLE_PAGE even on accepted assignment", ...)
  it("ADMIN: denied always (no change)", ...)
  it("SUPER_ADMIN/HOD: read is audit-logged (access function returns auditRequired flag)", ...)
  ```
- [ ] **Step 2:** Run tests — FAIL.
- [ ] **Step 3:** Update `canReadManuscriptFile` and `canDownloadAs` signatures to accept `conflictOfInterest: boolean`. Add HOD check (hasRole HOD → access if not COI and not TITLE_PAGE). Add TITLE_PAGE denial for reviewers. Add `auditRequired` to the return value for SUPER_ADMIN/HOD successful reads.
- [ ] **Step 4:** Update `src/server/services/manuscript-file-download.ts` to compute COI before calling the policy function, and to call `logAction` when `auditRequired` is true.
- [ ] **Step 5:** Run tests — PASS.
- [ ] **Step 6:** `git commit -m "feat(journal): manuscript access policy — COI, HOD read-only, TITLE_PAGE denial"`

---

## Task 4: Author registration, verification and login redirect

**Files:**
- Create: `src/server/services/author-registration.ts`
- Create: `src/server/actions/author-registration.ts`
- Create: `src/app/(journal)/register/page.tsx`
- Create: `src/app/(journal)/verify/[token]/page.tsx`
- Create: `src/emails/journal-verify.tsx`
- Create: `src/emails/journal-already-registered.tsx`
- Modify: `src/lib/email.ts` (add `sendVerificationEmail`, `sendAlreadyRegisteredEmail`)
- Modify: `src/lib/rate-limit.ts` (add `journalRegisterIpRateLimiter`, `journalVerifyRateLimiter`)
- Test: `tests/unit/journal/__tests__/author-registration.test.ts`

**Interfaces:**
- `registerAuthor(db, {name, email, passwordPlaintext, ip}): Promise<{sent: true}>`
  Always returns `{sent: true}` (identical response whether email exists or not).
- `verifyEmail(db, token): Promise<{userId: string} | null>`
- Rate limiters: register 5/hour per IP; resend verification 3/hour per email AND 3/hour per IP.

- [ ] **Step 1:** Write failing tests in `tests/unit/journal/__tests__/author-registration.test.ts`:
  ```typescript
  it("creates User with AUTHOR role and emailVerifiedAt null", ...)
  it("sends verification email, not already-registered email, for new address", ...)
  it("sends already-registered email for existing address — same response shape", ...)
  it("verifyEmail: sets emailVerifiedAt, returns userId", ...)
  it("verifyEmail: invalid token returns null", ...)
  it("verifyEmail: expired token returns null", ...)
  it("verifyEmail: used token returns null", ...)
  it("password min length 10 enforced in validator", ...)
  it("open redirect: next param must be same-origin relative path", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `author-registration.ts` service.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Add `journal.register.ts` Zod schema in `src/lib/validators/manuscript.ts`: `name` (1-200 chars, NFC trimmed), `email` (email), `password` (min 10 chars), `privacyConsent` (boolean true required), `honeypot` (empty string expected), `formTimestamp` (HMAC check via `form-spam.ts`).
- [ ] **Step 6:** Implement server action and pages. `/journal/register` shows form. POST: validate, `checkHoneypot`, `verifyMinFillTime`, IP rate limit, call service, always render "Check your email" page. `/journal/verify/[token]`: calls `verifyEmail`, sets session note, redirects to `/journal/dashboard`.
- [ ] **Step 7:** In `/journal/dashboard` redirect after login: validate `next` as same-origin relative path (starts with `/`, does not start with `//`, no protocol); reject to `/journal/dashboard` otherwise.
- [ ] **Step 8:** Run tests — PASS.
- [ ] **Step 9:** `git commit -m "feat(journal): author registration, email verification, login redirect"`

---

## Task 5: Submission service (draft autosave, reference numbers, submit transaction)

**Files:**
- Create: `src/server/services/manuscript-submission.ts`
- Create: `src/lib/validators/manuscript.ts` (expand — Zod schemas for all 5 wizard steps)
- Test: `tests/unit/journal/__tests__/manuscript-submission.test.ts`

**Interfaces:**
- `createDraft(db, userId): Promise<{id: string}>`
- `updateDraftStep(db, userId, manuscriptId, step: 1|2|3|4, data): Promise<void>` — each step has its own validated Zod shape.
- `submitManuscript(db, userId, manuscriptId): Promise<{reference: string}>` — transaction: validate complete, assign reference, create ManuscriptRound 1, status → SUBMITTED, create ManuscriptEvent SUBMITTED, write AuditLog (no title/names).
- `assignReference(db, year: number): Promise<string>` — atomic upsert of JournalCounter, returns `MS-YYYY-NNNN`.

Zod schemas (in `src/lib/validators/manuscript.ts`):
- `step1Schema`: `articleType` (ArticleType enum), `title` (1-300 chars, NFC, angle brackets rejected), `abstract` (rich text string, max 3000 text chars after sanitize), `keywords` (array 3-10, each 1-100 chars).
- `step2Schema`: `authors` (array 1-20, each `{name, affiliation?, email?, orcid?, isCorresponding}`, exactly one `isCorresponding: true`, submitter email must appear in list unless `submittingOnBehalf: true`).
- `step3Schema`: `coverLetter` (plain text 1-5000), `suggestedReviewers` (array 0-5, each `{name, affiliation?, email}`), `excludedReviewers` (same), `anonymisedConfirmed` (boolean true required).
- `step4Schema`: `agreementVersion` (literal "JOURNAL_AUTHOR_AGREEMENT_V1"), `agreementAcceptedAt` (datetime).
- ORCID checksum validator: `validateOrcid(orcid: string): boolean` — ISO 27729 Luhn mod-11 algorithm.

- [ ] **Step 1:** Write failing tests:
  ```typescript
  it("createDraft: creates INCOMPLETE manuscript with no reference", ...)
  it("updateDraftStep: validates step1 fields including Yoruba diacritics in title", ...)
  it("updateDraftStep: rejects angle brackets in title", ...)
  it("updateDraftStep: rejects < 3 keywords", ...)
  it("updateDraftStep: rejects ORCID with invalid checksum", ...)
  it("updateDraftStep: requires exactly one corresponding author", ...)
  it("assignReference: returns MS-2026-0001 for first submission", ...)
  it("assignReference: concurrent calls produce unique references", ...)  // run 10 simultaneous
  it("assignReference: year rollover resets counter to 0001", ...)
  it("submitManuscript: status INCOMPLETE → SUBMITTED, sets submittedAt and reference", ...)
  it("submitManuscript: unverified email throws", ...)
  it("submitManuscript: missing MANUSCRIPT file throws", ...)
  it("submitManuscript: creates ManuscriptRound number 1", ...)
  it("submitManuscript: creates ManuscriptEvent SUBMITTED with visibleToAuthor true", ...)
  it("submitManuscript: AuditLog summary contains no title/name", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `validateOrcid`, all Zod schemas, then `manuscript-submission.ts`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `git commit -m "feat(journal): submission service, reference numbers, Zod schemas"`

---

## Task 6: State machine

**Files:**
- Create: `src/server/services/manuscript-workflow.ts`
- Test: `tests/unit/journal/__tests__/manuscript-workflow.test.ts`

**Interfaces:**
- ```typescript
  type WorkflowAction =
    | "SUBMIT"          // INCOMPLETE → SUBMITTED
    | "ASSIGN_EDITOR"   // SUBMITTED/SCREENING → SCREENING
    | "RETURN_TO_AUTHOR" // SUBMITTED/SCREENING → RETURNED_TO_AUTHOR
    | "RESUBMIT"        // RETURNED_TO_AUTHOR → SCREENING
    | "DESK_REJECT"     // SUBMITTED/SCREENING → REJECTED
    | "APPROVE_FOR_REVIEW" // SUBMITTED/SCREENING → UNDER_REVIEW
    | "WITHDRAW";       // INCOMPLETE → delete; SUBMITTED/SCREENING/RETURNED → WITHDRAWN
  
  type TransitionResult = { ok: true; newStatus: ManuscriptStatus } | { ok: false; reason: string };
  
  function transition(
    db: Db,
    actor: SessionUser,
    manuscriptId: string,
    action: WorkflowAction,
    opts?: { handlingEditorId?: string; note?: string; letter?: string }
  ): Promise<TransitionResult>
  ```
- Each transition: status check, actor role check, side effects (ManuscriptEvent, AuditLog, EditorialDecision for DESK_REJECT), all in a transaction.
- DESK_REJECT and APPROVE_FOR_REVIEW: only EiC or handling editor may perform.
- WITHDRAW from INCOMPLETE: deletes the draft and its files (removes from private storage too).

- [ ] **Step 1:** Write tests for every legal and illegal transition:
  ```typescript
  // Legal
  it("SUBMIT: INCOMPLETE → SUBMITTED by owner", ...)
  it("ASSIGN_EDITOR: SUBMITTED → SCREENING by EiC", ...)
  it("RETURN_TO_AUTHOR: SCREENING → RETURNED_TO_AUTHOR by handling editor", ...)
  it("RESUBMIT: RETURNED_TO_AUTHOR → SCREENING by author", ...)
  it("DESK_REJECT: SCREENING → REJECTED by EiC", ...)
  it("DESK_REJECT: SCREENING → REJECTED by handling editor", ...)
  it("APPROVE_FOR_REVIEW: SUBMITTED → UNDER_REVIEW by EiC", ...)
  it("WITHDRAW: INCOMPLETE → deleted by owner", ...)
  it("WITHDRAW: SUBMITTED → WITHDRAWN by owner", ...)
  // Illegal
  it("SUBMIT: from SUBMITTED returns error", ...)
  it("DESK_REJECT: by non-handling JOURNAL_EDITOR returns error", ...)
  it("DESK_REJECT: by HOD returns error", ...)
  it("APPROVE: by ADMIN returns error", ...)
  it("WITHDRAW: from UNDER_REVIEW returns error", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `manuscript-workflow.ts` with a `TRANSITIONS` lookup table and a `transition` function.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `git commit -m "feat(journal): manuscript state machine, all transitions"`

---

## Task 7: Upload and delete file routes

**Files:**
- Create: `src/app/api/journal/manuscripts/[id]/files/route.ts`
- Create: `src/app/api/journal/manuscripts/[id]/files/[fileId]/route.ts`
- Modify: `src/lib/rate-limit.ts` (add `journalUploadRateLimiter` 30/hour per user)
- Test: `tests/unit/journal/__tests__/upload.test.ts`

**Interfaces:**
- `POST /api/journal/manuscripts/[id]/files`: headers `X-File-Kind` (ManuscriptFileKind), `X-File-Name` (sanitised original name), `Content-Type`; raw body is the file stream. Returns `{id, size, sha256}` on 201.
- `DELETE /api/journal/manuscripts/[id]/files/[fileId]`: returns 204.
- Same-origin check: `Origin` or `Sec-Fetch-Site: same-origin` AND a custom header `X-Requested-With: fetch`.
- Limits: 25 MB per file, 100 MB total per manuscript, max 10 files. One MANUSCRIPT file — uploading another replaces the old file (removes from disk).
- Status gating: INCOMPLETE or RETURNED_TO_AUTHOR only.
- Content verification: reuse `private-storage.ts` `put()` which verifies magic bytes.
- DOCX metadata warning: extract `docProps/core.xml` from the zip structure after upload if kind is MANUSCRIPT; warn (return `{..., metadataWarning: string | null}`) if creator/lastModifiedBy is non-empty. Never alter the file.

- [ ] **Step 1:** Write unit tests:
  ```typescript
  it("rejects upload without X-Requested-With header", ...)
  it("rejects upload with cross-origin Origin header", ...)
  it("rejects file over 25 MB mid-stream, cleans up partial file", ...)
  it("rejects total manuscript size over 100 MB", ...)
  it("rejects executable renamed to .pdf (magic bytes check)", ...)
  it("rejects HTML renamed to .pdf", ...)
  it("rejects path traversal in filename header (../../etc/passwd)", ...)
  it("rejects double extension in filename (malware.exe.pdf → stored as malware_exe.pdf)", ...)
  it("replacing MANUSCRIPT file removes old file from disk", ...)
  it("DELETE: removes file from DB and disk", ...)
  it("DELETE: ownership check — other user's manuscript returns 404", ...)
  it("upload rate limit 30/hour", ...)
  it("returns metadataWarning when DOCX creator field is non-empty", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement both route handlers. Use `req.body` as a `ReadableStream` piped to `private-storage.put()`. Build DOCX metadata extractor as a small inline helper that reads only the first 64 KB of the zip (size-limited) to find `docProps/core.xml` without a full zip library (same technique as the existing content verifier).
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Add a comment in the route file documenting the Nginx config Stage 14 needs: `client_max_body_size 25m; proxy_read_timeout 120s; proxy_send_timeout 120s;`.
- [ ] **Step 6:** `git commit -m "feat(journal): manuscript file upload and delete routes"`

---

## Task 8: Email templates

**Files:**
- Create: `src/emails/journal-verify.tsx`
- Create: `src/emails/journal-already-registered.tsx`
- Create: `src/emails/journal-submission-received.tsx`
- Create: `src/emails/journal-new-submission-editors.tsx`
- Create: `src/emails/journal-returned-to-author.tsx`
- Create: `src/emails/journal-decision-available.tsx`
- Create: `src/emails/journal-moved-to-review.tsx`
- Modify: `src/lib/email.ts` (add 7 send* functions)
- Test: `tests/unit/journal/__tests__/email-content.test.ts`

**Interfaces:**
- All emails: plain text, no em dashes, no titles/names/abstracts/filenames/letter bodies.
- `sendJournalVerificationEmail({to, token})` — verification link only.
- `sendJournalAlreadyRegisteredEmail({to})` — "you already have an account" + sign-in link.
- `sendSubmissionReceivedEmail({to, reference, signInUrl})` — reference number only.
- `sendNewSubmissionToEditorsEmail({emails: string[], reference, manuscriptUrl})` — reference + link, never title.
- `sendReturnedToAuthorEmail({to, reference, signInUrl})` — "sign in to see feedback" + sign-in link.
- `sendDecisionAvailableEmail({to, reference, signInUrl})` — "a decision is available" + sign-in link.
- `sendMovedToReviewEmail({to, reference, signInUrl})` — "your submission is now in peer review".

- [ ] **Step 1:** Write tests asserting rendered HTML contains no title-like strings:
  ```typescript
  const FORBIDDEN = ["Manuscript title", "Author Name", "cover letter", "Dear", "Dear Author"];
  // For each template:
  it("journal-submission-received: renders with reference, no forbidden strings", async () => {
    const html = await render(<JournalSubmissionReceivedEmail reference="MS-2026-0001" signInUrl="..." />);
    for (const f of FORBIDDEN) expect(html).not.toContain(f);
    expect(html).toContain("MS-2026-0001");
  });
  // Repeat for each template
  it("email failure does not throw from submit transaction", ...) // tested via service mock
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement all 7 email templates and update `email.ts`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `git commit -m "feat(journal): email templates for submission workflow"`

---

## Task 9: Submission wizard UI (5-step, autosaving)

**Files:**
- Create: `src/app/(journal)/submit/page.tsx` (step router — reads `?step=N` param)
- Create: `src/app/(journal)/submit/step1/page.tsx`
- Create: `src/app/(journal)/submit/step2/page.tsx`
- Create: `src/app/(journal)/submit/step3/page.tsx`
- Create: `src/app/(journal)/submit/step4/page.tsx`
- Create: `src/app/(journal)/submit/step5/page.tsx` (review + submit)
- Create: `src/server/actions/manuscript-submission.ts` (server actions calling service layer)
- Modify: `src/app/(site)/journal/page.tsx` (add Submit button when submissionsOpen)

**Interfaces:**
- Each step page: server component, reads current draft from DB, renders form, POST via server action redirects to next step.
- Step 3 includes a client component `<FileUploadPanel>` for the upload — renders an `<input type="file">` with JS upload via fetch to the upload route; works without JS via a fallback `<form action="/api/journal/manuscripts/[id]/files">`.
- If `submissionsOpen` is false: `/journal/submit` renders a static "submissions are currently closed" page. Existing drafts stay editable but the Step 5 submit button is disabled.
- Step 4: constant `JOURNAL_AUTHOR_AGREEMENT_V1` defined in `src/lib/constants.ts` with the agreement text (marked "Needs editor and legal review").

- [ ] **Step 1:** Implement server actions in `src/server/actions/manuscript-submission.ts`:
  - `createOrOpenDraft(formData): Promise<never>` — redirect to `/journal/submit/step1?draft=<id>`.
  - `saveStep1(formData): Promise<never>` — validate, save, redirect to step2.
  - `saveStep2(formData)`, `saveStep3(formData)`, `saveStep4(formData)`.
  - `submitDraft(formData): Promise<never>` — call `submitManuscript`, redirect to `/journal/dashboard`.
- [ ] **Step 2:** Implement pages, mobile-first layout.
- [ ] **Step 3:** Implement `submissionsOpen` check: read from journal settings (already in `journal-settings.ts`), render closed state if false.
- [ ] **Step 4:** `git commit -m "feat(journal): submission wizard UI (5 steps, server actions)"`

---

## Task 10: Author dashboard

**Files:**
- Create: `src/app/(journal)/dashboard/page.tsx`
- Create: `src/app/(journal)/dashboard/[id]/page.tsx`
- Create: `src/app/(journal)/layout.tsx` (journal auth shell — requires session, AUTHOR or editor, redirects /admin to 403)
- Create: `src/server/services/author-dashboard.ts`
- Test: `tests/unit/journal/__tests__/author-dashboard.test.ts`

**Interfaces:**
- `getAuthorManuscripts(db, userId): Promise<AuthorManuscriptSummary[]>` — only their own, only visible fields (reference, title, status, createdAt, submittedAt, plainLanguageStatus).
- `getAuthorManuscriptDetail(db, userId, manuscriptId)` — 404 if not theirs; returns files (author may download all their own), visible events (visibleToAuthor: true), editorial letter when REJECTED (from EditorialDecision.letter).
- `plainLanguageStatus(status: ManuscriptStatus): string`:
  `INCOMPLETE→"Draft"`, `SUBMITTED→"Received"`, `SCREENING→"With the editor"`, `RETURNED_TO_AUTHOR→"Needs your attention"`, `UNDER_REVIEW→"In peer review"`, `REJECTED→"Not accepted"`, `WITHDRAWN→"Withdrawn"`.

- [ ] **Step 1:** Write tests:
  ```typescript
  it("getAuthorManuscripts: returns only user's own manuscripts", ...)
  it("getAuthorManuscriptDetail: returns 404 for another user's manuscript", ...)
  it("getAuthorManuscriptDetail: does not include internal notes (visibleToAuthor false)", ...)
  it("author: AUTHOR-only user gets 403 on /admin route", ...)
  it("plainLanguageStatus: maps every status", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement service and pages. Dashboard shows list with Continue/Withdraw actions. Detail shows timeline, files with downloads through existing `/api/journal/files/[fileId]` route, editor message and "Upload corrected files and resubmit" flow.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `git commit -m "feat(journal): author dashboard and manuscript detail page"`

---

## Task 11: Editor screening admin UI

**Files:**
- Create: `src/server/services/manuscript-screening.ts`
- Create: `src/server/actions/manuscript-screening.ts`
- Create: `src/app/admin/journal/manuscripts/page.tsx`
- Create: `src/app/admin/journal/manuscripts/[id]/page.tsx`
- Modify: `src/app/admin/layout.tsx` (add Manuscripts sidebar item)
- Modify: `src/app/admin/page.tsx` (add "Awaiting screening" card)
- Test: `tests/unit/journal/__tests__/manuscript-screening.test.ts`
- Test: `tests/unit/journal/__tests__/permissions-matrix.test.ts` (update matrix)

**Interfaces:**
- `listManuscripts(db, user, filters?): Promise<ManuscriptListRow[]>` — excludes COI manuscripts, applies status/editor filters, diacritic-insensitive search. For HOD: same list but no action buttons.
- `getManuscriptDetail(db, user, manuscriptId)` — 404 for COI; includes metadata, authors, cover letter, suggested/excluded reviewers, agreement record, DOCX metadata warning, files, events, handling editor.
- `assignHandlingEditor(db, actor, manuscriptId, editorId)` — EiC assigns any non-conflicted editor; an editor takes an unassigned manuscript.
- `returnToAuthor(db, actor, manuscriptId, message)` — message required; creates ManuscriptEvent RETURNED_TO_AUTHOR with visibleToAuthor true.
- `deskReject(db, actor, manuscriptId, letter)` — EiC or handling editor only; letter required; creates EditorialDecision DESK_REJECT; author emailed "decision available".
- `approveForReview(db, actor, manuscriptId)` — EiC or handling editor only; status UNDER_REVIEW; author emailed "moved to review".
- `addInternalNote(db, actor, manuscriptId, note)` — journal.editorial only; visibleToAuthor false.

- [ ] **Step 1:** Write tests:
  ```typescript
  it("listManuscripts: COI manuscript never appears for conflicted user", ...)
  it("listManuscripts: HOD sees list but has no action columns", ...)
  it("ADMIN: gets 403 on GET /admin/journal/manuscripts", ...)
  it("LECTURER-only: gets 403 on GET /admin/journal/manuscripts", ...)
  it("AUTHOR-only: gets 403 on GET /admin/journal/manuscripts", ...)
  it("deskReject: non-handling editor returns error", ...)
  it("HOD: deskReject action throws Unauthorized", ...)
  it("SUPER_ADMIN: detail page read creates AuditLog row with id only", ...)
  it("HOD: detail page read creates AuditLog row", ...)
  it("assignHandlingEditor: COI editor cannot be assigned", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement service, actions, pages.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** `git commit -m "feat(journal): editor screening — list, detail, assign, return, reject, approve"`

---

## Task 12: Scripts, public page updates, docs

**Files:**
- Create: `scripts/journal-purge-drafts.ts`
- Modify: `scripts/private-storage-orphans.ts` (cover new ManuscriptFile rows)
- Modify: `scripts/journal-dev-fixture.ts` (add INCOMPLETE draft, submitted manuscript, returned manuscript)
- Create: `docs/JOURNAL-AUTHOR-GUIDE.md`
- Modify: `src/app/(site)/journal/page.tsx` (nav strip: Register/Login/Dashboard)
- Modify: `package.json` (add `journal:purge-drafts` script)
- Modify: `docs/STATE.md` (Stage 12a entry)

**Interfaces:**
- `journal:purge-drafts [--apply]`: select `Manuscript` where `status = INCOMPLETE AND updatedAt < now() - 60 days`, log each id, delete files from storage, delete rows. Dry run by default. Never selects SUBMITTED or later.
- `private-storage:orphans`: extend to also check new `ManuscriptFile` rows uploaded in Stage 12a (same pattern as before).

- [ ] **Step 1:** Write tests for purge script:
  ```typescript
  it("dry run: logs ids but deletes nothing", ...)
  it("apply: deletes INCOMPLETE manuscripts older than 60 days with their files", ...)
  it("apply: never selects SUBMITTED or later status", ...)
  it("apply: never selects INCOMPLETE manuscripts newer than 60 days", ...)
  ```
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `journal-purge-drafts.ts`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Update `journal:dev-fixture --remove` to clean up all new fixture entries.
- [ ] **Step 6:** Update `/journal` public page: nav strip shows Register/Log in when logged out, Dashboard when logged in. "Submit a manuscript" button appears only when `submissionsOpen`.
- [ ] **Step 7:** Add Stage 12a entry to `docs/STATE.md`. Add scheduling note for `journal:purge-drafts` to Stage 14 open items in ROADMAP.md.
- [ ] **Step 8:** Write `docs/JOURNAL-AUTHOR-GUIDE.md` (plain-language instructions for authors, not auto-published).
- [ ] **Step 9:** `git commit -m "feat(journal): purge-drafts script, public page nav, author guide docs"`

---

## Task 13: Permissions matrix test update

**Files:**
- Modify: `tests/unit/auth/__tests__/permissions-matrix.test.ts` (or equivalent)

- [ ] **Step 1:** Find the existing permissions matrix test and update it:
  - Add `journal.editorial`: SUPER_ADMIN ✓, JOURNAL_EDITOR_IN_CHIEF ✓, JOURNAL_EDITOR ✓, HOD ✗, ADMIN ✗, AUTHOR ✗, REVIEWER ✗, LECTURER ✗.
  - Add `journal.manuscripts.read`: SUPER_ADMIN ✓, HOD ✓, JOURNAL_EDITOR_IN_CHIEF ✓, JOURNAL_EDITOR ✓, ADMIN ✗, AUTHOR ✗.
  - Update HOD expectation for manuscript list: "HOD without editor role: read-only access" (no actions).
- [ ] **Step 2:** Run matrix test — PASS.
- [ ] **Step 3:** `git commit -m "test(auth): update permissions matrix for journal.editorial and journal.manuscripts.read"`

---

## Task 14: Final verification — lint, typecheck, tests, build, security-review

- [ ] **Step 1:** `npm run lint` — 0 errors.
- [ ] **Step 2:** `npm run typecheck` — clean.
- [ ] **Step 3:** `npm run test` — full suite passes.
- [ ] **Step 4:** `npm run build` — bundle-leak guard passes, First Load JS for `/journal/submit` and `/journal/dashboard` reported.
- [ ] **Step 5:** Run `/security-review` (per CLAUDE.md rule 4).
- [ ] **Step 6:** Fix any real security findings.
- [ ] **Step 7:** Append AUDIT.md entry 025.
- [ ] **Step 8:** Tick Stage 12a in `docs/ROADMAP.md`.
- [ ] **Step 9:** Final commit: `git commit -m "docs: AUDIT.md entry 025, tick Stage 12a in ROADMAP.md"`
