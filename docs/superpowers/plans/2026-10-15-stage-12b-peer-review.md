# Stage 12b: Peer Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement double-blind peer review — reviewer invitation/accept/decline, review reports, editorial decisions per round, revision rounds, and the reviewer-facing pages — extending the existing manuscript workflow without forking any access-policy or workflow module.

**Architecture:** All new services extend the existing service layer (`src/server/services/`). The schema migration is purely additive. `manuscript-workflow.ts` gains new actions; `manuscript-file-download.ts` is extended through `manuscript-access.ts` for reviewer file access. A single `review-visibility.ts` module is the one place all pages call to decide what a given role sees.

**Tech Stack:** Next.js App Router, TypeScript strict, Prisma/PostgreSQL, Auth.js JWT, private-storage, Resend/React Email, Vitest

**Spec:** docs/prompts/12b-peer-review.md

## Global Constraints

- Never fork `manuscript-file-download.ts` or `manuscript-access.ts`; extend them.
- Never bypass `manuscript-workflow.ts` state machine for status changes.
- Double-blind: reviewer never sees author names, affiliations, TITLE_PAGE file, or submitter identity.
- Tokens: 32 random bytes, base64url, single-use, sha256-hashed at rest, same 404 response for bad/expired/used tokens.
- Invitation email body: reference number only — no title, no names, no abstract.
- Email subject lines: no title or author names.
- HOD: no reviews, no reviewer names/identities, no invitations, no decision drafts.
- ADMIN: no manuscript access (editorial independence).
- No em dashes in UI copy, emails, or docs.
- All rich text sanitized on save and render with `sanitizeRichText` / `renderRichText`.
- Every mutation server-action re-checks permission and state server-side.
- `fileParallelism: false` in vitest config; use unique per-run IDs; no global deletes.
- Permanent retention for reviews and decision letters.

## Review Focus

1. IDOR: a reviewer calling download with a fileId from a *different* manuscript they are not assigned to should get 404 — not 200.
2. Author payload leak: an author-facing API response must never contain `reviewerId`, `reviewerEmail`, `commentsToEditor`, or any `tokenHash` field — even when the author is also an editor on another manuscript.
3. Token replay: a consumed or expired invitation token must return the same response as an unknown token; rate limiting must apply per token endpoint.
4. HOD decision-panel access: a HOD directly calling a decision server action (POST) must be rejected server-side — not just hidden from UI.
5. Conflicted editor: a JOURNAL_EDITOR whose email matches a ManuscriptAuthor row must be blocked from inviting, viewing reviews, and recording a decision even when invited by EiC.

---

### Task 1: Schema migration `journal_peer_review`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261015120000_journal_peer_review/migration.sql` (generated, not hand-written)

**Interfaces:**
- Produces: updated `ReviewAssignment` (+ `invitedById`, `tokenHash`, `declineReason`, `REVOKED` status), updated `Review` (+ `commentsToAuthorHtml`, `commentsToEditorHtml`), updated `EditorialDecision` (+ `letterHtml`, `decidedAt`, `emailSentAt`), new `ReviewerProfile`, new `ManuscriptFileKind.REVIEW_ATTACHMENT`, new `ManuscriptEventType` values, new `JournalSettings` keys (`reviewsRequired`, `reviewDueDays`, `invitationExpiryDays`), new `SiteSetting` rows for those keys.

- [ ] **Step 1: Edit `prisma/schema.prisma`**

  Add to `ReviewAssignmentStatus` enum: `REVOKED`

  Add to `ManuscriptFileKind` enum: `REVIEW_ATTACHMENT`

  Add to `ManuscriptEventType` enum:
  ```
  REVIEWER_INVITED
  REVIEWER_ACCEPTED
  REVIEWER_DECLINED
  REVIEWER_REVOKED
  REVIEWER_EXPIRED
  REVIEW_SUBMITTED
  DECISION_RECORDED
  REVISION_REQUESTED
  ROUND_CREATED
  ```

  Extend `ReviewAssignment` model:
  ```prisma
  invitedById   String?
  tokenHash     String?   @unique
  declineReason String?
  invitedBy     User?     @relation("ReviewAssignmentInvitedBy", fields: [invitedById], references: [id], onDelete: SetNull)
  ```
  Add inverse `reviewAssignmentsInvited ReviewAssignment[] @relation("ReviewAssignmentInvitedBy")` to `User`.

  Extend `Review` model:
  ```prisma
  commentsToAuthorHtml String?
  commentsToEditorHtml String?
  isDraft              Boolean  @default(true)
  ```

  Extend `EditorialDecision` model:
  ```prisma
  letterHtml  String?
  decidedAt   DateTime  @default(now())
  emailSentAt DateTime?
  ```

  Add `ReviewerProfile` model:
  ```prisma
  model ReviewerProfile {
    id           String   @id @default(cuid())
    userId       String   @unique
    expertiseTags String[] @default([])
    isActive     Boolean  @default(true)
    notes        String?
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
    user         User     @relation("ReviewerProfileUser", fields: [userId], references: [id], onDelete: Cascade)
  }
  ```
  Add `reviewerProfile ReviewerProfile? @relation("ReviewerProfileUser")` to `User`.

- [ ] **Step 2: Generate and apply migration**

  Run: `npx prisma migrate dev --name journal_peer_review`
  Expected: migration created and applied, no drift, Prisma client regenerated.

