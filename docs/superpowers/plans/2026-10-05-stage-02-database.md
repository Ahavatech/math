# Stage 02: Database Implementation Plan

> **For agentic workers:** This plan is executed inline in the current session per the user's Stage 01 precedent ("write a short plan, then execute it"). TDD is used for the seed script and for relational-constraint behavior (uniqueness, cascade, restrict); the schema itself is config, not logic, and is written directly against the spec.

**Goal:** A Prisma schema covering every model in docs/prompts/02-database.md's MODELS section, a first migration, an idempotent seed, Vitest tests against a real Postgres database, and docs/DATA-MODEL.md. No UI, no auth logic, no Cloudinary/Resend code.

**Architecture:** One `prisma/schema.prisma` file, organized into commented sections matching the spec's module grouping (Users and access / Site content / Academics / People / News and events / Alumni / Journal). The first migration is generated offline with `prisma migrate diff --from-empty --to-schema-datamodel` (works without a reachable database, since Prisma 7's datasource block carries no `url` and the diff engine only needs the target provider dialect) rather than `migrate dev`, because **neither Docker nor a local PostgreSQL server exists on this machine** (confirmed: `docker` not found, no `psql`/Postgres service). Per the user's explicit choice, schema/migration/seed/tests are written now; anything requiring a live database (`migrate dev`/`deploy`, `db seed`, DB-backed tests) is written correctly but documented as unexecuted in AUDIT.md rather than skipped silently.

**Tech Stack:** Prisma 7.10.0 (`@prisma/adapter-pg`, `pg`), Vitest, zod (env), ts-node-free seed via `tsx`/direct `node --experimental-strip-types` or a `.ts` seed run through `prisma db seed` (needs a runner — add one, see Task 6).

**Spec:** [docs/prompts/02-database.md](../../prompts/02-database.md) (full model field lists — this plan does not retype them), [docs/SCOPE.md](../../SCOPE.md), [CLAUDE.md](../../../CLAUDE.md), [docs/DECISIONS.md](../../DECISIONS.md)

## Global Constraints

- PostgreSQL only; cuid ids; `createdAt`/`updatedAt` on every mutable model.
- No plaintext token columns anywhere — `UserToken.tokenHash`, `AlumniLink.tokenHash` only, both unique.
- Images via nullable `MediaAsset` relation, never a raw URL string on content models.
- Manuscript files via `storageKey` only, never a URL.
- `ContentStatus` (DRAFT, PUBLISHED, ARCHIVED) for anything public; archive instead of delete.
- No Auth.js Account/Session/VerificationToken tables (Credentials + JWT sessions — decision recorded in docs/DECISIONS.md).
- Seed is idempotent (safe to run twice); sample records prefixed `[SAMPLE]`; real content (research areas, programmes, nav) has no prefix and is not invented beyond what docs/SCOPE.md states.
- Do not silently change a modelling choice from the spec; deviations go in AUDIT.md and are told to the user.

## Review Focus

- **Running the seed twice** must not throw a unique-constraint error or create duplicate rows — every seed write needs a stable natural key to upsert on (slug, email, key, volume+number, etc.), not just `create`.
- **A user holding two roles, or the same role twice** — `UserRole` unique-pair constraint must reject the duplicate but allow the first; a test exercises both.
- **Deleting a `LecturerProfile` that has `Publication`s or `ReviewAssignment`s** must behave per the Cascade/SetNull/Restrict rule for that relation, not Prisma's default — every foreign key in the schema needs an explicit `onDelete`, and at least the accountability-sensitive ones (AuditLog actor, EditorialDecision editor) must provably `Restrict` rather than silently cascade-deleting history.
- **A manuscript file or token row with no hash/storageKey column at all** — a test asserts the generated SQL/Prisma DMMF has no plaintext `token` column and no `url` column on `ManuscriptFile`, catching a future accidental regression, not just today's schema.
- **Querying content that should never leak privately-held fields** (`AlumniEntry.email`, `AlumniReferenceRecord`, manuscript/review data) — docs/DATA-MODEL.md's public-safe list is the only guard here since there's no query layer yet; flagged so Stage 03+ services don't select these fields into public responses.

