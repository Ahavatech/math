Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md (especially the alumni photo delivery decision), docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/MEDIA.md, docs/PATTERNS.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 09. Save this exact prompt as docs/prompts/09-alumni.md.

PRE-CHECK
- Stage 08 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/09-alumni from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for link tokens, validation, dedupe keys, the approval state machine, spam controls, rate limits and the Cloudinary lifecycle (mock Cloudinary). Follow docs/PATTERNS.md and docs/DESIGN.md and reuse existing components. Do not reopen decisions in DECISIONS.md. This is the first stage that accepts writes from anonymous people on the public internet and handles personal data, so be strict. Run /security-review at the end and fix every real finding.

GOAL
Alumni receive a link, fill in where they are now, and the admin verifies each entry before it appears. Visitors can browse a public alumni directory with filters and a spotlight. Everything is built around: nothing is public until approved, email and other private data are never public, and a person can ask to be removed.

0. SCOPE UPDATES (do first, docs only, one commit)
- docs/SCOPE.md section D: delete the sentence about the private 519-name cross-check list, and delete the matching bullet under "What we need from the department".
- docs/DECISIONS.md, add: "No private cross-check list. Every alumnus submits the form and the admin verifies. Duplicates are flagged by dedupeKey only." and "No CAPTCHA. Links are sent privately, so spam is controlled with a honeypot, a minimum fill time, rate limits and a duplicate check. Spam checks live in one module so a challenge can be added later without touching the form."
- The existing AlumniReferenceRecord table stays untouched and unused. Build no UI for it.

1. SCHEMA (one migration, tests included)
- Add WITHDRAWN to the alumni entry status enum.
- AlumniEntry: add withdrawnAt DateTime?. Make sure photoId is nullable and that deleting a photo behaves safely (SetNull).
- AlumniLink: confirm the fields tokenHash (unique), label, cohortYear, expiresAt, maxUses, useCount, isActive, createdById. Add lastUsedAt.
- Consent text is versioned in code as a constant ALUMNI_CONSENT_V1 and stored per entry through consentVersion.
- Record all changes in docs/DATA-MODEL.md, including a list of fields that are NEVER selected in public queries: email, consentAt, consentVersion, linkId, reviewedById, rejectionReason, dedupeKey.

2. PRIVACY NOTICE
- Create a Page record with slug "privacy" and an admin-editable body, plus a footer link and a public route /privacy. Draft a short plain-language notice for the alumni directory covering: what is collected, why, who sees what (email is never public), how long rejected entries are kept (90 days), how to ask for a correction or removal, and the department contact. Mark the Page "Draft. Needs review by OAU legal or the data protection officer." in the admin only, and add a visible TODO in docs/ROADMAP.md under Stage 14. Do not claim legal compliance anywhere in the public text. No em dashes.

3. LINKS (admin, permission alumni.review)
- /admin/alumni/links: create a link with label, optional cohort year, expiry (default 90 days), optional max uses, active flag. The token is 32 random bytes, base64url, shown ONCE at creation together with the full URL (/alumni/submit/[token]), a copy button and a ready-to-send message text. Only the sha256 hash is stored. "Regenerate" replaces the hash and invalidates the old URL. Deactivate and reactivate. Show use count, last used, entries received and status (active, expired, exhausted, inactive).
- "Generate links for years": enter a range or list of graduation years and create one cohort link per year, then offer a single one-time CSV download (label, year, URL). Warn that the file contains live links. Cap at 60 links per action.
- Token validation lives in one service. Increment useCount atomically ONLY on a successful submission, and enforce maxUses in the same atomic update so two parallel submissions cannot exceed the limit (test with concurrent calls).
- Rate limit token lookups per IP.