- [ ] **Step 3: Add JournalSettings keys to site-settings registry**

  In `src/server/services/site-settings.ts`, add to the registry:
  - `"journal.reviewsRequired"` — `z.number().int().min(1).max(10)`, default `2`
  - `"journal.reviewDueDays"` — `z.number().int().min(1).max(365)`, default `21`
  - `"journal.invitationExpiryDays"` — `z.number().int().min(1).max(90)`, default `14`

- [ ] **Step 4: Write failing test**

  ```typescript
  // tests/unit/journal/__tests__/schema-migration.test.ts
  it("ReviewAssignment has tokenHash and invitedById columns", async () => {
    const cols = await db.$queryRaw<Array<{column_name: string}>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ReviewAssignment'`;
    const names = cols.map(c => c.column_name);
    expect(names).toContain("tokenHash");
    expect(names).toContain("invitedById");
    expect(names).toContain("declineReason");
  });
  it("ReviewerProfile table exists", async () => {
    const result = await db.reviewerProfile.count();
    expect(result).toBeGreaterThanOrEqual(0);
  });
  it("JournalSettings reviewsRequired default is 2", async () => {
    const val = await getSetting("journal.reviewsRequired");
    expect(val).toBe(2);
  });
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/schema-migration.test.ts`
  Expected: FAIL (table/column not yet created, or column missing)

- [ ] **Step 5: Run test after migration**

  Run: `npx vitest run tests/unit/journal/__tests__/schema-migration.test.ts`
  Expected: PASS 3/3

- [ ] **Step 6: Commit**

  ```bash
  git add prisma/schema.prisma prisma/migrations/ src/server/services/site-settings.ts tests/unit/journal/__tests__/schema-migration.test.ts
  git commit -m "feat(schema): journal_peer_review migration -- ReviewerProfile, tokenHash, JournalSettings keys"
  ```

---

### Task 2: `reviewer-invitation.ts` service

**Files:**
- Create: `src/server/services/reviewer-invitation.ts`
- Create: `src/server/services/__tests__/reviewer-invitation.test.ts`

**Interfaces:**
- Consumes: `ReviewAssignment` (Task 1), `manuscript-screening.ts`'s `isConflicted` pattern, `src/server/services/tokens.ts`'s `hashToken`
- Produces: `inviteReviewer(db, actor, manuscriptId, roundId, reviewerEmail, opts)`, `resendInvitation(db, actor, assignmentId)`, `revokeInvitation(db, actor, assignmentId)`, `expireInvitations(db)`, `acceptInvitation(db, user, rawToken)`, `declineInvitation(db, user, rawToken, reason?)`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // src/server/services/__tests__/reviewer-invitation.test.ts
  it("inviteReviewer creates INVITED assignment with hashed token", ...)
  it("inviteReviewer rejects if reviewer is author (COI)", ...)
  it("inviteReviewer rejects if reviewer is submitter (COI)", ...)
  it("inviteReviewer rejects duplicate invitation on same round", ...)
  it("acceptInvitation sets status ACCEPTED and clears tokenHash", ...)
  it("declineInvitation sets status DECLINED with reason", ...)
  it("revokeInvitation sets status REVOKED and logs audit event", ...)
  it("expired/bad/consumed tokens all return null (indistinguishable)", ...)
  it("expireInvitations marks INVITED-past-expiry as EXPIRED", ...)
  ```

  Run: `npx vitest run src/server/services/__tests__/reviewer-invitation.test.ts`
  Expected: FAIL (module not found)

- [ ] **Step 2: Implement `src/server/services/reviewer-invitation.ts`**

  Functions:
  - `inviteReviewer(db, actor, manuscriptId, roundId, reviewerUserId, opts?: {dueAt?, note?})`: checks `journal.editorial` permission on actor, COI check (reviewer is submitter or author email match), duplicate check `(roundId, reviewerUserId)`, generates 32-byte random token, stores `sha256` hash as `tokenHash`, creates `ReviewAssignment` with status `INVITED`, writes `ManuscriptEvent` type `REVIEWER_INVITED`, writes `AuditLog`. Returns `{ assignmentId, rawToken }`.
  - `resendInvitation(db, actor, assignmentId)`: regenerates token (invalidates old), returns new `rawToken`.
  - `revokeInvitation(db, actor, assignmentId)`: sets status `REVOKED`, writes event + audit log.
  - `expireInvitations(db)`: finds all `INVITED` assignments where `invitedAt + invitationExpiryDays < now`, sets `EXPIRED`, writes events. Returns count.
  - `acceptInvitation(db, user, rawToken)`: hashes token, finds matching `INVITED` assignment, checks expiry (same null response as bad token), sets `ACCEPTED`, sets `respondedAt`, clears `tokenHash` (set `null`), writes event. Returns `{ manuscriptId, roundId }`.
  - `declineInvitation(db, user, rawToken, reason?)`: same lookup pattern, sets `DECLINED`, stores `declineReason`, clears token, writes event.

  Token lookup must hash the raw token and search by `tokenHash`. Bad, expired, used (status not INVITED), and non-existent tokens all return `null` — never distinguish them.

- [ ] **Step 3: Run tests**

  Run: `npx vitest run src/server/services/__tests__/reviewer-invitation.test.ts`
  Expected: PASS all

- [ ] **Step 4: Commit**

  ```bash
  git add src/server/services/reviewer-invitation.ts src/server/services/__tests__/reviewer-invitation.test.ts
  git commit -m "feat(journal): reviewer-invitation service -- invite, accept, decline, revoke, expire"
  ```

---

### Task 3: `review-submission.ts` + reviewer file access extension