---

## Task 1: Decisions and prompt record

**Files:**
- Modify: `docs/DECISIONS.md` (append)
- Create: `docs/prompts/02-database.md` (already saved verbatim in a prior turn — verify, don't re-save differently)

- [ ] Confirm `docs/prompts/02-database.md` matches the prompt verbatim (already committed on `main`)
- [ ] Append to `docs/DECISIONS.md`: multiple roles per user via `UserRole`; Credentials provider with JWT sessions (no Auth.js Account/Session/VerificationToken tables); images via nullable `MediaAsset` relation, never raw URL columns; `ARCHIVED` status instead of hard deletes for public content; first migration generated offline via `prisma migrate diff` because no local Postgres/Docker exists on this machine, to be applied for real before Stage 03 starts
- [ ] Commit: `docs: record stage 02 decisions`

## Task 2: Schema — users/access, site content

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: enums `UserRoleName` (SUPER_ADMIN, HOD, ADMIN, LECTURER, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR, REVIEWER, AUTHOR), `UserTokenType` (INVITE, PASSWORD_RESET), `NavLocation` (HEADER, FOOTER), `ContentStatus` (DRAFT, PUBLISHED, ARCHIVED), `ContactMessageType`, `ContactMessageStatus`; models `User`, `UserRole`, `UserToken`, `SiteSetting`, `NavItem`, `Page`, `MediaAsset`, `ContentRevision`, `AuditLog`, `ContactMessage`, each exactly as field-specified in docs/prompts/02-database.md's "Users and access" and "Site content" sections.

- [ ] Write the `generator`/`datasource` block (unchanged from Stage 01) followed by this task's enums and models, with cuid `id`, `createdAt`/`updatedAt`, unique constraints and indexes per the spec (`UserRole` unique on `(userId, role)`; `UserToken.tokenHash` unique; `AuditLog` indexed on `(entityType, entityId)` and `createdAt`)
- [ ] `onDelete: Cascade` for `UserRole`/`UserToken` on their `User`; `onDelete: Restrict` for `AuditLog.actorId` (nullable but restrict on delete when set); `onDelete: SetNull` for `updatedById`/`uploadedById`/`createdById` optional author links
- [ ] Run `npx prisma validate` — expect success
- [ ] Commit: `feat(schema): add user access and site content models`

## Task 3: Schema — academics, people

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: enums `ProgrammeLevel` (BSC, MSC, PHD), `Semester` (FIRST, SECOND), `LecturerRank`; models `Programme`, `Specialisation`, `ResearchArea`, `Course`, `CoursePrerequisite`, `CourseLecturer`, `HandbookPage`, `Download`, `AcademicCalendarEntry`, `LecturerProfile`, `Publication`, `NonTeachingStaff`, plus the implicit `LecturerProfile`-`ResearchArea` many-to-many, per the spec's "Academics" and "People" sections.

- [ ] Add this task's enums and models; `Course.code` unique; implement `CoursePrerequisite` as an implicit self many-to-many named via `@relation("CoursePrerequisite")` (Prisma names the underlying join table from the relation name, matching the spec's named table with no extra join model needed) and `CourseLecturer` the same way via `@relation("CourseLecturer")` against `LecturerProfile`
- [ ] `LecturerProfile.userId` and `.slug` both unique; `onDelete: Cascade` for `LecturerProfile -> User`; `onDelete: Cascade` for `Publication -> LecturerProfile`
- [ ] Run `npx prisma validate` — expect success
- [ ] Commit: `feat(schema): add academics and people models`

## Task 4: Schema — news/events, alumni, journal

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: enums `NewsCategory`, `EventType`, `AlumniLevel`, `AlumniStatus`, `ManuscriptStatus`, `ReviewAssignmentStatus`, `ReviewRecommendation`, `EditorialDecisionType`, `ManuscriptFileKind`; models `NewsPost`, `EventSeries`, `Event`, `EventGalleryImage`, `AlumniLink`, `AlumniEntry`, `AlumniReferenceRecord`, `JournalIssue`, `Article`, `ArticleAuthor`, `EditorialBoardMember`, `Manuscript`, `ManuscriptAuthor`, `ManuscriptRound`, `ManuscriptFile`, `ReviewAssignment`, `Review`, `EditorialDecision`, per the spec's "News and events", "Alumni" and "Journal" sections.

