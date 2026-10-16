# Stage 12b: Peer review (reviewer assignment, reviews, decisions, revision rounds)

Branch: `stage/12b-peer-review`, created from an updated `main`. Never push or merge.
Publishing an accepted paper as an article is Stage 12c, NOT this stage.

## 0. Start (do this first, report in 10 lines)
1. `git checkout main && git pull`, confirm clean tree, then `git checkout -b stage/12b-peer-review`.
2. Even if this session has older context, re-read from disk now: CLAUDE.md, docs/SCOPE.md, docs/ROADMAP.md, docs/STATE.md, docs/DECISIONS.md, docs/JOURNAL.md, docs/AUTH.md, docs/DATA-MODEL.md, docs/prompts/12a-journal-submission.md, and the last 4 entries of AUDIT.md (including the 12a corrective entries).
3. Read src/server/services/manuscript-workflow.ts, manuscript-file-download.ts, manuscript-screening.ts and the permissions matrix test. All new work extends these. Do not create a parallel access policy.
4. Check main for stray 12b work (PR #14 was titled with "12b squash"). Report if any reviewer or review model/route already exists.
5. Open 12a items: report (a) why shared First Load JS is 197.9 kB when the earlier baseline was about 159 kB, (b) the cause of the sendLecturerInvite slowdown (1190 ms main vs 4236 ms branch). If either is unexplained, fix it first in its own commit. Do not continue past step 0 with an unexplained shared-JS regression.
6. Print: branch, base commit, test count, and which decisions in section 1 apply.

## 1. Decisions (record in docs/DECISIONS.md; conflicts with SCOPE/DECISIONS mean stop and ask)
- Double-blind. Reviewers never see author names, affiliations, the TITLE_PAGE file, or submitter identity. Authors never see reviewer identity. Editors see everything they are not conflicted from.
- Reviewers: invited by email, must have a verified account to accept (reuse the 12a registration and verification flow; new role REVIEWER added alongside AUTHOR, a user can hold both). Reviewers can never be invited for a manuscript where they are the submitter, a listed co-author (case-insensitive email match), or share the editor's COI rule.
- Invitation email contains the reference number only (no title, no names, no abstract). The invitation page (signed single-use token, expires 14 days) shows title and abstract after login; accept or decline there. Decline reason optional.
- Default review due date 21 days from acceptance, editor can change per assignment. Invitation expiry and due-date reminders run from a script (see section 8), never in request handlers.
- Recommendations: ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT. Each review has commentsToAuthor (rich text, sanitized on save and render with renderRichText) and commentsToEditor (confidential, never shown to authors). Optional one private attachment (kind REVIEW_ATTACHMENT, stored exactly as received, DOCX/PDF metadata warning shown to the reviewer, never altered).
- Decisions (by journal.editorial roles: SUPER_ADMIN, EiC, Editor, and only if not conflicted): ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT. The decision letter is composed by the editor, can include chosen reviewer comments, and has reviewer identity stripped by construction.
- HOD stays read-only on manuscripts (journal.manuscripts.read) and sees NO reviews, reviewer names, invitations or decision drafts. ADMIN has no journal access. Reads of reviews by SUPER_ADMIN are audit-logged.
- Minimum reviews before a decision can be recorded: 2 submitted (configurable in JournalSettings, default 2). EiC/SUPER_ADMIN may override with a required written reason that is audit-logged.
- Permanent retention applies to reviews and decision letters as it does to manuscripts.

## 2. Schema (one migration `journal_peer_review`, additive)
Read the existing models first and match naming. Add:
- `ReviewAssignment`: manuscriptId, roundId, reviewerUserId, status (INVITED, ACCEPTED, DECLINED, EXPIRED, REVOKED, SUBMITTED), invitedById, invitedAt, respondedAt, dueAt, tokenHash (store hash only), declineReason, unique (roundId, reviewerUserId).
- `Review`: assignmentId unique, recommendation, commentsToAuthorHtml, commentsToEditorHtml, submittedAt, plus `ReviewAttachment` via ManuscriptFile kind REVIEW_ATTACHMENT linked to the assignment.
- `EditorialDecision` (extend the 12a model if it exists): roundId, decision, letterHtml, decidedById, decidedAt, emailSentAt.
- `ReviewerProfile`: userId unique, expertiseTags (string[]), isActive, notes (editor-only). Used for the reviewer picker.
- JournalSettings: reviewsRequired (default 2), reviewDueDays (default 21), invitationExpiryDays (default 14).
- Extend ManuscriptStatus and the state machine in manuscript-workflow.ts (do not bypass it): add states for UNDER_REVIEW, REVIEWS_COMPLETE (or equivalent), REVISIONS_REQUESTED, plus ACCEPTED and REJECTED if not present. List every legal transition in the file and in docs/JOURNAL.md.
Every query that returns anything reviewer-related must use an explicit public-safe select. Reviewer identity must never be reachable from an author-facing query, include, or serializer.

## 3. Services (src/server/services, extend existing patterns, ContentRevision/AuditLog/ManuscriptEvent as in 12a)
- `reviewer-invitation.ts`: invite (checks COI, duplicates, round state, editor permission), resend, revoke, expire, accept, decline. Token is random, single use, hashed at rest. Responses to bad or expired tokens are identical.
- `review-submission.ts`: save draft, submit (locks the review; no edits after submit except by an editor reopening, which is audit-logged), attachment upload through the existing private upload route pattern with CSRF and magic-byte checks.
- `reviewer-file-access.ts`: extend decideManuscriptFileDownload (do not fork it). A reviewer may download only the anonymised manuscript kinds of the round they are assigned to, only while the assignment is ACCEPTED or SUBMITTED, never TITLE_PAGE or cover letter or response-to-reviewers from other rounds. Revoking an assignment ends access immediately. Every reviewer file read writes an audit entry.
- `editorial-decision.ts`: record decision (checks reviewsRequired, COI, state machine), compose and send letter, create next round on revision, set status. A decision is atomic with its ManuscriptEvent and email dispatch record.
- `review-visibility.ts`: single module deciding who sees what (editor, reviewer, author, HOD, SUPER_ADMIN). All pages and actions call it.
- Revision flow: author sees decision letter plus commentsToAuthor of each submitted review (reviewers labelled Reviewer 1, 2, 3 stable per manuscript, never by name). Author resubmits using the 12a RETURNED/resubmit pattern: new ManuscriptRound, revised files, mandatory response-to-reviewers file or text. Editor may re-invite the same reviewers (new assignment, same round rules).

## 4. Pages and actions
- Admin: `/admin/journal/manuscripts/[id]` gains Reviewers panel (picker from ReviewerProfile plus invite by email, status chips, resend/revoke, due dates), Reviews panel (full text, to editor and to author), Decision panel (draft letter, preview, send). `/admin/journal/reviewers` list and edit (expertise, active, notes), editors only.
- Reviewer: `/journal/reviewer` dashboard (invitations, active reviews with due dates, history), `/journal/reviewer/invitation/[token]`, `/journal/reviewer/assignments/[id]` (anonymised files, review form with autosave, submit confirmation).
- Author: `/journal/dashboard/[id]` shows decision letter, Reviewer 1..n comments to author, revision upload form with response to reviewers.
- Every server action re-checks permission and state server side. No client trust.

## 5. Emails (React Email, console fallback in dev, no titles or names in subject lines or invitation bodies)
reviewer-invitation, reviewer-reminder, reviewer-overdue (to reviewer and handling editor), reviewer-accepted/declined (to editor), review-submitted (to editor), decision-letter (to author, contains letter text only through the authenticated dashboard link; the email says a decision is available, not the decision itself), revision-received (to editor), reviewer-thank-you.

## 6. Security and privacy rules (tests must prove each)
- A reviewer cannot read another reviewer's review, any author data, or any manuscript they are not assigned to (IDOR tests with two reviewers and two manuscripts).
- A conflicted editor (author, co-author by case-insensitive email) cannot invite, view reviews, or decide. SUPER_ADMIN is also blocked unless not conflicted.
- An author-facing response never contains reviewer ids, emails, names, tokens, commentsToEditor, or internal notes. Add a serialization test that scans author-facing payloads for those fields.
- Tokens: single use, expired and used tokens give the same response as unknown tokens, rate limited.
- File responses: attachment disposition, private no-store, nosniff, byte-identical to upload (sha256).
- HOD gets 403 or hidden UI for reviewers, reviews, invitations, decisions. ADMIN and AUTHOR-only get 403/404.
- Sanitization: review HTML sanitized on save and on render; test with script payloads.

## 7. Tests (vitest, DB tests use the _test database with unique per-run data; no global deletes)
State machine legal/illegal transitions; invite/accept/decline/expire/revoke; COI cases; reviewsRequired gate and override audit; review submit locks; visibility matrix (editor, EiC, SUPER_ADMIN, HOD, ADMIN, author, reviewer A, reviewer B, anonymous) across every read path; author payload leak scan; token behavior; reviewer file access including revoked and other-round; decision to revision creates round N+1; resubmission; email templates contain no title or author names; permissions matrix test updated.

## 8. Scripts and docs
- `scripts/journal-review-reminders.ts` (dry-run by default, `--apply`): expires old invitations, sends due-soon and overdue reminders, idempotent, never emails twice for the same milestone. Add npm script `journal:review-reminders`.
- Extend `journal:dev-fixture` (create and `--remove`) with a reviewer, an invitation, a submitted review and a decision, leaving nothing behind on remove.
- Extend `private-storage:orphans` for REVIEW_ATTACHMENT files.
- Docs: docs/JOURNAL.md (flow, states, visibility table), docs/JOURNAL-REVIEWER-GUIDE.md (plain language), docs/AUTH.md (REVIEWER role, permissions), docs/DATA-MODEL.md, docs/STATE.md, ROADMAP tick for 12b, and add 12c (publish accepted paper as an article, DOI/citation fields, reviewer acknowledgements) to the ROADMAP if absent. Add to the Stage 14 list: scheduled run of journal:review-reminders and journal:purge-drafts.

## 9. Quality gate
Run and paste real output: typecheck, lint, full test suite (twice), build. Measure First Load JS for the new reviewer pages against the production standalone build and compare with main measured the same way; shared JS must not grow. Run the bundle-leak guard and assert no client chunk contains private-storage, argon2 or server-only services. Time sendLecturerInvite and report.

## 10. Verify by script (paste output, no summaries)
Reviewer sees anonymised files only; TITLE_PAGE download returns 403/404 for the reviewer; revoked reviewer loses access immediately; author-facing payload contains no reviewer data; HOD cannot read reviews and cannot call a decision action; ADMIN and AUTHOR-only get 403/404; conflicted editor blocked; decision before reviewsRequired blocked, override works and is audit-logged; invitation token reuse and expiry behave identically to a bad token; reminder script dry-run lists the right items and `--apply` is idempotent; dev-fixture create then remove leaves zero rows; console shows the invitation email with no title or names.

## 11. Finish
Conventional commits. Append an AUDIT.md entry (what was built, decisions, deviations, open issues, honest list of what you could not verify). Do not edit old entries. Report: a row-by-row coverage table against sections 1 to 10 (built and tested with test name, built but untested, missing), results from steps 0 and 9, a list of UI checks not done in a browser, and the PR title and description. Do not push.