**Files:**
- Create: `src/server/services/review-submission.ts`
- Create: `src/server/services/__tests__/review-submission.test.ts`
- Modify: `src/server/services/manuscript-access.ts` (extend for reviewer file access rules)
- Modify: `src/server/services/manuscript-file-download.ts` (pass assignment to canDownloadAs)

**Interfaces:**
- Consumes: `ReviewAssignment` (Task 1), `Review` model, `ManuscriptFileKind.REVIEW_ATTACHMENT` (Task 1)
- Produces: `saveDraftReview(db, user, assignmentId, data)`, `submitReview(db, user, assignmentId, data)`, full reviewer file access (ACCEPTED/SUBMITTED, correct round, no TITLE_PAGE, REVOKED ends access)

- [ ] **Step 1: Write failing tests**

  ```typescript
  // src/server/services/__tests__/review-submission.test.ts
  it("saveDraftReview upserts Review with isDraft=true", ...)
  it("submitReview sets isDraft=false, submittedAt, sanitizes HTML", ...)
  it("submitReview rejects a second submit (already submitted)", ...)
  it("reviewer can download MANUSCRIPT kind while ACCEPTED", ...)
  it("reviewer cannot download TITLE_PAGE kind", ...)
  it("REVOKED assignment: reviewer cannot download any file", ...)
  it("reviewer cannot download files from a different manuscript", ...)
  it("reviewer sees only own round files, not other round files", ...)
  ```

  Run: `npx vitest run src/server/services/__tests__/review-submission.test.ts`
  Expected: FAIL

- [ ] **Step 2: Extend `manuscript-access.ts`**

  In `canDownloadAs`, extend the REVIEWER branch:
  - Allow `MANUSCRIPT`, `SUPPLEMENTARY`, `REVISED`, `RESPONSE_TO_REVIEWERS` kinds only
  - Require assignment status `ACCEPTED` or `SUBMITTED`
  - Require `file.roundId === assignment.roundId`
  - Never allow `TITLE_PAGE` or `COPYEDITED`
  - `REVOKED`, `EXPIRED`, `DECLINED`, `INVITED` statuses: deny
  - Reviewer `displayFilename`: `manuscript-round-${roundNumber}.${ext}` (blind)
  - `auditRequired`: false for reviewer

  Extend `ManuscriptFileAccessInput` if needed to carry `roundId` alongside `roundNumber`.

- [ ] **Step 3: Implement `review-submission.ts`**

  - `saveDraftReview(db, user, assignmentId, data: {recommendation?, commentsToAuthor?, commentsToEditor?})`: checks assignment belongs to user and is `ACCEPTED`; sanitizes rich text (`sanitizeRichText`) before storing; upserts `Review` with `isDraft: true`.
  - `submitReview(db, user, assignmentId, data)`: same checks + requires recommendation + commentsToAuthor non-empty; sanitizes; sets `isDraft: false`, `submittedAt: now`; writes `ManuscriptEvent` type `REVIEW_SUBMITTED`; writes audit log. Rejects if already submitted (`isDraft === false`).

- [ ] **Step 4: Run tests**

  Run: `npx vitest run src/server/services/__tests__/review-submission.test.ts`
  Expected: PASS all

- [ ] **Step 5: Commit**

  ```bash
  git add src/server/services/review-submission.ts src/server/services/__tests__/review-submission.test.ts src/server/services/manuscript-access.ts src/server/services/manuscript-file-download.ts
  git commit -m "feat(journal): review-submission service + reviewer file access rules"
  ```

---

### Task 4: `review-visibility.ts` + `editorial-decision.ts`

**Files:**
- Create: `src/server/services/review-visibility.ts`
- Create: `src/server/services/editorial-decision.ts`
- Create: `src/server/services/__tests__/review-visibility.test.ts`
- Create: `src/server/services/__tests__/editorial-decision.test.ts`

**Interfaces:**
- Consumes: `ReviewAssignment`, `Review`, `EditorialDecision`, `getSetting("journal.reviewsRequired")`, `manuscript-workflow.ts`'s `transition`
- Produces: `getReviewsForEditor(db, user, manuscriptId)`, `getReviewsForAuthor(db, user, manuscriptId)`, `recordDecision(db, actor, manuscriptId, data)`, `sendDecisionLetter(db, actor, decisionId)`

- [ ] **Step 1: Write failing tests**

  ```typescript
  // src/server/services/__tests__/review-visibility.test.ts
  it("editor sees commentsToEditor and reviewer userId", ...)
  it("author sees commentsToAuthorHtml labelled Reviewer 1, 2, 3 — never reviewer identity", ...)
  it("HOD gets empty reviews array (no reviews visible)", ...)
  it("author payload contains no reviewerId, email, commentsToEditor, tokenHash", ...)
  it("reviewer A cannot see reviewer B's review", ...)

  // src/server/services/__tests__/editorial-decision.test.ts
  it("recordDecision rejects when submitted review count < reviewsRequired", ...)
  it("EiC override with reason is audit-logged and allowed", ...)
  it("conflicted editor cannot record decision", ...)
  it("decision transitions state machine to ACCEPTED or REVISION_REQUESTED", ...)
  it("MINOR/MAJOR decision creates new ManuscriptRound N+1", ...)
  it("decision is atomic with ManuscriptEvent and EditorialDecision row", ...)
  ```

  Run: `npx vitest run src/server/services/__tests__/review-visibility.test.ts src/server/services/__tests__/editorial-decision.test.ts`
  Expected: FAIL