4. PUBLIC FORM: /alumni/submit/[token]
- Server-render a friendly state for invalid, expired, exhausted and inactive links. Never reveal which specific reason applies beyond a generic message plus "contact the department".
- Fields: full name, email (private, labelled "Never shown publicly"), level (B.Sc. or M.Sc.), graduation year (1965 to the current year, prefilled from the link's cohort year but editable), current organisation, role or title, city, country (select list), industry (controlled list plus "Other"), photo (optional), LinkedIn URL (optional, https, linkedin.com hosts only), consent checkbox (required, shows ALUMNI_CONSENT_V1 text and a link to /privacy).
- Names: accept Unicode letters, spaces, apostrophes, hyphens and periods, including Yoruba diacritics. Normalise to NFC, trim and collapse spaces. Set maximum lengths for every field. Plain text only: reject angle brackets and control characters. Render escaped everywhere.
- Spam controls, all in one module (src/server/services/alumni-spam.ts): a honeypot field; a minimum fill time of 4 seconds enforced with an HMAC-signed timestamp using AUTH_SECRET; a per-IP rate limit (5 submissions per hour) and a per-link rate limit (30 per hour); reject a second submission with the same email and graduation year within 24 hours. No third-party CAPTCHA and no external script on this page.
- Success page: "Thank you. Your details were received and will appear after the department has checked them." Do not reveal duplicate detection to the submitter. Send no email at submission time (unverified addresses must not become a spam vector).
- Validate everything with zod on the server. The page must work without JavaScript except the photo upload. Mobile-first, large touch targets.
- No session is required. Server actions must reject cross-origin requests (confirm the framework default and test it).

5. PHOTO UPLOAD (follow the recorded decision)
- Before building, check Cloudinary's current docs for: the authenticated delivery type, signed delivery, whether short-lived signed URLs are available on our plan, and how to change an asset's delivery type. Do not rely on memory. Record findings in docs/MEDIA.md.
- Client-side compression with the existing pipeline (max 1200 px, WebP or JPEG, under 300 KB, strip location data). The signing route /api/alumni-upload-signing authorises by a valid, unexpired, active link token (no session), uploads as type authenticated into oau-maths/alumni/pending, allows jpg, png, webp and avif only, has a strict size cap, and has per-link (10 per hour) and per-IP (5 per hour) rate limits.
- On submit, register the asset server-side by fetching resource details from Cloudinary using the public_id: verify folder, format, bytes and type authenticated. Never trust client-supplied URLs or dimensions.
- Admin review shows the photo ONLY through a server route that checks alumni.review and then either generates a short-lived signed URL (if available) or streams the image itself with Cache-Control private, no-store. The raw Cloudinary URL must never reach the browser for pending entries. Add a test that the review payload contains no Cloudinary URL for a pending photo.
- On approval: move the asset to public delivery and update the MediaAsset row. On rejection, withdrawal or erasure: delete the asset from Cloudinary and the MediaAsset row.
- Orphan cleanup: npm script alumni:cleanup-orphans that deletes pending-folder assets older than 24 hours that no entry references (dry run by default, --apply to delete). Document that Stage 14 schedules it.
- Retention script alumni:purge-rejected (dry run by default, --apply) that permanently deletes REJECTED entries older than 90 days with their photos.

6. ADMIN: REVIEW (/admin/alumni, permission alumni.review)
- Tabs: Pending (default, oldest first), Approved, Rejected, Withdrawn, Links. The dashboard card shows the pending count and links to the queue.
- Each pending row: name, level, year, organisation, received date, link label, and a "Possible duplicate" flag (same dedupeKey among approved or pending entries).
- dedupeKey: normalise NFKD, strip diacritics and titles (Dr, Prof, Mr, Mrs, Engr and similar), lowercase, collapse spaces, plus graduation year. Test with Yoruba names such as "Ọlá Adéṣọlá" and "Ola Adeshola". The key is for flagging only, never an automatic merge.
- Review screen: all details including the private email, the protected photo view, and inline edit of every field before approving (typo fixes), with an audit entry per change. Actions: Approve, Approve and feature, Reject with a reason (stored, never emailed, never public), and Mark as duplicate with the options "Approve as separate", "Replace existing entry" (existing becomes WITHDRAWN, this one approved) or "Reject as duplicate".
- Bulk approve for selected entries that have no flags. Flagged entries must be reviewed individually.
- Approved tab: edit, feature or unfeature, withdraw (reversible, keeps data, hides publicly), and "Erase permanently" (HOD and SUPER_ADMIN only, confirmation dialog, deletes the row and photo, writes an AuditLog entry that contains NO personal data, only the entity id and the fact of erasure).
- Audit every action with the actor. Never put names, emails or other personal data in AuditLog summaries, use ids.
- Revalidate the alumni pages and the homepage on any approval, edit, feature or withdrawal.
- Removal requests: the contact form with type ALUMNI and a prefilled reference makes the request. Document the admin procedure (verify the sender's email matches the entry's email, then withdraw or erase). Add a "Request correction or removal" link on each public alumni card to /contact?type=ALUMNI&ref=[public entry reference]. The reference is an opaque short id, never the database id.

7. PUBLIC: DIRECTORY /alumni
- Approved entries only. The header shows the live approved count. A "Where are they now" spotlight of featured entries (up to 3, deterministic daily rotation if more) sits at the top.
- Filters via URL query parameters, server rendered, working without JavaScript: graduation year, level, country, industry, plus a name search that is case and diacritic insensitive. 24 per page with pagination. Sort by graduation year descending, then name.
- Card: photo if any (CloudImage with alt "Photo of [name]"), name, level and year, role at organisation, city and country, LinkedIn link with rel="noopener noreferrer". Never the email.
- Empty state for no entries and for no results. An "Are you an alumnus?" panel explaining that the department sends links, with a link to /contact?type=ALUMNI.
- Public queries use explicit select with public-safe fields only. Add a serialisation test asserting that email, consent fields, link ids and dedupe keys never appear in the page payload.
- Metadata, breadcrumbs, static generation with on-demand revalidation. Safe fallback when the database is unreachable.
- Enable "Alumni" in header and footer navigation through data, and in the admin sidebar.

8. HOMEPAGE
- Wire the "Featured alumni" block to approved featured entries (up to 3), hiding itself when none. Confirm the Alumni stat is the live count of approved entries and report the value.

9. EMAIL
- On approval only, send a short, warm "Your entry is now on the department website" email through the existing Resend wrapper, with the public link and the correction or removal instructions. If sending fails, never block the approval and never reveal the failure publicly. In development use the console fallback.

10. TESTS
- Links: hash-only storage, expiry, inactive, exhausted, regenerate invalidates the old one, atomic maxUses under concurrent submissions, per-IP lookup limit.
- Form validation: Yoruba names, year bounds, URL allowlist (reject javascript:, data: and wrong hosts), length caps, angle brackets rejected, consent required.
- Spam: honeypot, minimum fill time with a tampered timestamp, per-IP and per-link limits, same email within 24 hours.
- Signing route: no session needed but a valid link is, rate limits, format allowlist, wrong or expired token rejected.
- Photo lifecycle with mocked Cloudinary: authenticated upload registered, approval moves to public, reject, withdraw and erase delete, orphan and purge scripts in dry run and apply modes, the review payload never includes a raw Cloudinary URL.
- State machine: legal and illegal transitions, replace existing, bulk approve skips flagged entries.
- Dedupe, including diacritic variants.
- Public queries: approved only, no private fields (serialisation test), withdrawn excluded, search with diacritics.
- Permissions: LECTURER-only gets 403 on /admin/alumni; ADMIN, HOD and SUPER_ADMIN can review; only HOD and SUPER_ADMIN can erase. Update the permission matrix test if needed.
- AuditLog summaries contain no personal data (test with a name and email in the entry).
- Bundle-leak guard still passes. Report First Load JS for /alumni and the submit form.

11. DOCS
- docs/ALUMNI.md: flows and states, link handling, spam controls, the Cloudinary photo lifecycle, retention and the scripts, privacy handling, the removal procedure, and a "needs legal review" note.
- Update docs/CONTENT-EDITING.md with "Send alumni links", "Review and approve entries" and "Handle a removal request" in plain language, no em dashes. Add decisions to docs/DECISIONS.md. Update docs/AUTH.md.

12. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: create a link and copy the URL, open the form at phone width, submit a complete entry with a photo, confirm it appears in Pending with the photo shown only through the protected route, confirm the stored Cloudinary URL for that pending photo is NOT fetchable without a signature (test with curl and report the status code), approve it and confirm it appears on /alumni with a public photo, submit a second entry with the same name and year and confirm the duplicate flag, reject one and confirm its photo is deleted from Cloudinary, test an expired link, an exhausted link and a deactivated link, trigger the honeypot and a rate limit, use the contact form to request removal and then withdraw and erase an entry, and confirm a LECTURER-only user gets 403.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 09 in docs/ROADMAP.md.
- Finish with: results of each step, the Cloudinary findings, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