- [ ] Add this task's enums and models; `AlumniLink.tokenHash` unique; `AlumniEntry.dedupeKey` indexed, NOT unique; `JournalIssue` unique on `(volume, number)`; `ManuscriptRound` unique on `(manuscriptId, number)`; `ReviewAssignment` unique on `(manuscriptId, roundId, reviewerId)`; `Review.assignmentId` unique (one review per assignment); `Article.manuscriptId` unique and nullable
- [ ] `onDelete: Cascade` for rows owned by their parent (`EventGalleryImage -> Event`, `ManuscriptAuthor/ManuscriptFile/ManuscriptRound/ReviewAssignment -> Manuscript`, `ArticleAuthor -> Article`); `onDelete: SetNull` for optional author/editor links (`NewsPost.authorId`, `Manuscript.handlingEditorId`, `ArticleAuthor.userId`); `onDelete: Restrict` for `EditorialDecision.editorId` and `Review`'s link back through `assignmentId` where deleting the actor would lose accountability
- [ ] Run `npx prisma validate` — expect success
- [ ] Commit: `feat(schema): add news/events, alumni and journal models`

## Task 5: First migration (offline)

**Files:**
- Create: `prisma/migrations/<timestamp>_init/migration.sql`, `prisma/migrations/migration_lock.toml`