- [ ] **Step 2: Implement `review-visibility.ts`**

  `getReviewsForEditor(db, user, manuscriptId)`: requires `journal.editorial` + COI check; returns all submitted reviews with `commentsToAuthor`, `commentsToEditor`, `recommendation`, reviewer userId (but not email/name unless the editor is EiC).

  `getReviewsForAuthor(db, user, manuscriptId)`: requires submitter ownership; returns only submitted reviews (isDraft false); maps each to `{ label: "Reviewer 1", commentsToAuthorHtml, recommendation }` — stable per-manuscript label derived from sort-stable `reviewAssignment.createdAt` order (lowest = Reviewer 1); strips reviewer id, email, any commentsToEditor. The returned array must contain none of: `reviewerId`, `reviewerEmail`, `commentsToEditor`, `tokenHash`, `assignmentId`.

  `getReviewsForHOD()`: always returns `[]`.

- [ ] **Step 3: Implement `editorial-decision.ts`**

  `recordDecision(db, actor, manuscriptId, data: {decision, letterHtml, allowOverride?: boolean, overrideReason?})`:
  - Requires `journal.editorial` on actor + COI check
  - Counts submitted reviews (isDraft false) on current round
  - If count < reviewsRequired: reject unless `allowOverride` + `overrideReason` non-empty; write AuditLog entry flagging the override with reason
  - Sanitize `letterHtml` with `sanitizeRichText`
  - Calls `transition(db, actor, manuscriptId, ...)` to update status
  - Creates `EditorialDecision` row + `ManuscriptEvent` type `DECISION_RECORDED`
  - If `MINOR_REVISION` or `MAJOR_REVISION`: creates new `ManuscriptRound` with `number = currentRound + 1`, increments `Manuscript.currentRound`, writes event type `ROUND_CREATED`, sets status `REVISION_REQUESTED`
  - If `ACCEPT`: sets status `ACCEPTED`
  - If `REJECT`: sets status `REJECTED`
  - All in one `$transaction`

  Add to `manuscript-workflow.ts` `WorkflowAction`: `"RECORD_DECISION"` | `"REQUEST_REVISION"` | `"ACCEPT"` with appropriate guard rules.

- [ ] **Step 4: Run tests**

  Run: `npx vitest run src/server/services/__tests__/review-visibility.test.ts src/server/services/__tests__/editorial-decision.test.ts`
  Expected: PASS all

- [ ] **Step 5: Commit**

  ```bash
  git add src/server/services/review-visibility.ts src/server/services/editorial-decision.ts src/server/services/__tests__/review-visibility.test.ts src/server/services/__tests__/editorial-decision.test.ts src/server/services/manuscript-workflow.ts
  git commit -m "feat(journal): review-visibility + editorial-decision services"
  ```

---

### Task 5: Email templates (8 new)

**Files:**
- Create: `src/emails/reviewer-invitation.tsx`
- Create: `src/emails/reviewer-reminder.tsx`
- Create: `src/emails/reviewer-overdue.tsx`
- Create: `src/emails/reviewer-accepted.tsx`
- Create: `src/emails/reviewer-declined.tsx`
- Create: `src/emails/review-submitted.tsx`
- Create: `src/emails/revision-received.tsx`
- Create: `src/emails/reviewer-thank-you.tsx`
- Modify: `src/lib/email.ts` (add send functions for each)

**Interfaces:**
- Consumes: React Email pattern from existing templates (e.g. `src/emails/journal-submission-received.tsx`)
- Produces: `sendReviewerInvitation(to, ref, inviteUrl)`, `sendReviewerReminder(to, ref, dueAt, reviewUrl)`, `sendReviewerOverdue(to, ref, editorTo?)`, `sendReviewerAccepted(to, ref, reviewerName)`, `sendReviewerDeclined(to, ref)`, `sendReviewSubmitted(to, ref, reviewUrl)`, `sendRevisionReceived(to, ref, manuscriptUrl)`, `sendReviewerThankYou(to, ref)`

- [ ] **Step 1: Write failing test**

  ```typescript
  // tests/unit/journal/__tests__/email-templates.test.ts
  it("reviewer-invitation: body contains ref, no title, no author name", ...)
  it("reviewer-invitation subject: no title or name", ...)
  it("revision-received: body contains ref, sign-in link, no review content", ...)
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/email-templates.test.ts`
  Expected: FAIL

- [ ] **Step 2: Implement all 8 templates**

  Each template:
  - Plain text style (matching existing templates)
  - Subject line: never contains title or author name — e.g. "Reviewer invitation: [REF]", "Review due soon: [REF]"
  - Body: reference number and a sign-in/action link only; no manuscript title, no author names, no abstract
  - No em dashes

  `reviewer-invitation.tsx` body: "You have been invited to review manuscript [REF]. Please sign in to view the abstract and accept or decline." + `inviteUrl`

- [ ] **Step 3: Run test**

  Run: `npx vitest run tests/unit/journal/__tests__/email-templates.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/emails/reviewer-*.tsx src/emails/review-submitted.tsx src/emails/revision-received.tsx src/emails/reviewer-thank-you.tsx src/lib/email.ts tests/unit/journal/__tests__/email-templates.test.ts
  git commit -m "feat(journal): 8 reviewer/review/decision email templates"
  ```

---

### Task 6: Server actions for review workflow

**Files:**
- Create: `src/server/actions/reviewer-invitation.ts`
- Create: `src/server/actions/review-submission.ts`
- Create: `src/server/actions/editorial-decision.ts`
- Create: `src/lib/validators/review.ts`

