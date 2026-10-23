# Project state

Fast orientation for a new session. For scope, see SCOPE.md; for stage checklists, see ROADMAP.md.

## Stack

- Next.js 15 App Router, TypeScript strict, Tailwind CSS, shadcn/ui
- PostgreSQL + Prisma ORM
- Auth.js (JWT) with roles
- Cloudinary (public images, PDFs); private manuscript files on server disk
- Resend for email; React Email for templates
- Vitest (unit), Playwright (E2E, critical flows)

## Conventions

- `src/server/services/` for all data access (no Prisma in components)
- `src/lib/validators/` for Zod schemas shared by forms and actions
- Server components + server actions preferred; client components small
- File names kebab-case, component names PascalCase
- One branch per stage: `stage/NN-short-name`

## Permissions (journal)

| Role | journal.editorial | journal.manuscripts.read | Notes |
|---|---|---|---|
| SUPER_ADMIN | yes | yes | every read audit-logged |
| JOURNAL_EDITOR_IN_CHIEF | yes | yes | can assign editors, desk-reject |
| JOURNAL_EDITOR | yes | yes | actions on own assigned manuscripts |
| HOD | no | yes | read-only, no TITLE_PAGE, every read audit-logged |
| ADMIN | no | no | editorial independence |

COI rule: submitter or author-email match removes all access regardless of role.

## Stage 12a (journal submission and screening) -- 2026-10-14

Implemented on branch `stage/12a-journal-submission`.

### What was built

- Prisma schema: `Manuscript`, `ManuscriptAuthor`, `ManuscriptFile`, `ManuscriptEvent`, `ManuscriptRound`, `EditorialDecision`, `JournalCounter` models; `ManuscriptStatus`, `ManuscriptFileKind`, `ManuscriptEventType`, `EditorialDecisionType` enums
- Private manuscript storage (`src/lib/private-storage.ts`): magic-bytes verification, 25 MB per file, 100 MB total, DOCX metadata warning
- Upload/delete API routes: `POST/DELETE /api/journal/manuscripts/[id]/files`
- State machine: `src/server/services/manuscript-workflow.ts`
- Submission service: draft creation, 5-step wizard save, atomic reference numbers, submit action with emails
- Email templates: submission received, new submission to editors, returned to author, decision available, moved to review
- 5-step submission wizard UI: `/journal/submit/*`
- Author dashboard: `/journal/dashboard` and `/journal/dashboard/[id]`
- Editor screening service: `src/server/services/manuscript-screening.ts` -- COI exclusion, HOD read-only, TITLE_PAGE filtering
- Admin manuscripts list and detail: `/admin/journal/manuscripts`
- `journal:purge-drafts` script (60-day INCOMPLETE draft cleanup)
- `docs/JOURNAL-AUTHOR-GUIDE.md`

### Open items (Stage 14+)

- Schedule `journal:purge-drafts` via cron
- Private storage offsite backup
- Disk usage alert
- Retention wording legal review (Nigeria Data Protection Act)

## Stage 12c (article publication) -- 2026-10-23

Implemented on branch `stage/12c-publish-article`.

### What was built

- Prisma migration: `ArticleStatus` enum (DRAFT/SCHEDULED/PUBLISHED/CORRECTED/RETRACTED), publication fields on `Article` (publishedAt, scheduledFor, finalPdfSha256, notices, retractionReason), `ReviewerProfile.acknowledgementOptIn`, `ManuscriptEventType.PUBLISHED`
- `src/server/services/article-publication.ts`: full publication lifecycle (prepare, validate, schedule, publish, unpublish, correct, retract, listAcknowledgedReviewers)
- `src/server/services/manuscript-workflow.ts`: PUBLISH action added
- Email templates: article-being-prepared, article-published
- 26 DB-backed tests in `src/server/services/__tests__/article-publication.test.ts`
- Server actions: prepareArticleAction, publishArticleAction, scheduleArticleAction, correctArticleAction, retractArticleAction
- Admin: PublishingActions component on `/admin/journal/articles/[id]`, PrepareForPublicationForm on `/admin/journal/manuscripts/[id]`
- Public: retraction/correction banners on `/journal/articles/[slug]`, new `/journal/reviewers/[year]` page
- Script: `scripts/journal-publish-scheduled.ts` (`npm run journal:publish-scheduled`)
- Docs: JOURNAL.md updated, JOURNAL-EDITOR-GUIDE.md created

### Publication permission matrix

| Role | Prepare | Publish/Schedule | Correct | Retract |
|---|---|---|---|---|
| SUPER_ADMIN | Yes (no COI) | Yes (no COI) | Yes | Yes |
| EiC | Yes (no COI) | Yes (no COI) | Yes | Yes |
| JOURNAL_EDITOR | No | No | No | No |
| HOD | No | No | No | No |
| ADMIN | No | No | No | No |

COI: user who submitted the manuscript cannot prepare or publish it.

### Open items (Stage 14+)

- Schedule `journal:publish-scheduled` via cron (run every 15 minutes)
- Real HTTP verification of published article page, PDF download, retraction notice
- UI pass for article/issue management pages
- Open peer review (not in scope)
