# Stage 01: Foundation Implementation Plan

> **For agentic workers:** This plan is executed inline in the current session per explicit user instruction (prompt said "write a short plan, then execute it"). Not using subagent-driven-development or executing-plans sub-skills; superpowers:verification-before-completion gates the final report.

**Goal:** Scaffold the Next.js app, tooling, folder structure, env validation, Prisma datasource-only setup, and CI, with nothing built yet beyond a health check and a bare homepage.

**Architecture:** Scaffold with `create-next-app` into a temp directory (the project folder is not empty), move generated files in while preserving CLAUDE.md, AUDIT.md, docs/, .claude/, PRODUCT.md, security.yml. Relocate the existing root `security.yml` into `.github/workflows/security.yml` (location only, content untouched) since CLAUDE.md's folder structure and the new `ci.yml` both expect `.github/workflows/`.

**Tech Stack:** Next.js (App Router, TypeScript strict, src/ dir, Tailwind, ESLint, `@/*` alias), shadcn/ui, Prisma + @prisma/client, zod, server-only, Vitest + Testing Library, Prettier + prettier-plugin-tailwindcss.

**Spec:** [docs/prompts/01-foundation.md](../../prompts/01-foundation.md), [CLAUDE.md](../../../CLAUDE.md), [docs/DECISIONS.md](../../DECISIONS.md)

## Global Constraints

- TypeScript strict mode on.
- `output: "standalone"` in next.config.
- Import alias `@/*`.
- No em dashes in any generated copy/docs.
- Do not install Auth.js, Cloudinary, Resend, or React Email yet.
- Do not reopen decisions in docs/DECISIONS.md.
- Do not modify the content of the existing security workflow, only its location.
- Never commit a real `.env`.

## Review Focus

- Folder-structure drift: later stages expect the exact tree from CLAUDE.md; a missing `.gitkeep` or wrong path breaks Stage 02+ assumptions.
- `env.ts` must fail fast (throw) on a missing `DATABASE_URL` at import time, not silently pass through `undefined`, since every later server action depends on it.
- `security.yml` must end up functional as a GitHub Actions workflow (under `.github/workflows/`) rather than quietly inert at the repo root.
- The sample Vitest test must assert something real (not a trivial `true === true`) so the pipeline is actually proven.
- `db.ts` singleton must not create a new PrismaClient per hot-reload in dev (common Next.js dev-mode pitfall).

---

## Task 1: Branch and scaffold

**Files:**
- Create: entire Next.js scaffold under project root (src/app, package.json, tsconfig.json, next.config.ts, tailwind config, eslint config, components.json, .nvmrc)

- [ ] Create branch `stage/01-foundation` from main
- [ ] Run `create-next-app` in a temp dir with TypeScript, App Router, src/, Tailwind, ESLint, import alias `@/*`, no git
- [ ] Move generated files into project root, excluding anything that would overwrite CLAUDE.md, AUDIT.md, PRODUCT.md, docs/, .claude/, .codex/, .cursor/, security.yml
- [ ] Set `output: "standalone"` in `next.config.ts`
- [ ] Pin current Node LTS in `.nvmrc` and `package.json` `engines.node`
- [ ] Run shadcn/ui `init` with defaults, no components added
- [ ] Commit: `chore: scaffold next.js app`

## Task 2: Tooling and env validation

**Files:**
- Modify: `package.json` (deps, scripts)
- Create: `src/lib/env.ts`, `.env.example`, `vitest.config.ts`, `src/lib/__tests__/env.test.ts` (or similar tiny sample test), `.gitignore` updates
- Modify: `.gitignore`

**Interfaces:**
- Produces: `env` export from `src/lib/env.ts` — a parsed object with `DATABASE_URL: string` required, and optional strings for `AUTH_SECRET, AUTH_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, RESEND_API_KEY, EMAIL_FROM, PRIVATE_STORAGE_DIR, NEXT_PUBLIC_SITE_URL`. Throws on invalid/missing required vars at import time.

