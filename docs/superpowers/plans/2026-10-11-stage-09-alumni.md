# Stage 09: Alumni Implementation Plan

> **For agentic workers:** This plan is executed natively, in-session, task by task, the same way Stages 02-08 were (see AUDIT.md). No subagent dispatch. A full `/security-review` runs at the end of the branch, per CLAUDE.md.

**Goal:** Alumni receive a link, submit where they are now, an admin verifies every entry before it is public, and visitors can browse an approved, filterable directory with a spotlight.

**Architecture:** Follows docs/PATTERNS.md exactly (service layer owns writes, every save gets a ContentRevision/AuditLog where applicable, public queries are dedicated functions with explicit `select` and try/catch fallback). New pieces specific to this stage: a public-internet-facing form with no session (authorized by a hashed link token instead), a spam-control module, and a Cloudinary authenticated-delivery photo lifecycle (pending -> public on approval, deleted on reject/withdraw/erase).

**Tech Stack:** Next.js server actions + route handlers, Prisma, zod, Cloudinary (type: authenticated for pending photos), Resend (approval email only), existing rate-limit/sanitize/slugify/media libs.

**Spec:** docs/prompts/09-alumni.md

## Global Constraints

- No private cross-check list (AlumniReferenceRecord stays unused, no UI).
- No CAPTCHA; spam defenses live in one module (`src/server/services/alumni-spam.ts`).
- Nothing is public until `status = APPROVED`. Email, consentAt, consentVersion, linkId, reviewedById, rejectionReason, dedupeKey are never in a public payload.
- Alumni photos: Cloudinary `type: authenticated` while PENDING, moved to `type: upload` (public) only on approval; deleted from Cloudinary on reject/withdraw/erase.
- No em dashes in any UI copy, email or doc.
- Every mutation checks `alumni.review` server-side; erase additionally requires HOD or SUPER_ADMIN.
- AuditLog summaries for alumni entities carry ids only, never names/emails.
- Token lookups, signing route, and the public form are all rate-limited; the submit form has no session.

## Review Focus

1. Concurrent submissions against the same link with `maxUses: 1` - the atomic increment must still block the second one (race condition, not just a logic check).
2. A pending photo's Cloudinary URL leaking into the admin review page's HTML/JSON payload (must only ever be reachable through the protected signed/streamed route).
3. Diacritic-only name variation ("Ọlá Adéṣọlá" vs "Ola Adeshola") producing the same `dedupeKey`, and NFKD-normalization not accidentally colliding unrelated names.
4. A submitted `linkedinUrl` using `javascript:`, `data:`, or a non-linkedin.com host, or a non-ASCII homograph host - must be rejected server-side regardless of client validation.
5. The honeypot/min-fill-time check being bypassable by a client that skips JS entirely (the HMAC-signed timestamp must be server-verified, not trusted from a hidden field alone), and the per-email+year 24h duplicate-submission block.

---

## Task 0: Scope doc updates (docs only)

**Files:** Modify `docs/SCOPE.md`, `docs/DECISIONS.md`.