- [ ] Run `npx prisma generate` — expect success (no DB connection needed)
- [ ] Run `npx prisma migrate diff --from-empty --to-schema-datamodel=prisma/schema.prisma --script > prisma/migrations/<timestamp>_init/migration.sql` (timestamp in Prisma's `YYYYMMDDHHMMSS` format), and write `migration_lock.toml` with `provider = "postgresql"`
- [ ] Record in AUDIT.md that this migration has not been applied to a real database on this machine (no Postgres/Docker available) and must be applied with `npx prisma migrate deploy` (or `migrate dev` in development) before Stage 03 work begins
- [ ] Commit: `feat(db): add initial migration`

## Task 6: Seed script (TDD)

**Files:**
- Create: `prisma/seed.ts`, `tests/unit/database/seed.test.ts`
- Modify: `package.json` (`prisma.seed` config, add `tsx` devDependency), `.env.example`, `src/lib/env.ts` (`SEED_ADMIN_EMAIL`)

**Interfaces:**
- Produces: `export async function seed(db: PrismaClient): Promise<void>` from `prisma/seed.ts`, callable directly by tests with a scoped client; a `main()` guard runs it against `db` from `src/lib/db.ts` when executed via `prisma db seed`.

- [ ] Write `tests/unit/database/seed.test.ts` with a `beforeAll` that tries to connect using `TEST_DATABASE_URL`; if the connection throws, call `describe.skip` for the suite with a logged reason ("no reachable TEST_DATABASE_URL") so `npm run test` still exits 0 without a database
- [ ] In that suite, write (initially failing) tests: `seed()` run twice produces the same row counts for `ResearchArea`, `Programme`, `NavItem`, `SiteSetting` and exactly one `[SAMPLE]`-free `SUPER_ADMIN` user with `email` from `SEED_ADMIN_EMAIL` and `passwordHash: null`
- [ ] Run tests — expect FAIL (seed.ts does not exist) or SKIP (no DB)
- [ ] Add `tsx` as a devDependency; set `"prisma": { "seed": "tsx prisma/seed.ts" }` in package.json per Prisma's seed convention
- [ ] Implement `prisma/seed.ts`: upsert the nine research areas and three programmes from docs/SCOPE.md's "What the site has today" table (titles only — summary/body left as short factual placeholders since SCOPE.md gives no prose, not invented beyond what it states), the header/footer nav items from SCOPE.md's sitemap, default `SiteSetting` rows with `[SAMPLE]`-prefixed placeholder values, and one `SUPER_ADMIN` `User` + `UserRole` from `env.SEED_ADMIN_EMAIL` with no `passwordHash`
- [ ] Add `TEST_DATABASE_URL` to `.env.example` (optional, documented as the Vitest DB) and as an optional key in `src/lib/env.ts`; add `SEED_ADMIN_EMAIL` as optional-with-note (required for `db:seed` to run meaningfully)
- [ ] Run tests again — expect PASS if a database is reachable, SKIP otherwise (document which happened)
- [ ] Commit: `feat(db): add idempotent seed script`

## Task 7: Relational-constraint tests (TDD)

**Files:**
- Create: `tests/unit/database/constraints.test.ts`

**Interfaces:**
- Consumes: the same reachability guard pattern as Task 6's suite.

- [ ] Write tests (skipped gracefully with no DB, per Task 6's pattern) covering: `UserRole` unique-pair rejects a duplicate `(userId, role)` insert but allows a second distinct role for the same user; a duplicate `LecturerProfile.slug` or `Programme.slug` insert is rejected; a duplicate `ReviewAssignment` `(manuscriptId, roundId, reviewerId)` insert is rejected; a second `Review` on the same `assignmentId` is rejected; deleting a `User` cascades to their `UserRole` and `UserToken` rows; deleting a `LecturerProfile` does not delete `Publication` history without cascading intentionally (confirm the spec's chosen behavior) vs. deleting an `EditorialDecision.editor`'s `User` is restricted while they still have decisions on record
- [ ] Run tests — expect SKIP (no DB) or PASS
- [ ] Commit: `test(db): add relational constraint tests`

## Task 8: Static schema-shape tests (no DB required)

**Files:**
- Create: `tests/unit/database/schema-shape.test.ts`

**Interfaces:**
- Consumes: `Prisma.dmmf.datamodel` from `@prisma/client`.

- [ ] Write a test, runnable with no database, asserting via the generated DMMF that no model has a field named `token`, `password`, or `plainToken` (only `tokenHash`/`passwordHash` exist), and that `ManuscriptFile` has no field whose name contains `url` (only `storageKey`)
- [ ] Run — expect PASS unconditionally (this is the one DB-independent proof the "no plaintext token" and "storageKey not URL" rules hold)
- [ ] Commit: `test(db): assert no plaintext token or manuscript url columns`

## Task 9: Data model docs

**Files:**
- Create: `docs/DATA-MODEL.md`

- [ ] Write a Mermaid `erDiagram` per module (seven diagrams: Users/Access, Site Content, Academics, People, News/Events, Alumni, Journal) showing each model's key fields and relations
- [ ] Write a short paragraph per model (purpose, one line)
- [ ] Write the "public-safe fields" list: explicitly name which models/fields may ever be selected into a public response (e.g. `LecturerProfile` minus `publicEmail`? — confirm per spec: `publicEmail` is explicitly meant to be public per SCOPE.md's portfolio fields; call out the ones that are NOT: `AlumniEntry.email`, all of `AlumniReferenceRecord`, all `Manuscript*`/`Review*`/`EditorialDecision` data, `User.passwordHash`, `UserToken.tokenHash`, `AlumniLink.tokenHash`)
- [ ] Commit: `docs: add data model reference`

## Task 10: Verify and report

- [ ] `npx prisma validate` — expect PASS
- [ ] `npx prisma generate` — expect PASS
- [ ] `npm run lint` — expect PASS
- [ ] `npm run typecheck` — expect PASS
- [ ] `npm run test` — expect PASS (DB-dependent suites skipped with a logged reason, schema-shape suite passing unconditionally)
- [ ] `DATABASE_URL=<placeholder> npm run build` — expect PASS
- [ ] Append Entry 002 to AUDIT.md: models created (count), commands run with results, the no-local-Postgres deviation and its consequence (migration/seed/DB tests unexecuted), any other deviations
- [ ] Tick Stage 02 in docs/ROADMAP.md
- [ ] Final commit: `chore: verify stage 02 and update audit log`
