# ALUMNI.md

How the alumni directory works, for anyone maintaining this code later. See docs/prompts/09-alumni.md
for the original spec and AUDIT.md's Stage 09 entry for what was built and found.

## Flow

1. An admin with `alumni.review` creates a link at `/admin/alumni/links` (a one-off link, or a batch
   of per-year cohort links). The token (32 random bytes, base64url) is shown once, together with the
   full `/alumni/submit/[token]` URL and a ready-to-send message. Only its sha256 hash is ever stored.
2. The admin sends the link to an alumnus by whatever means they like (email, WhatsApp, etc.) - this
   app never emails it itself.
3. The alumnus opens `/alumni/submit/[token]`, which needs no account. The form works without
   JavaScript except the optional photo upload. Submitting creates an `AlumniEntry` with status
   `PENDING` and atomically increments the link's `useCount`.
4. The admin reviews pending entries at `/admin/alumni` (oldest first), edits typos if needed, and
   either approves, approves and features, rejects with a reason, or resolves a flagged duplicate.
5. Once `APPROVED`, the entry appears on the public `/alumni` directory and the alumnus receives a
   short email with the public link and how to ask for a correction or removal.
6. An approved entry can later be withdrawn (reversible - keeps the data, hides it publicly) or, by
   the HOD or a super admin only, erased permanently (deletes the row and photo, logged with no
   personal data in the summary).

## States

`PENDING -> APPROVED -> WITHDRAWN -> APPROVED` (restore) is the normal reversible path.
`PENDING -> REJECTED` is terminal in the UI (no restore action), though the row survives for 90 days
before the retention script deletes it - see "Retention and scripts" below.
`eraseAlumniEntry` can run from any status and is always final.

## Links

- Token: 32 random bytes, base64url, shown once. Only `sha256(token)` is stored in `AlumniLink.tokenHash`.
- Expiry defaults to 90 days; an admin can set a shorter or longer value per link.
- `maxUses` is optional. `consumeAlumniLinkOnSubmit` enforces it atomically with a single `UPDATE ...
  WHERE ("maxUses" IS NULL OR "useCount" < "maxUses") RETURNING id` raw query, so two submissions
  racing against a `maxUses: 1` link cannot both succeed - see the concurrency test in
  `src/server/services/__tests__/alumni-links.test.ts`.
- `validateAlumniLinkToken` returns the same generic `{ok: false}` for a wrong token, an expired
  link, an inactive link and an exhausted link - the public form never reveals which reason applies,
  only a generic "this link is no longer valid" message.
- "Regenerate" replaces the stored hash, which invalidates the old URL immediately (the old token can
  no longer be found by its hash).
- "Generate links for years" accepts a range (`2000-2005`) or a list (`2001,2003,2007`), capped at 60
  links per action, and offers a one-time CSV download (label, year, url). The CSV contains live
  links - the admin UI warns about this before download, and the file is never stored server-side.

## Spam controls

All in `src/server/services/alumni-spam.ts`:

- **Honeypot**: a field named `website`, visually hidden off-screen (not `display:none`, which some
  bots skip) and taken out of the tab order. A genuine visitor never sees or fills it; any value in it
  fails the submission.
- **Minimum fill time**: the form is rendered with an HMAC-signed timestamp (`signFormTimestamp`,
  using `AUTH_SECRET`) and requires at least 4 seconds between render and submit. The signature is
  recomputed server-side from the submitted timestamp, so a client cannot fake a longer elapsed time
  by editing the hidden field alone - the HMAC would no longer match.
- **Rate limits**: 5 submissions per hour per IP, 30 per hour per link (separate, tighter limits apply
  to the photo upload-signing route: 5/hour per IP, 10/hour per link).
- **Duplicate-submission check**: a second submission with the same email and graduation year within
  24 hours is checked (`checkRecentDuplicateSubmission`) but never revealed to the submitter - the
  success message is identical either way. The actual review-side duplicate signal is the
  `dedupeKey` flag in the admin queue, a separate mechanism (see below).