**Interfaces:**
- Consumes: services from Tasks 2, 3, 4; zod validators
- Produces: `inviteReviewerAction`, `revokeInvitationAction`, `resendInvitationAction`, `acceptInvitationAction(rawToken)`, `declineInvitationAction(rawToken, reason?)`, `saveDraftReviewAction`, `submitReviewAction`, `recordDecisionAction`, `sendDecisionLetterAction`

- [ ] **Step 1: Write failing test**

  ```typescript
  // tests/unit/journal/__tests__/review-actions-auth.test.ts
  it("inviteReviewerAction: AUTHOR-only session → throws Unauthorized", ...)
  it("acceptInvitationAction: bad token → same error as expired token", ...)
  it("recordDecisionAction: HOD session → throws Unauthorized", ...)
  it("recordDecisionAction: conflicted editor → throws Unauthorized", ...)
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/review-actions-auth.test.ts`
  Expected: FAIL

- [ ] **Step 2: Implement validators `src/lib/validators/review.ts`**

  ```typescript
  export const inviteReviewerSchema = z.object({
    manuscriptId: z.string().cuid(),
    roundId: z.string().cuid(),
    reviewerUserId: z.string().cuid(),
    dueAt: z.string().datetime().optional(),
  });
  export const submitReviewSchema = z.object({
    assignmentId: z.string().cuid(),
    recommendation: z.enum(["ACCEPT","MINOR_REVISION","MAJOR_REVISION","REJECT"]),
    commentsToAuthor: z.string().trim().min(1, "Comments to author are required").max(50_000),
    commentsToEditor: z.string().trim().max(50_000).optional(),
  });
  export const recordDecisionSchema = z.object({
    manuscriptId: z.string().cuid(),
    decision: z.enum(["ACCEPT","MINOR_REVISION","MAJOR_REVISION","REJECT"]),
    letterHtml: z.string().trim().min(1, "Decision letter is required"),
    overrideReason: z.string().trim().max(2000).optional(),
  });
  ```

- [ ] **Step 3: Implement the three action files**

  Each action:
  1. `requireSession()` (throw redirect to /login if no session)
  2. Parse input with zod (throw `{ error }` on failure)
  3. Call service function
  4. `revalidatePath` where needed

- [ ] **Step 4: Run tests**

  Run: `npx vitest run tests/unit/journal/__tests__/review-actions-auth.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/server/actions/reviewer-invitation.ts src/server/actions/review-submission.ts src/server/actions/editorial-decision.ts src/lib/validators/review.ts tests/unit/journal/__tests__/review-actions-auth.test.ts
  git commit -m "feat(journal): server actions for reviewer invitation, review submission, editorial decision"
  ```

---

### Task 7: Reviewer-facing pages

**Files:**
- Create: `src/app/(site)/journal/reviewer/page.tsx` (dashboard)
- Create: `src/app/(site)/journal/reviewer/invitation/[token]/page.tsx`
- Create: `src/app/(site)/journal/reviewer/assignments/[id]/page.tsx` (review form)
- Create: `src/app/(site)/journal/reviewer/assignments/[id]/review-form.tsx` (client, autosave)

**Interfaces:**
- Consumes: `acceptInvitationAction`, `declineInvitationAction`, `saveDraftReviewAction`, `submitReviewAction`, `getReviewsForEditor` (own assignment only)
- Produces: reviewer dashboard, invitation accept/decline page, review form with autosave

- [ ] **Step 1: Reviewer dashboard `src/app/(site)/journal/reviewer/page.tsx`**

  Server component. Requires `journal.review` permission (redirect to /login if no session, /403 if wrong role). Loads all `ReviewAssignment` rows for the user. Shows:
  - Pending invitations (INVITED): reference, invited date, accept/decline buttons
  - Active assignments (ACCEPTED): reference, due date, link to review form
  - Completed (SUBMITTED): reference, submitted date
  - Declined/Expired/Revoked: reference, status badge

  No manuscript title, no author names anywhere on this page.

- [ ] **Step 2: Invitation page `src/app/(site)/journal/reviewer/invitation/[token]/page.tsx`**

  Server component. Loads token from URL, calls `acceptInvitation` / shows accept+decline form.
  - If no session: redirect to `/login?callbackUrl=...`
  - If bad/expired/used token: show "This invitation is no longer valid." (identical message for all bad token cases)
  - If valid: show title and abstract (after login), accept button, decline button with optional reason field
  - Actions call `acceptInvitationAction` / `declineInvitationAction`

- [ ] **Step 3: Review form `src/app/(site)/journal/reviewer/assignments/[id]/page.tsx`**

  Server component wrapper. Loads assignment for the signed-in user; 404 if not found or not theirs. Passes anonymised file list (only non-TITLE_PAGE kinds, displayed as `manuscript-round-N.pdf`). Renders `<ReviewForm>` client component with autosave.

  `review-form.tsx`: client component. Fields: recommendation (radio: Accept / Minor revision / Major revision / Reject), Comments to Author (rich text, required), Comments to Editor (plain textarea, optional). Autosave debounced 1500 ms via `saveDraftReviewAction`. Submit confirmation dialog.

- [ ] **Step 4: Write smoke test (no DB required)**

  ```typescript
  // tests/unit/journal/__tests__/reviewer-pages-auth.test.ts
  it("reviewer dashboard page file exists and exports default", ...)
  it("invitation page file exists and exports default", ...)
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/reviewer-pages-auth.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/(site)/journal/reviewer/
  git commit -m "feat(journal): reviewer dashboard, invitation, and review form pages"
  ```