- [ ] Install `prisma @prisma/client zod server-only prettier prettier-plugin-tailwindcss vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`
- [ ] Enable `"strict": true` in `tsconfig.json` (create-next-app already sets this; verify)
- [ ] Add npm scripts: `dev, build, start, lint, typecheck, test, format, db:migrate, db:seed, db:studio`
- [ ] Write `src/lib/env.ts` with a zod schema per the Interfaces block above, parsing `process.env` and exporting `env`; throw with a clear message on failure
- [ ] Write a sample Vitest test for a tiny real utility (e.g. a `cn`/className merge helper or a small formatter) asserting actual behavior, not a tautology
- [ ] Configure `vitest.config.ts` with jsdom environment and React plugin
- [ ] Create `.env.example` listing all vars above with one-line comments, `DATABASE_URL` marked required
- [ ] Update `.gitignore`: `node_modules`, `.next`, `.env*` except `.env.example`, `.private-storage/`
- [ ] Run `npm run test` — expect the sample test to pass
- [ ] Commit: `chore: add tooling, env validation, sample test`

## Task 3: Folder structure and placeholder routes

**Files:**
- Create: full folder tree per CLAUDE.md with `.gitkeep` in empty dirs
- Create: `src/app/page.tsx` (bare homepage, department name only), `src/app/layout.tsx` (root layout), `src/app/api/health/route.ts`

**Interfaces:**
- Produces: `GET /api/health` → `{ "status": "ok" }` (used by Task 6 verification)

- [ ] Create the full directory tree from CLAUDE.md's "Folder structure" section under `src/` and top-level (`prisma/migrations`, `public/`, `tests/`, `deploy/`, `src/emails/`, `src/styles/`, etc.), with `.gitkeep` in every dir that has no real file yet
- [ ] Write `src/app/layout.tsx` as a minimal root layout
- [ ] Write `src/app/page.tsx` rendering only the department name, no styling work
- [ ] Write `src/app/api/health/route.ts` returning `NextResponse.json({ status: "ok" })`
- [ ] Commit: `feat: add folder structure and health check route`

## Task 4: Database setup (schema shell only)

**Files:**
- Create: `prisma/schema.prisma` (datasource + generator only), `docker-compose.yml`, `src/lib/db.ts`

**Interfaces:**
- Consumes: `env.DATABASE_URL` from Task 2
- Produces: `db` export from `src/lib/db.ts` — singleton `PrismaClient` instance, reused across hot reloads via `globalThis` in development

- [ ] Run Prisma init for PostgreSQL (`npx prisma init --datasource-provider postgresql`), keep only datasource + generator blocks, no models
- [ ] Write `docker-compose.yml` with a local `postgres` service for dev, documented port and credentials
- [ ] Add the matching local `DATABASE_URL` as a comment in `.env.example`
- [ ] Write `src/lib/db.ts`: singleton pattern caching the client on `globalThis` in non-production to survive Next.js dev hot-reload
- [ ] Commit: `chore: add prisma datasource and db client singleton`

## Task 5: CI and docs

**Files:**
- Move: `security.yml` → `.github/workflows/security.yml` (content unchanged)
- Create: `.github/workflows/ci.yml`, `README.md`

- [ ] Move `security.yml` to `.github/workflows/security.yml` with no content changes
- [ ] Write `.github/workflows/ci.yml`: triggers on `pull_request` and `push` to `main`; steps: checkout, setup-node (version from `.nvmrc`), `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
- [ ] Write `README.md`: what the project is, requirements, local run steps (install, start local db via docker-compose, copy `.env.example` to `.env`, `db:migrate`, `dev`), script list, pointer to CLAUDE.md and docs/
- [ ] Ensure `docs/prompts/01-foundation.md` exists and is tracked (the existing prompt doc is at `docs/01-foundation.md`; confirm location matches CLAUDE.md's `docs/prompts/` convention or note the deviation)
- [ ] Commit: `docs: add README and move security workflow into .github/workflows`

## Task 6: Verify and report

- [ ] Run `npm run lint` — expect pass
- [ ] Run `npm run typecheck` — expect pass
- [ ] Run `npm run test` — expect pass
- [ ] Run `npm run build` — expect pass
- [ ] Start `npm run dev`, request `/api/health`, confirm `{ "status": "ok" }`, stop server
- [ ] Append Entry 001 to `AUDIT.md` using the template
- [ ] Tick Stage 01 in `docs/ROADMAP.md` referencing Entry 001
- [ ] Commit: `chore: verify stage 01 and update audit log`