- No CAPTCHA (DECISIONS.md #46): links are sent privately rather than posted on an open page, so the
  above four controls were judged sufficient without an external challenge. If spam becomes a real
  problem, a challenge can be added without touching the form, since every check lives in this one
  module.

## Duplicate detection

`src/lib/alumni-dedupe.ts`'s `computeDedupeKey` NFKD-normalises a name (folds diacritics), strips a
short list of common titles (Dr, Prof, Mr, Mrs, Miss, Ms, Engr, Chief, Alhaji, Alhaja), lowercases,
collapses whitespace, and appends the graduation year. This matches an accent-stripped spelling
("Ọlá Adéṣọlá" ~ "Ola Adesola") but not an anglicized respelling that changes letters ("Adeshola" for
"Adéṣọlá") - the same scope limit as the staff directory search (DECISIONS.md #38). It is a flagging
aid only: `findPossibleDuplicates` is checked before approving (bulk approve skips any flagged entry)
and shown as a "Possible duplicate" badge in the review queue, but nothing ever merges automatically.
The review screen's "Mark as duplicate" action offers three resolutions: approve as a separate entry,
replace the existing one (the existing entry becomes `WITHDRAWN`, the new one `APPROVED`), or reject
the new one as a duplicate.

## Photo lifecycle

See docs/MEDIA.md's "Alumni photo lifecycle" section for the Cloudinary research behind this.

1. The submit form uploads a photo (compressed to max 1200px / 300KB client-side) directly to
   Cloudinary as `type: authenticated` into `oau-maths/alumni/pending`, signed by
   `/api/alumni-upload-signing` - authorized by the link token, not a session.
2. On submit, `registerPendingAlumniPhoto` re-verifies the resource from Cloudinary's own API
   (folder, format, actual delivery type) before creating a `MediaAsset` row with
   `deliveryType: "authenticated"`.
3. While the entry is `PENDING`, an admin sees the photo only through `/api/alumni-photo/[entryId]`,
   which checks `alumni.review` then streams the bytes itself (`Cache-Control: private, no-store`) -
   the raw Cloudinary URL never reaches the browser. `getAlumniEntryAdmin`'s returned object never
   includes the raw `photo` relation either, only a computed `photoUrl` that is this internal path
   while pending.
4. On approval, `publishAlumniPhoto` calls Cloudinary's `rename` with `to_type: "upload"` (same
   `public_id`), moving it to public delivery, and updates `MediaAsset.deliveryType` to `"upload"`.
5. On rejection, withdrawal-then-erase, or a direct erase, `deleteAlumniPhoto` deletes the Cloudinary
   asset (using the asset's current `deliveryType` as the `type` parameter - required, since
   Cloudinary scopes lookups by delivery type) and removes the `MediaAsset` row.

No short-lived signed URL is available on this Cloudinary plan (token-based expiring URLs need the
Advanced plan). If the department upgrades later, only `getSignedAlumniPhotoUrl` needs to change.

## Retention and scripts

- `npm run alumni:cleanup-orphans` (dry run by default, `--apply` to delete): finds Cloudinary
  resources under `oau-maths/alumni/pending` older than 24 hours with no matching `MediaAsset` row
  (an upload whose form submission never completed) and deletes them.
- `npm run alumni:purge-rejected` (dry run by default, `--apply` to delete): finds `AlumniEntry` rows
  `status: REJECTED` with `updatedAt` older than 90 days and permanently deletes them and their
  photo, if any (most rejected entries already have no photo, since rejection deletes it immediately -
  see "Photo lifecycle" above; this script is a backstop, not the primary deletion path).
- Stage 14 (hardening and deployment) is expected to schedule both scripts, e.g. a daily cron job on
  the VPS.

## Privacy

- The alumni directory's privacy notice lives at `/privacy`, an admin-editable `Page` (slug
  `privacy`), seeded as `PUBLISHED` (unlike other imported pages, since the submission form links to
  it from the start) but flagged in the `pages.legalReviewFlags` settings key as "Draft. Needs review
  by OAU legal or the data protection officer." - visible only in `/admin/pages`, cleared the moment
  an admin saves the page (the same "saving is the review" pattern as `pages.importFlags`). See
  docs/ROADMAP.md's Stage 14 line for the explicit follow-up.
- Consent text is versioned in code (`ALUMNI_CONSENT_V1` in `src/lib/alumni-consent.ts`) and stored
  per entry via `consentVersion`, so a future wording change creates `ALUMNI_CONSENT_V2` rather than
  silently rewriting what past submitters actually agreed to.
- The public text never claims legal compliance; it only describes what the department actually does.

## Removal requests

A visitor (or an alumnus who was already approved) can ask for a correction or removal through the
`/contact` form, which the "Request correction or removal" link on every public alumni card opens
pre-filled with `?type=ALUMNI&ref=[opaque reference]`. The reference (`alumniPublicReference`,
`src/lib/alumni-reference.ts`) is a short, non-reversible hash of the entry's id, never the database
id itself.

**Admin procedure**: open the contact message, verify the sender's email matches the entry's private
email (visible on the entry's review screen), then withdraw (reversible) or erase (permanent,
HOD/SUPER_ADMIN only) the entry from `/admin/alumni`. There is currently no dedicated admin inbox UI
for `ContactMessage` rows (see AUDIT.md's Stage 09 open issues) - this stage only built the public
intake form the alumni flow depends on. Until an inbox exists, read the `ContactMessage` table
directly (e.g. via `npm run db:studio`) to see a removal request.

## Needs legal review

The privacy notice at `/privacy` is a plain-language draft written for this stage, not a reviewed
legal document. It must be checked by OAU legal or the department's data protection officer before
the alumni form is sent to real alumni. See the flag in `/admin/pages` and docs/ROADMAP.md's Stage 14.