---

### Task 8: Admin extensions — reviewers panel + decision panel

**Files:**
- Modify: `src/app/admin/journal/manuscripts/[id]/page.tsx` (add Reviewers, Reviews, Decision panels)
- Create: `src/app/admin/journal/manuscripts/[id]/reviewers-panel.tsx`
- Create: `src/app/admin/journal/manuscripts/[id]/reviews-panel.tsx`
- Create: `src/app/admin/journal/manuscripts/[id]/decision-panel.tsx`
- Create: `src/app/admin/journal/reviewers/page.tsx`
- Create: `src/app/admin/journal/reviewers/reviewer-row.tsx`
- Create: `src/app/admin/journal/reviewers/reviewer-form.tsx`

**Interfaces:**
- Consumes: `inviteReviewerAction`, `revokeInvitationAction`, `resendInvitationAction`, `getReviewsForEditor`, `recordDecisionAction`, `ReviewerProfile` CRUD

- [ ] **Step 1: Reviewers panel `reviewers-panel.tsx`**

  Shows current round's `ReviewAssignment` rows: reviewer name (editors see name; hidden from HOD panel — HOD panel is server-side excluded), status chip (INVITED/ACCEPTED/SUBMITTED/DECLINED/REVOKED/EXPIRED), due date, action buttons (Resend, Revoke — only for editors). Reviewer picker: search `ReviewerProfile` by expertise tags or name; also manual email field. COI-blocked reviewers are not shown in the picker.

- [ ] **Step 2: Reviews panel `reviews-panel.tsx`**

  Editors only (HOD excluded). Shows each submitted review: `Reviewer 1, 2, 3` label, recommendation badge, Comments to Author (rendered HTML), Comments to Editor (rendered HTML). Never shows reviewer name or email.

- [ ] **Step 3: Decision panel `decision-panel.tsx`**

  EiC/SUPER_ADMIN/handling editor only. Shows: decision radio (Accept / Minor / Major / Reject), letter composer (rich text), submitted review count vs `reviewsRequired`, override checkbox + reason field (when count < minimum). Preview button. Send button calls `recordDecisionAction`.

- [ ] **Step 4: `/admin/journal/reviewers` page**

  `journal.editorial` required. Table of `ReviewerProfile` rows. Edit: expertise tags, active toggle, notes (editor-only field). Create reviewer profile for an existing user.

