# Stage 12d: Alumni form fix (match the intended design)

Branch: `stage/12d-alumni-form`, from an updated `main`. Never push or merge.
Follow the Reporting rule in CLAUDE.md (9-part summary first, PR text last). Commit after each numbered step. Keep context lean.
Never write "pre-existing", "unrelated" or "flaky" without reproducing on main in a worktree and pasting the result. Mocks are not proof: leak and visibility proofs use the real test database and a running app.

## 0. Start
1. `git checkout main && git pull`, clean tree, `git checkout -b stage/12d-alumni-form`, `npx prisma generate`.
2. Read CLAUDE.md, docs/SCOPE.md, docs/ROADMAP.md, docs/STATE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, last 3 AUDIT.md entries, and the Stage 09 alumni code (form, schema, spam module src/server/services/alumni-spam.ts, photo lifecycle, admin review screens, public list).
3. GAP REPORT FIRST (max 25 lines): compare what exists with the intended design in section 1 and list exactly what differs. Then continue.
4. Docs-only first commit: add a "Pending from Stage 12b/12c" section to docs/ROADMAP.md (under Stage 13b/14) with: tests for article snapshot independence, publish atomicity and final PDF sha256 (12c 5b/5c/5d); per-page First Load JS using a webpack build (`next build --webpack`) re-baselined against about 159 kB shared, and an explanation of the 12b reading of 197.9 kB; scripts blocked by the `server-only` guard under tsx (journal-review-reminders, journal-publish-scheduled): make them runnable for cron before Stage 14a; dev-fixture create and `--remove` for the published-article and review scenarios; the 22 lint warnings against CI max-warnings; sendLecturerInvite and forgot-password timing under the full suite; investigate "stale RSC payload on first request" after publish (check revalidatePath/revalidateTag on publish, correct, retract); real PDF download check with a real uploaded file; self-host Google Fonts (next/font/local) before deployment; manual browser checks for the journal wizard, reviewer pages, publishing panel and acknowledgement toggle; HOD/ADMIN 403 over real sessions.

## 1. Intended design (record in docs/DECISIONS.md)
- Every alumnus fills the form themselves. No seeded list.
- Programme(s) done in the department: BSc, MSc, PhD, multiple selection allowed. For EACH programme selected: entry year and graduation year (graduation year may be "still studying" only if the department wants it; default not allowed).
- Where they are now or what they are doing now: current activity (employer or institution), role or field, city, country, plus an optional one-line free text. Optional photo (keep the existing pending-photo lifecycle).
- A consent checkbox: "I agree that my name, programme(s), set and current activity may be shown publicly once approved." Required. Without it the form cannot be submitted.
- On submit the entry is PENDING. Admin verifies and approves or rejects; only APPROVED entries appear in the public alumni list.
- After submitting, show a confirmation: "Thank you. Your details will be reviewed and displayed once approved."
- On that same confirmation, show approved alumni from the set before theirs, their own set, and the set after ("People you might know"). "Set" = graduation year of a programme. For someone with several programmes, show the groups for each programme's graduation year. Match on the same programme level first; if a group has fewer than 3 people, fill from any programme level. Max 12 per group, deterministic order (by name). Show name, programme, set and current activity only for approved alumni whose consent covers public display. Never show pending, rejected, hidden or erased entries, and never contact details.
- The confirmation page is reached only through a short-lived signed token (HMAC, expires in 1 hour, single browser, not guessable). Reloading after expiry shows the plain thank-you without the list. Duplicate submissions (same normalized email) get the same thank-you, reveal nothing, and are flagged for admin.
- Keep the existing spam protections (honeypot, HMAC minimum fill time, rate limits). No CAPTCHA.

## 2. Schema (additive migration; migrate existing dev rows sensibly)
`AlumniProgramme` (alumnusId, level BSC/MSC/PHD, entryYear, graduationYear; unique per alumnus and level), current activity fields (organisation, roleOrField, city, country, note), consentPublicDisplay + consentAt + consent text version. Keep status PENDING/APPROVED/REJECTED, reviewer, reviewedAt, reject reason (internal), photo fields. Add indexes for graduationYear lookups. Migrate any existing Stage 09 fields into the new structure without data loss on dev; describe the mapping in docs/DATA-MODEL.md. Do not edit applied migrations.

## 3. Services, pages, admin
- Submission service: validate (years sensible and ordered, entry <= graduation, not in the future beyond a small tolerance, at least one programme), normalize, dedupe, create PENDING, send "received" email (no list, no other alumni), return the signed token.
- `getPeopleYouMightKnow(alumnusId or token)`: the matching rules above, public-safe select, APPROVED only.
- Admin review: list with filters (status, programme, graduation year), detail shows all programmes and years, approve/reject/edit (edits audited with ContentRevision), reject reason, bulk approve not allowed. Approval emails the alumnus; rejection email is neutral. Photo moves to public only on approval and is deleted on rejection or erasure (existing lifecycle).
- Public: `/alumni` list grouped by set (graduation year), filter by programme, search deferred to Stage 13a; each card shows only consented fields. Include a "remove my entry" request path that reaches admin (reuse existing erasure flow).
- Permissions: alumni.review as before. HOD read-only; ADMIN as currently defined.

## 4. Tests (real test DB, unique per-run data)
Validation (multi-programme, years); consent required; duplicate email; token expiry and tampering; suggestions include only APPROVED and consented entries, correct before/own/after sets, multi-programme, capped at 12, empty-state wording; pending, rejected, erased and hidden entries never appear in the public list, suggestions, confirmation page, any API, sitemap or RSS; photo lifecycle unchanged; spam module still blocks honeypot, too-fast and rate-limited submissions; permission matrix; emails contain no other alumni data; dev-fixture create and `--remove` leave zero rows.

## 5. Verify with a running app (paste real output)
Start the production build and show: a full submission through the real form route returns the confirmation with suggestions; the same page after token expiry shows no list; a PENDING entry is absent from `/alumni`; after admin approval it appears and the suggestions for another new submitter include it; a rejected entry never appears; direct requests for pending photo URLs return 404/401. Report First Load JS for `/alumni` and the form page from a webpack build against main.

## 6. Docs and finish
Update docs/ALUMNI.md (or the existing alumni doc), DATA-MODEL.md, STATE.md, ROADMAP tick. Full suite twice, typecheck, lint, build. AUDIT.md entry (never edit old ones). Then the 9-part summary with real counts and commit hashes, a coverage table for sections 1 to 5 (built and tested with test name, built but untested, missing), UI checks not done in a browser, then the PR text. Do not push.