- [ ] Remove the 519-cross-check sentence from SCOPE.md section D and the matching "what we need from the department" bullet.
- [ ] Append two DECISIONS.md entries (#45, #46) with the exact text from the prompt's item 0.
- [ ] Commit: `docs(alumni): drop private cross-check list from scope`.

## Task 1: Schema migration

**Files:** Modify `prisma/schema.prisma`; new migration; modify `docs/DATA-MODEL.md`.

- [ ] Add `WITHDRAWN` to `AlumniStatus`.
- [ ] `AlumniEntry`: add `withdrawnAt DateTime?`.
- [ ] `AlumniLink`: add `lastUsedAt DateTime?`.
- [ ] `MediaAsset`: add `deliveryType String @default("upload")` (values `"upload"` | `"authenticated"`), used to know which Cloudinary resource type/delivery a photo currently has.
- [ ] Run `prisma migrate dev` to generate and apply the migration locally.
- [ ] Update docs/DATA-MODEL.md's Alumni section: new fields, and the explicit "never public" field list (email, consentAt, consentVersion, linkId, reviewedById, rejectionReason, dedupeKey, withdrawnAt).
- [ ] Commit: `feat(alumni): add WITHDRAWN status, lastUsedAt, MediaAsset.deliveryType`.

## Task 2: Alumni consent text and validators

**Files:** Create `src/lib/alumni-consent.ts`, `src/lib/validators/alumni.ts`, `src/lib/validators/__tests__/alumni.test.ts`, `src/lib/countries.ts`, `src/lib/industries.ts`.

**Interfaces:**
- Produces: `ALUMNI_CONSENT_V1: string`; `alumniSubmissionSchema: ZodSchema` with fields `fullName, email, level, graduationYear, organisation?, roleTitle?, city?, country?, industry?, linkedinUrl?, consent: literal(true), honeypot, formRenderedAt, formToken` (the last three consumed by the spam module, not stored); `normalizeAlumniName(input: string): string` (NFC, trim, collapse spaces); `COUNTRIES: string[]`, `INDUSTRIES: string[]`.

- [ ] Write failing tests: name accepts Yoruba diacritics/apostrophes/hyphens/periods, rejects `<`/control chars; graduationYear bounds 1965..currentYear; linkedinUrl must be https and host `linkedin.com`/`www.linkedin.com`, rejects `javascript:`/`data:`/other hosts; consent must be `true`; length caps per field (fullName 120, organisation/roleTitle/city/country/industry 120, email 254).
- [ ] Run tests, confirm fail (module doesn't exist).
- [ ] Implement the schema and `normalizeAlumniName` (Unicode letter/mark classes via `\p{L}\p{M}` regex, NFC normalize, collapse whitespace).
- [ ] Run tests, confirm pass.
- [ ] Commit: `feat(alumni): consent text, submission schema, country/industry lists`.

## Task 3: dedupeKey

**Files:** Create `src/lib/alumni-dedupe.ts`, `src/lib/__tests__/alumni-dedupe.test.ts`.

**Interfaces:** Produces `computeDedupeKey(fullName: string, graduationYear: number): string`.

- [ ] Write failing tests: `"Ọlá Adéṣọlá"` (2010) and `"Ola Adeshola"` (2010) do NOT need to match (dedupe is diacritic-fold only per DECISIONS.md #38's precedent - test the exact behavior: strips diacritics via NFKD, so "Ọlá Adéṣọlá" folds to "ola adesola", which will only match another diacritic-stripped "Ola Adesola", not an anglicized "Adeshola"); titles `Dr`, `Prof`, `Mr`, `Mrs`, `Engr` are stripped as leading/trailing tokens; case and whitespace are folded; different graduation years never match.
- [ ] Run, confirm fail.
- [ ] Implement: NFKD normalize, strip combining marks, strip a small title-word list, lowercase, collapse whitespace, append `|${graduationYear}`.
- [ ] Run, confirm pass.
- [ ] Commit: `feat(alumni): dedupe key for duplicate flagging`.

## Task 4: Alumni link tokens service

**Files:** Create `src/server/services/alumni-links.ts`, `src/server/services/__tests__/alumni-links.test.ts`.

**Interfaces:**
- Consumes: `logAction` (audit.ts), `db` (PrismaClient).
- Produces: `createAlumniLink(db, input: {label, cohortYear?, expiresInDays?, maxUses?}, actorId) -> {link, token}` (token returned once, never stored); `createCohortLinks(db, years: number[], actorId) -> {label, year, url}[]` (cap 60); `regenerateAlumniLinkToken(db, id, actorId) -> {token}`; `setAlumniLinkActive(db, id, isActive, actorId)`; `listAlumniLinksAdmin(db)`; `validateAlumniLinkToken(db, rawToken) -> {ok: true, link} | {ok: false}` (no reason disclosed); `consumeAlumniLinkOnSubmit(db, linkId) -> boolean` (atomic, returns false if already exhausted).

- [ ] Write failing tests: token is sha256-hashed before storage (raw token never equals stored `tokenHash`); `validateAlumniLinkToken` returns `ok:false` uniformly for wrong token, expired, inactive, and exhausted; `regenerateAlumniLinkToken` invalidates the old token (old token no longer validates); `consumeAlumniLinkOnSubmit` under `Promise.all` of 5 concurrent calls on a link with `maxUses: 1` lets exactly one succeed (use a single `updateMany` with a `useCount: { lt: maxUses }` guard in the where clause, checking rowCount).
- [ ] Run, confirm fail.
- [ ] Implement using `crypto.randomBytes(32).toString("base64url")` for the token and `crypto.createHash("sha256")` for the hash; `consumeAlumniLinkOnSubmit` uses `db.alumniLink.updateMany({ where: { id, OR: [{maxUses: null}, {useCount: {lt: db.alumniLink.fields... }}] } ...})` - since Prisma can't compare two columns directly in `updateMany`, implement via a raw SQL atomic update (`UPDATE "AlumniLink" SET "useCount" = "useCount" + 1, "lastUsedAt" = now() WHERE id = $1 AND "isActive" = true AND "expiresAt" > now() AND ("maxUses" IS NULL OR "useCount" < "maxUses") RETURNING id`) via `db.$queryRaw`, returning whether a row came back.
- [ ] Run, confirm pass (including the concurrency test).
- [ ] Commit: `feat(alumni): link token service with atomic maxUses enforcement`.

## Task 5: Alumni spam controls

**Files:** Create `src/server/services/alumni-spam.ts`, `src/server/services/__tests__/alumni-spam.test.ts`.

**Interfaces:** Produces `signFormTimestamp(secret: string): {formToken: string, formRenderedAt: number}`; `verifyMinFillTime(formToken: string, formRenderedAt: number, secret: string, minMs = 4000): boolean` (recomputes HMAC over `formRenderedAt`, rejects mismatch or `Date.now() - formRenderedAt < minMs`); `checkHoneypot(value: string): boolean` (true if empty); `alumniIpRateLimiter`, `alumniLinkRateLimiter` (`InMemoryRateLimiter` instances, 5/hour and 30/hour); `checkRecentDuplicateSubmission(db, email: string, graduationYear: number): Promise<boolean>` (true if a submission with same email+year exists within 24h, any status).

- [ ] Write failing tests: a tampered `formRenderedAt` (shifted to make the elapsed time look longer) fails because the HMAC no longer matches; a genuine token younger than 4s is rejected; a genuine token 4s+ old passes; honeypot non-empty fails; rate limiters trip at their configured thresholds; duplicate-submission check matches within 24h and not after.
- [ ] Run, confirm fail.
- [ ] Implement with Node's `crypto.createHmac("sha256", secret)`.
- [ ] Run, confirm pass.
- [ ] Commit: `feat(alumni): spam controls module`.

## Task 6: AlumniEntry service (state machine, CRUD, erase)

**Files:** Create `src/server/services/alumni-entries.ts`, `src/server/services/__tests__/alumni-entries.test.ts`.

**Interfaces:**
- Consumes: `alumniSubmissionSchema`, `computeDedupeKey`, `consumeAlumniLinkOnSubmit`, `registerMediaAsset`-style photo registration (Task 7), `logAction`.
- Produces: `submitAlumniEntry(db, linkId, input, context) -> AlumniEntry` (status PENDING, computes dedupeKey, consentAt=now, consentVersion="v1"); `listAlumniEntriesAdmin(db, status)`; `findPossibleDuplicates(db, dedupeKey, excludeId?) -> AlumniEntry[]` (status PENDING or APPROVED); `approveAlumniEntry(db, id, actorId, {feature?: boolean}, context)`; `rejectAlumniEntry(db, id, reason, actorId, context)`; `withdrawAlumniEntry(db, id, actorId, context)`; `restoreWithdrawnAlumniEntry(db, id, actorId, context)`; `eraseAlumniEntry(db, id, actorId, context)` (HOD/SUPER_ADMIN enforced by caller); `markDuplicate(db, id, existingId, action: "separate"|"replace"|"reject", actorId, context)`; `bulkApprove(db, ids, actorId, context)` (skips any id with a duplicate flag, returns `{approved: string[], skipped: string[]}`); `updateAlumniEntry(db, id, fields, actorId, context)` (admin inline edit before approving); `setFeatured(db, id, isFeatured, actorId, context)`.

- [ ] Write failing tests for every legal transition (PENDING->APPROVED, PENDING->REJECTED, APPROVED->WITHDRAWN, WITHDRAWN->APPROVED via restore) and illegal ones (REJECTED->APPROVED throws, erasing a non-REJECTED/WITHDRAWN... actually erase is allowed from any status per the prompt's "Approved tab: ... Erase permanently" - confirm erase works from APPROVED too); `bulkApprove` skips ids that have a `findPossibleDuplicates` hit; `markDuplicate` "replace" sets the existing entry to WITHDRAWN and approves the new one in one transaction; AuditLog summary for every alumni action contains no `fullName`/`email` substring (assert this directly against the entry's known test values).
- [ ] Run, confirm fail.
- [ ] Implement each function inside `db.$transaction`, following PATTERNS.md (logAction with `entityId` only in the summary, e.g. `"Approved alumni entry"`).
- [ ] Run, confirm pass.
- [ ] Commit: `feat(alumni): entry state machine, duplicate handling, erase`.

## Task 7: Photo lifecycle (mocked Cloudinary)

**Files:** Create `src/server/services/alumni-photos.ts`, `src/server/services/__tests__/alumni-photos.test.ts` (mocks `@/lib/cloudinary`'s `cloudinary` export via `vi.mock`).

**Interfaces:** Produces `registerPendingAlumniPhoto(db, {publicId, linkId}) -> MediaAsset` (verifies via `cloudinary.api.resource(publicId, {resource_type:"image", type:"authenticated"})` that folder is `oau-maths/alumni/pending`, format is allowed, `type === "authenticated"`; creates `MediaAsset` with `deliveryType: "authenticated"`); `publishAlumniPhoto(db, mediaId) -> void` (calls `cloudinary.uploader.rename` or the Admin API's explicit "update access_mode"/`add_tag` style call that moves delivery type to public - see Task 8's research first; updates `MediaAsset.deliveryType` to `"upload"` and its `url`); `deleteAlumniPhoto(db, mediaId) -> void` (calls `cloudinary.api.delete_resources([publicId], {resource_type:"image", type: asset.deliveryType})`, then deletes the `MediaAsset` row); `getSignedAlumniPhotoUrl(mediaId) -> string | null` (returns a short-lived signed URL via `cloudinary.utils.private_download_url` or `cloudinary.url(publicId, {sign_url: true, type: "authenticated"})` depending on Task 8's findings - implement whichever the research confirms works on this plan's free-tier account; return null if signed delivery isn't available, signaling the caller to stream instead).

- [ ] Write failing tests: registering a photo whose mocked resource reports the wrong folder/format/type throws; `publishAlumniPhoto` updates `deliveryType` to `"upload"`; `deleteAlumniPhoto` calls the mocked `delete_resources` with the asset's current `deliveryType` as `type` and removes the row; a test asserting `getSignedAlumniPhotoUrl`'s returned string never equals the asset's stored `url` verbatim (i.e. it's actually a distinct signed form, or null).
- [ ] Run, confirm fail.
- [ ] Implement against the mock.
- [ ] Run, confirm pass.
- [ ] Commit: `feat(alumni): photo lifecycle service (mocked Cloudinary)`.

## Task 8: Cloudinary research + upload-signing route

**Files:** Modify `docs/MEDIA.md`; create `src/app/api/alumni-upload-signing/route.ts`, `src/app/api/alumni-upload-signing/__tests__/route.test.ts` (or a service-level test if route testing isn't set up - follow the existing `/api/upload-signing` test pattern if one exists, else test the underlying signing function directly).

- [ ] Research (WebFetch, not memory) Cloudinary's current docs for: authenticated delivery type, signed URL generation (`cloudinary.utils.private_download_url` vs `cloudinary.url({sign_url:true})`), whether the account's plan supports short-lived signed URLs, and the current API for changing a resource's delivery/access type after upload (`explicit` with `type` param, or a rename across type). Record exact findings, with dated citation of what was checked, in docs/MEDIA.md's new "Alumni photo lifecycle" section.
- [ ] Write failing test(s) for the signing route logic: requires a valid unexpired active link token (no session) via query/body param, rejects missing/invalid/expired token, enforces per-link (10/hr) and per-IP (5/hr) limits, signs only for `folder: oau-maths/alumni/pending`, `type: authenticated`, `allowed_formats: jpg,png,webp,avif`, with a byte-size cap param.
- [ ] Run, confirm fail.
- [ ] Implement the route (mirrors `/api/upload-signing`'s shape but swaps the session+permission check for `validateAlumniLinkToken` and the two new rate limiters from Task 5).
- [ ] Run, confirm pass.
- [ ] Commit: `feat(alumni): photo upload signing route, authorized by link token`.

## Task 9: Admin review route for pending photos (no raw Cloudinary URL)

**Files:** Create `src/app/api/alumni-photo/[entryId]/route.ts`, test alongside Task 7/9 coverage.

**Interfaces:** Consumes `requirePermission(user, "alumni.review")`, `getSignedAlumniPhotoUrl`. Produces a `GET` handler that: 404s if the entry/photo doesn't exist; 403s without `alumni.review`; if a signed URL is available, redirects to it (302, short expiry); otherwise streams the Cloudinary bytes itself with `Cache-Control: private, no-store`.

- [ ] Write a failing test asserting that `getAdminAlumniEntryAdmin`'s (Task 6) returned object, when serialized the way the review page will render it, contains no string starting with `https://res.cloudinary.com` for a PENDING entry's photo - only an internal `/api/alumni-photo/[id]` path.
- [ ] Run, confirm fail (no such route/field yet).
- [ ] Implement the route and make the admin entry type expose only the internal path, never `photo.url` directly, for a PENDING entry.
- [ ] Run, confirm pass.
- [ ] Commit: `feat(alumni): protected photo route, no raw Cloudinary URL for pending entries`.

## Task 10: Server actions (links, submission, review)

**Files:** Create `src/server/actions/alumni-links.ts`, `src/server/actions/alumni-submit.ts`, `src/server/actions/alumni-review.ts`.

**Interfaces:** Thin wrappers per PATTERNS.md: parse `FormData`, call the Task 4/6/7 services, call `revalidatePath` for `/alumni`, `/alumni/[relevant]`, and `/` on approve/edit/feature/withdraw, per PATTERNS.md item 9.
`submitAlumniEntryAction` additionally runs the Task 5 spam checks before calling the service, and returns a generic success message regardless of duplicate detection (never reveals it to the submitter).

- [ ] No new unit tests here beyond what Tasks 4/6/7 already cover; these are integration glue. Manually exercised in Task 16's walkthrough.
- [ ] Implement.
- [ ] Commit: `feat(alumni): server actions for links, submission and review`.

## Task 11: Admin UI - links

**Files:** `src/app/admin/alumni/links/page.tsx`, `src/app/admin/alumni/links/link-form.tsx`, `src/app/admin/alumni/links/cohort-links-dialog.tsx`, `src/app/admin/layout.tsx` (enable Alumni), `src/app/admin/page.tsx` (pending-count dashboard card).

- [ ] Build the list (label, cohort year, status computed from isActive/expiresAt/maxUses vs useCount, use count, last used, entries received via a count query), the create form (shows the token/URL ONCE, with a copy button and a ready-to-send message string), regenerate/deactivate/reactivate actions, and the "Generate links for years" dialog (year range or CSV list input, cap 60, one-time CSV download of label/year/url via a client-side Blob - never persisted server-side beyond the links themselves).
- [ ] Manually verify in Task 16.
- [ ] Commit: `feat(alumni): admin link management UI`.

## Task 12: Public submission form

**Files:** `src/app/(site)/alumni/submit/[token]/page.tsx`, `src/app/(site)/alumni/submit/[token]/submit-form.tsx` (client, only for the photo upload step - the rest of the form posts via a plain server action so it works with JS disabled), `src/app/(site)/alumni/submit/[token]/success/page.tsx` or an inline post-submit state.

- [ ] Server component validates the token server-side (`validateAlumniLinkToken`) and renders one of: the form, or a generic "This link is no longer valid. Please contact the department." state (no reason disclosure).
- [ ] Form fields per the spec (section 4), with the honeypot field visually hidden (not `display:none` alone - use an off-screen technique plus `tabindex="-1"` and `autocomplete="off"`), a hidden `formToken`/`formRenderedAt` pair from Task 5's `signFormTimestamp` rendered at page-render time, the consent checkbox showing `ALUMNI_CONSENT_V1` with a link to `/privacy`, and country/industry `<select>`s from Task 2's lists.
- [ ] Photo upload is the one client-side piece: compress (reuse `image-compress.ts` with a 1200px/300KB override), sign via `/api/alumni-upload-signing`, upload directly to Cloudinary, keep the returned `publicId` in a hidden field for the main form submit (which still works without JS if no photo is attached).
- [ ] Confirm Next.js server actions reject cross-origin POSTs by default (Origin header check) - read `next.config.ts`/framework docs to confirm, write one test hitting the action with a forged Origin if a sensible test harness exists, else document the confirmation in docs/ALUMNI.md.
- [ ] Mobile-first layout (large touch targets, test at 375px in Task 16).
- [ ] Commit: `feat(alumni): public submission form`.

## Task 13: Admin review UI

**Files:** `src/app/admin/alumni/page.tsx` (tabs: Pending/Approved/Rejected/Withdrawn/Links), `src/app/admin/alumni/[id]/page.tsx` (review/edit screen), `src/app/admin/alumni/entry-row.tsx`, `src/app/admin/alumni/duplicate-dialog.tsx`, `src/app/admin/alumni/bulk-approve-bar.tsx`.

- [ ] Pending list oldest-first with the duplicate flag (calls `findPossibleDuplicates`), bulk-select+approve (skips flagged, per Task 6).
- [ ] Review screen: full details including email, the photo via `/api/alumni-photo/[id]`, inline edit, Approve / Approve+feature / Reject (reason textarea) / Mark as duplicate (three sub-actions).
- [ ] Approved tab: edit, feature/unfeature toggle, withdraw.
- [ ] Erase permanently: gate the button itself on `hasRole(user, ["HOD","SUPER_ADMIN"])` in addition to the server-side check in the action, with a confirmation dialog.
- [ ] Commit: `feat(alumni): admin review UI`.

## Task 14: Public directory, privacy page, homepage, contact removal flow

**Files:** `src/server/services/alumni-public.ts`, `src/server/services/__tests__/alumni-public.test.ts`, `src/app/(site)/alumni/page.tsx`, `src/app/(site)/alumni/alumni-card.tsx`, `src/app/(site)/privacy/page.tsx`, `src/server/services/homepage.ts` (featured alumni wiring - already has `getFeaturedAlumni`; verify/adjust for WITHDRAWN exclusion), `src/app/(site)/contact/page.tsx` (prefill from `?type=ALUMNI&ref=`), `src/lib/alumni-reference.ts` (opaque short id, e.g. first 10 chars of a sha256 of the entry id with a fixed salt, or a short nanoid stored... simplest: derive deterministically from `id` via base62 hash, never the raw cuid).

**Interfaces:** `alumni-public.ts` produces `listApprovedAlumni(db, {page, perPage, year?, level?, country?, industry?, q?}) -> {entries, total}` (explicit select, excludes WITHDRAWN/PENDING/REJECTED by construction since it filters `status: "APPROVED"`); `listFeaturedAlumni(db, limit)`; `countApprovedAlumni(db)`; `alumniPublicReference(id): string`; `findAlumniEntryByReference(db, ref): AlumniEntry | null` (admin-only lookup for the removal procedure).

- [ ] Write failing serialization test: the JSON-serialized result of `listApprovedAlumni` never contains the substrings `email`, `consentAt`, `consentVersion`, `linkId`, `reviewedById`, `rejectionReason`, `dedupeKey` as object keys (iterate `Object.keys` recursively), and a WITHDRAWN/PENDING fixture never appears in results. Also test diacritic search (`q=Olabisi` matches `Adéṣọlá`-style names using the existing `src/lib/text-search.ts` fold, reused not reimplemented).
- [ ] Run, confirm fail.
- [ ] Implement `alumni-public.ts` with an explicit `select` (never `include`), sort by graduationYear desc then fullName, 24/page, filters as `where` clauses (q filtered in application code with `text-search.ts`'s fold, same pattern Stage 07b used for staff search).
- [ ] Run, confirm pass.
- [ ] Build `/alumni` (header count, spotlight of up to 3 featured with deterministic daily rotation if more - reuse the rotation technique from `featured-lecturer.ts`), filters as a plain GET form (no JS), pagination, empty states, "Are you an alumnus?" panel, metadata/breadcrumbs, ISR with on-demand revalidation.
- [ ] Build `/privacy` rendering the admin-editable Page (slug `privacy`), seeded as DRAFT with the "needs legal review" marker (Task 15 seeds it).
- [ ] Wire `getFeaturedAlumni` (already excludes non-APPROVED by its existing `where`) - confirm WITHDRAWN is excluded too (it will be, since WITHDRAWN != APPROVED) and leave as-is or extend its select to match the public-safe field list.
- [ ] Add the `/contact?type=ALUMNI&ref=...` prefill handling on the existing contact page and an alumni card link to it using `alumniPublicReference(entry.id)`.
- [ ] Enable "Alumni" in header/footer nav (already seeded per SCOPE.md's sitemap - confirm or add the NavItem) and the admin sidebar.
- [ ] Commit: `feat(alumni): public directory, privacy page, removal-request link, homepage wiring`.

## Task 15: Email, scripts, docs, seed

**Files:** `src/server/actions/alumni-review.ts` (approval email call), `src/emails/alumni-approved.tsx`, `scripts/alumni-cleanup-orphans.ts`, `scripts/alumni-purge-rejected.ts`, `package.json` (two new npm scripts), `prisma/seed.ts` (privacy Page row), `docs/ALUMNI.md` (new), `docs/CONTENT-EDITING.md`, `docs/AUTH.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`.

- [ ] Approval email: short template via the existing Resend wrapper/console-fallback pattern (DECISIONS.md #22), sent fire-and-forget (catch and log, never throw into the approve transaction).
- [ ] `alumni:cleanup-orphans` (dry run default, `--apply` flag): lists `oau-maths/alumni/pending` Cloudinary resources older than 24h with no matching `MediaAsset.publicId`, deletes only with `--apply`.
- [ ] `alumni:purge-rejected` (dry run default, `--apply`): finds `AlumniEntry` rows `status: REJECTED` with `updatedAt` older than 90 days, deletes their photo (Task 7's `deleteAlumniPhoto`) and the row, with `--apply`.
- [ ] Seed the `privacy` Page (slug `privacy`, DRAFT, the drafted notice text, no invented legal claims).
- [ ] Write docs/ALUMNI.md covering every flow/state/script per the prompt's section 11.
- [ ] Add "Send alumni links", "Review and approve entries", "Handle a removal request" to docs/CONTENT-EDITING.md (no em dashes).
- [ ] Add alumni rows to docs/AUTH.md's permission matrix note (erase = HOD/SUPER_ADMIN only) and the two new DECISIONS.md entries covering the photo-lifecycle API actually used (confirmed in Task 8) and the opaque-reference design.
- [ ] Add the Stage 14 TODO line ("privacy page needs legal/DPO review before launch") to docs/ROADMAP.md.
- [ ] Commit: `feat(alumni): approval email, retention scripts, docs, seed`.

## Task 16: Full test pass, manual verification, security review, audit entry

- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` all pass.
- [ ] Manual walkthrough per the prompt's section 12 (link creation, phone-width form, full submission with photo, pending-queue photo protection, curl-verified 401/403 on the raw pending URL, approval and public appearance, duplicate flag, rejection + Cloudinary delete, expired/exhausted/deactivated link states, honeypot/rate-limit triggers, contact-form removal request -> withdraw -> erase, LECTURER 403).
- [ ] Run `/security-review`, fix every real finding.
- [ ] Report First Load JS for `/alumni` and the submit form.
- [ ] Append AUDIT.md entry, tick Stage 09 in ROADMAP.md.
- [ ] Final report to the user with PR title/description, per CLAUDE.md item 9 (no push/merge).

---

## Self-review notes

- Spec coverage: sections 0-12 each map to a task above (0->Task0, 1->Task1, 2->Task12 intro, 3->Task4/11, 4->Task12, 5->Task8/9, 6->Task13, 7->Task14, 8->Task14, 9->Task15, 10->spread across Tasks 2-9's own test steps, 11->Task15, 12->Task16).
- Photo delivery-type-change mechanism is intentionally left to Task 8's live research rather than assumed, since the prompt explicitly requires checking Cloudinary's current docs before building it.
- Erase permission (HOD/SUPER_ADMIN only) is enforced in both the UI (Task 13) and the server action/service boundary (Task 6/10), not UI-only.