- [ ] **Step 5: Write smoke tests**

  ```typescript
  // tests/unit/journal/__tests__/admin-review-panels.test.ts
  it("reviewers panel file exists", ...)
  it("decision panel file exists", ...)
  it("admin reviewers page file exists", ...)
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/admin-review-panels.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**

  ```bash
  git add src/app/admin/journal/manuscripts/[id]/reviewers-panel.tsx src/app/admin/journal/manuscripts/[id]/reviews-panel.tsx src/app/admin/journal/manuscripts/[id]/decision-panel.tsx src/app/admin/journal/reviewers/
  git commit -m "feat(admin): reviewer panel, reviews panel, decision panel + /admin/journal/reviewers"
  ```

---

### Task 9: Author dashboard — decision letter + revision upload

**Files:**
- Modify: `src/app/(site)/journal/dashboard/[id]/page.tsx`
- Create: `src/app/(site)/journal/dashboard/[id]/revision-upload-form.tsx` (client)

**Interfaces:**
- Consumes: `getReviewsForAuthor`, `EditorialDecision.letterHtml` (rendered), `manuscript-submission.ts`'s resubmit pattern

- [ ] **Step 1: Extend dashboard detail page**

  After the status timeline, show:
  - Decision letter (when `EditorialDecision` with `MINOR_REVISION`/`MAJOR_REVISION`/`ACCEPT`/`REJECT` exists): rendered `letterHtml` via `renderRichText`. Never show a DESK_REJECT letter.
  - Reviewer comments: `getReviewsForAuthor` returns `[{label: "Reviewer 1", commentsToAuthorHtml, recommendation}]`; render each in a collapsible card. Verify no reviewer identity in rendered output.
  - Revision upload form (when status is `REVISION_REQUESTED`): upload REVISED file, upload RESPONSE_TO_REVIEWERS file (required), submit resubmission. Calls existing `resubmit` server action pattern from 12a.

- [ ] **Step 2: Write test (author payload leak scan)**

  ```typescript
  // tests/unit/journal/__tests__/author-payload-leak.test.ts
  it("getReviewsForAuthor returns no reviewerId, email, commentsToEditor, tokenHash", async () => {
    // create manuscript, reviewer, submitted review
    const reviews = await getReviewsForAuthor(db, author, manuscriptId);
    const json = JSON.stringify(reviews);
    expect(json).not.toMatch(/reviewerId|reviewerEmail|commentsToEditor|tokenHash/);
  });
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/author-payload-leak.test.ts`
  Expected: FAIL (module not implemented yet)

- [ ] **Step 3: Implement and run**

  Run: `npx vitest run tests/unit/journal/__tests__/author-payload-leak.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/(site)/journal/dashboard/[id]/page.tsx src/app/(site)/journal/dashboard/[id]/revision-upload-form.tsx tests/unit/journal/__tests__/author-payload-leak.test.ts
  git commit -m "feat(journal): author dashboard -- decision letter, reviewer comments, revision upload"
  ```

---

### Task 10: `journal-review-reminders.ts` script + dev-fixture extension

**Files:**
- Create: `scripts/journal-review-reminders.ts`
- Modify: `scripts/journal-dev-fixture.ts` (add reviewer, invitation, submitted review, decision)
- Modify: `scripts/private-storage-orphans.ts` (cover `REVIEW_ATTACHMENT` kind)
- Modify: `package.json` (add `journal:review-reminders` npm script)

**Interfaces:**
- Consumes: `expireInvitations`, `sendReviewerReminder`, `sendReviewerOverdue` from Tasks 2 and 5

- [ ] **Step 1: Write failing test**

  ```typescript
  // tests/unit/journal/__tests__/review-reminders.test.ts
  it("dry-run: lists due-soon assignments, sends no emails", ...)
  it("--apply: idempotent — running twice sends each reminder only once", ...)
  it("expireInvitations marks past-expiry INVITED assignments EXPIRED", ...)
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/review-reminders.test.ts`
  Expected: FAIL

- [ ] **Step 2: Implement `scripts/journal-review-reminders.ts`**

  Dry-run by default; `--apply` flag sends emails and marks milestones sent. Logic:
  1. Call `expireInvitations(db)` (always, even dry-run, to keep state clean — but only when `--apply`)
  2. Find `INVITED` assignments past `invitedAt + invitationExpiryDays` → mark EXPIRED
  3. Find `ACCEPTED` assignments where `dueAt` within 3 days → send due-soon reminder (once only: check `reminderSentAt`, or add `reminderDueSoonAt` flag — use `ManuscriptEvent` type `REVIEWER_REMINDER_SENT` as idempotency gate)
  4. Find `ACCEPTED` assignments past `dueAt` → send overdue notice to reviewer and handling editor (once only, same idempotency pattern)

  Refuses to run with `NODE_ENV=production` without `--apply` (dry-run default).

- [ ] **Step 3: Extend `journal-dev-fixture.ts`**

  In the `create` path: after the existing reviewer invitation, also create a `ReviewerProfile`, an `ACCEPTED` assignment, a submitted `Review`, and a `MINOR_REVISION` `EditorialDecision`.
  In the `--remove` path: delete all of the above in reverse-dependency order.

- [ ] **Step 4: Extend `private-storage-orphans.ts`**

  The existing script queries `ManuscriptFile` rows. Ensure it covers all `ManuscriptFileKind` values including `REVIEW_ATTACHMENT` — if it uses `findMany` with no `kind` filter it already does; verify and add a comment confirming it.

- [ ] **Step 5: Run tests**

  Run: `npx vitest run tests/unit/journal/__tests__/review-reminders.test.ts`
  Expected: PASS

- [ ] **Step 6: Commit**

  ```bash
  git add scripts/journal-review-reminders.ts scripts/journal-dev-fixture.ts scripts/private-storage-orphans.ts package.json tests/unit/journal/__tests__/review-reminders.test.ts
  git commit -m "feat(journal): review-reminders script, dev-fixture extension, orphans REVIEW_ATTACHMENT"
  ```

---

### Task 11: Docs + DECISIONS.md + ROADMAP

**Files:**
- Modify: `docs/DECISIONS.md` (8 new decisions from section 1)
- Modify: `docs/JOURNAL.md` (flow, full state table, visibility table, Stage 12b section)
- Create: `docs/JOURNAL-REVIEWER-GUIDE.md`
- Modify: `docs/AUTH.md` (REVIEWER role, `journal.review` permission)
- Modify: `docs/DATA-MODEL.md` (new models, updated fields)
- Modify: `docs/STATE.md` (Stage 12b section)
- Modify: `docs/ROADMAP.md` (tick 12b, ensure 12c exists, add Stage 14 items)

- [ ] **Step 1: Record decisions 63-70 in `docs/DECISIONS.md`**

  Decision 63: Double-blind review (reviewers never see TITLE_PAGE, author names, affiliations, submitter identity; authors never see reviewer identity; editors see everything not conflicted).
  Decision 64: REVIEWER role added; a user may hold AUTHOR and REVIEWER simultaneously.
  Decision 65: Invitation email body contains reference number only; invitation page shows title+abstract only after login.
  Decision 66: Default review due date 21 days from acceptance; reminders run from `journal:review-reminders` script, never in request handlers.
  Decision 67: Review recommendations: ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT. commentsToAuthor required; commentsToEditor optional; one REVIEW_ATTACHMENT optional (stored unchanged, DOCX metadata warning shown).
  Decision 68: Editorial decisions: ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT (DESK_REJECT is Stage 12a, unchanged). Decision letter composed by editor, reviewer comments included only when editor explicitly includes them; reviewer identity stripped by construction.
  Decision 69: HOD has no access to reviews, reviewer identities, invitations, or decision drafts; HOD read-only on manuscripts is unchanged from Decision 58.
  Decision 70: Minimum 2 submitted reviews (configurable: `journal.reviewsRequired` in JournalSettings) before a decision can be recorded. EiC/SUPER_ADMIN may override with a written reason; the override is audit-logged.

- [ ] **Step 2: Update docs/JOURNAL.md**

  Add section "What Stage 12b adds" covering: state transitions, full state diagram in table form, visibility table updated for reviewers, REVIEW_ATTACHMENT kind.

- [ ] **Step 3: Create `docs/JOURNAL-REVIEWER-GUIDE.md`**

  Plain language: how to accept an invitation, how to navigate to the review form, what anonymisation means, how to submit.

- [ ] **Step 4: Tick ROADMAP.md, ensure 12c and Stage 14 items**

  Tick `[x] 12b`. If `12c` line is absent, add: `- [ ] 12c Publish accepted manuscript as an article (DOI/citation fields, reviewer acknowledgements)`. Ensure Stage 14 includes: `Schedule npm run journal:review-reminders and npm run journal:purge-drafts`.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/DECISIONS.md docs/JOURNAL.md docs/JOURNAL-REVIEWER-GUIDE.md docs/AUTH.md docs/DATA-MODEL.md docs/STATE.md docs/ROADMAP.md
  git commit -m "docs(stage-12b): decisions 63-70, JOURNAL.md state table, reviewer guide, ROADMAP tick"
  ```

