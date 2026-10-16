# Journal Reviewer Guide

This document describes the peer review workflow from a reviewer's perspective, and the technical implementation details relevant to developers.

## Reviewer workflow

1. **Invitation** -- An editor invites a reviewer for a specific manuscript round. The reviewer receives an email containing a one-time token link (the email shows the reference number only, never the title or author names -- double-blind).
2. **Accept or decline** -- The reviewer clicks the link and chooses to accept or decline. Declining requires no account. Accepting requires the reviewer to be signed in (the invitation page redirects to login if needed).
3. **Review** -- After accepting, the reviewer sees the manuscript files (except the TITLE_PAGE) and a review form at `/journal/reviewer/assignments/[id]`. The form supports onBlur autosave.
4. **Submit** -- The reviewer submits their recommendation and comments. Submitted reviews are locked and cannot be edited.
5. **Thank you** -- After the editorial team processes the round, a thank-you email is sent.

## Token security

- Invitation tokens are 32 random bytes in base64url, stored as a sha256 hash in the database.
- A bad token, an expired token, and a consumed token all return the same null result (indistinguishable).
- Tokens expire after `invitationExpiryDays` (default 14 days, settable in journal settings).
- `scripts/journal-review-reminders.ts` expires stale INVITED assignments when run with `--apply`.

## Double-blind enforcement

- The reviewer never sees the title page file (filtered by `kind: { not: "TITLE_PAGE" }` in `reviewer-dashboard.ts`).
- The author never sees reviewer identity: `getReviewsForAuthor` returns `{ label, recommendation, commentsToAuthorHtml }` only.
- Reviewer labels shown to the author ("Reviewer 1", "Reviewer 2", ...) are stable by `createdAt` order.
- Invitation emails contain the reference number only (no title, no author names).

## Conflict of interest

- A reviewer who is the submitter of the manuscript, or whose email matches any `ManuscriptAuthor.email`, cannot be invited (blocked in `inviteReviewer` service with a COI error).
- The same COI check applies to editorial decisions in `editorial-decision.ts`.

## Roles

| Role | Access |
|------|--------|
| REVIEWER | Can accept/decline invitations, access assigned manuscript files (not TITLE_PAGE), submit review |
| JOURNAL_EDITOR | Can invite reviewers, see submitted reviews (with commentsToEditor), record decisions |
| JOURNAL_EDITOR_IN_CHIEF | Same as JOURNAL_EDITOR plus override-minimum-reviews |
| SUPER_ADMIN | Same as EiC |
| HOD | Read-only manuscript access; NO reviews, NO reviewer identities, NO decisions |
| AUTHOR | Author-side view only: reviewer labels + commentsToAuthor after decision |

## Pages

| Path | Purpose |
|------|---------|
| `/journal/reviewer` | Reviewer dashboard: active ACCEPTED and SUBMITTED assignments |
| `/journal/reviewer/invitation/[token]` | Accept/decline landing page |
| `/journal/reviewer/assignments/[id]` | Review form with autosave |

## Admin pages

| Path | Purpose |
|------|---------|
| `/admin/journal/manuscripts/[id]` | Reviewer invitation panel, assignments table, reviews panel, decision form |
| `/admin/journal/reviewers` | List of all REVIEWER-role users |

## Reminder script

```bash
npm run journal:reminders -- --apply
```

Sends reminder emails to reviewers due within 3 days, overdue notices, and expires stale INVITED assignments. Run daily via cron.