---

### Task 12: Permissions-matrix test update + security tests

**Files:**
- Modify: `src/server/services/__tests__/manuscript-access.test.ts` (or nearest permissions matrix test)
- Create: `tests/unit/journal/__tests__/review-security.test.ts`

**Interfaces:**
- Consumes: all services from Tasks 2-4
- Produces: full visibility matrix (editor, EiC, SUPER_ADMIN, HOD, ADMIN, author, reviewer A, reviewer B, anonymous) × every read path

- [ ] **Step 1: Write failing security tests**

  ```typescript
  // tests/unit/journal/__tests__/review-security.test.ts
  it("IDOR: reviewer A cannot download file assigned to reviewer B's manuscript", ...)
  it("author payload: getReviewsForAuthor contains no private fields", ...)
  it("token replay: consumed token returns same null as bad token", ...)
  it("HOD calling recordDecision server action → Unauthorized", ...)
  it("conflicted editor cannot invite reviewer", ...)
  it("conflicted editor cannot view reviews", ...)
  it("conflicted editor cannot record decision", ...)
  it("ADMIN cannot call inviteReviewer action", ...)
  it("AUTHOR-only cannot call inviteReviewer action", ...)
  ```

  Run: `npx vitest run tests/unit/journal/__tests__/review-security.test.ts`
  Expected: FAIL

- [ ] **Step 2: Update permissions matrix test file**

  Extend the existing permissions matrix test (find by `grep -r "permissions matrix\|permission.*matrix" tests/` ) to cover REVIEWER role in the journal section and the new `journal.review` permission.

- [ ] **Step 3: Run all security tests**

  Run: `npx vitest run tests/unit/journal/__tests__/review-security.test.ts`
  Expected: PASS all 9

- [ ] **Step 4: Commit**

  ```bash
  git add tests/unit/journal/__tests__/review-security.test.ts
  git commit -m "test(journal): review security matrix -- IDOR, payload leak, token replay, HOD/ADMIN/COI blocks"
  ```

---

### Task 13: Quality gate + AUDIT entry

**Files:**
- Modify: `AUDIT.md`

- [ ] **Step 1: typecheck**

  Run: `npx tsc --noEmit 2>&1`
  Expected: 0 errors

- [ ] **Step 2: lint**

  Run: `npx next lint 2>&1`
  Expected: 0 errors

- [ ] **Step 3: full test suite ×2**

  Run twice: `npx vitest run 2>&1 | tail -5`
  Expected: same count both runs, 0 failures

- [ ] **Step 4: build + bundle**

  Run: `npm run build 2>&1 | tail -20`
  Expected: build succeeds; run `npx tsx scripts/check-bundle-leaks.ts`
  Expected: 0 leaks, shared JS no larger than main measured the same way

- [ ] **Step 5: sendLecturerInvite timing ×3**

  Run: `npx vitest run src/server/services/__tests__/lecturer-import.test.ts --reporter=verbose 2>&1 | grep -i "invite\|ms\|duration"`
  Expected: 3 runs all pass, none exceed 3000 ms

- [ ] **Step 6: Append AUDIT.md entry 031**

  Template per AUDIT.md header. Sections 1-10 coverage table. Open issues.

- [ ] **Step 7: Commit**

  ```bash
  git add AUDIT.md
  git commit -m "chore(stage-12b): AUDIT.md entry 031, quality gate pass"
  ```

---

## Self-review

**Spec coverage:**
- Section 1 decisions: all 8 → Tasks 11 (docs) + all service tasks enforce them
- Section 2 schema: all models → Task 1
- Section 3 services: all 5 → Tasks 2, 3, 4
- Section 4 pages: all reviewer + admin + author pages → Tasks 7, 8, 9
- Section 5 emails: all 8 templates → Task 5
- Section 6 security rules: → Task 12 (tests) + enforced in Tasks 2-4
- Section 7 tests: state machine transitions, invite/accept/decline, COI, reviewsRequired, submit locks, visibility matrix, payload leak, token, file access, decision round creation, resubmission, email bodies → Tasks 2-4, 6, 9, 12
- Section 8 scripts + docs: reminders script, dev-fixture extension, orphans, all 5 doc files, ROADMAP → Tasks 10, 11
- Sections 9-10 quality gate and script verification → Task 13
- Section 11 finish + AUDIT → Task 13

**Review Focus coverage:**
1. IDOR test: `review-security.test.ts` — reviewer A vs reviewer B's manuscript
2. Author payload leak: `author-payload-leak.test.ts` + `review-security.test.ts`
3. Token replay: `review-security.test.ts` — consumed token returns same null
4. HOD decision-panel: `review-security.test.ts` — HOD calling action rejected server-side
5. Conflicted editor: `reviewer-invitation.test.ts` + `review-security.test.ts`
