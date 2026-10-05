# AUDIT.md: Project Audit Log

Every prompt run in Claude Code ends with a new entry at the bottom of this file. Newest entry last. Never edit or delete old entries. If an old entry was wrong, add a correction in a new entry.

## Entry template

```
### Entry NNN | YYYY-MM-DD | Stage NN, Prompt NN: short title
**Asked:** one or two sentences on what the prompt requested.
**Done:** what was actually built or changed.
**Files:** key files created, changed or deleted.
**Decisions:** choices made and why. Link to docs/DECISIONS.md if one was added.
**Tests and checks:** commands run and results (lint, typecheck, test, build, /security-review).
**Security notes:** auth, permissions, uploads, tokens and data exposure touched, and how they were handled.
**Deviations:** anything that differs from SCOPE.md, DECISIONS.md or the prompt, and why. Write "None" if none.
**Open issues:** bugs, risks or questions left behind.
**Next:** the next prompt or stage.
```

## Log

### Entry 000 | 2026-10-05 | Stage 00: Planning
**Asked:** Define scope and technical decisions before any code.
**Done:** Scope and brief approved in draft (docs/SCOPE.md). Stack decided: Next.js, PostgreSQL with Prisma, Auth.js, Cloudinary, Resend. Journal built in-app with submission and peer review. Alumni are form-only with no seeded directory. All dynamic content is editable by the HOD through the admin.
**Files:** CLAUDE.md, AUDIT.md, docs/DECISIONS.md, docs/ROADMAP.md, docs/prompts/01-foundation.md, .github/workflows/security.yml
**Decisions:** See docs/DECISIONS.md.
**Tests and checks:** None, no code yet.
**Security notes:** None yet.
**Deviations:** None.
**Open issues:** Frontend hosting type (does it run Node.js?). Where PostgreSQL will run. Crossref membership for DOIs. Pricing.
**Next:** Stage 01, Prompt 01: project foundation.

### Entry 001 | 2026-10-05 | Stage 01, Prompt 01: project foundation
**Asked:** Scaffold the Next.js app, tooling, folder structure, env validation, Prisma datasource-only setup, and CI, with no features built yet.
**Done:** Ran `/impeccable init` first (no prior PRODUCT.md existed), writing PRODUCT.md with confirmed product context. Then wrote a short plan via the writing-plans skill (docs/superpowers/plans/2026-10-05-stage-01-foundation.md) and executed it inline on branch stage/01-foundation: scaffolded Next.js (TypeScript strict, App Router, src/, Tailwind, ESLint, @/* alias) into a temp dir and moved it in, preserving CLAUDE.md/AUDIT.md/PRODUCT.md/docs/.claude; set `output: "standalone"`; pinned Node 24 in .nvmrc and package.json engines; ran shadcn/ui init with defaults and removed the demo button component it added; installed prisma, @prisma/client, zod, server-only, prettier, prettier-plugin-tailwindcss, vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/jest-dom; added npm scripts (dev, build, start, lint, typecheck, test, format, db:migrate, db:seed, db:studio, postinstall); built the full folder structure from CLAUDE.md with .gitkeep in empty folders; created a bare homepage, root layout, and /api/health; wrote src/lib/env.ts (zod-validated env vars, DATABASE_URL required, the rest optional) and .env.example; set up Prisma (schema.prisma datasource+generator only, prisma.config.ts, docker-compose.yml for local Postgres, src/lib/db.ts as a singleton PrismaClient using the pg driver adapter); moved security.yml into .github/workflows/ and added ci.yml; wrote README.md.
**Files:** package.json, next.config.ts, tsconfig.json, .nvmrc, components.json, vitest.config.ts, vitest.setup.ts, .prettierrc.json, src/lib/env.ts, src/lib/db.ts, src/lib/utils.ts, src/lib/__tests__/utils.test.ts, .env.example, .gitignore, prisma/schema.prisma, prisma.config.ts, docker-compose.yml, src/app/layout.tsx, src/app/page.tsx, src/app/api/health/route.ts, full src/ and tests/ and deploy/ folder tree with .gitkeep placeholders, .github/workflows/ci.yml, .github/workflows/security.yml (moved from repo root), README.md, PRODUCT.md, docs/superpowers/plans/2026-10-05-stage-01-foundation.md, docs/prompts/01-foundation.md (moved from docs/01-foundation.md).
**Decisions:** None new; no entries added to docs/DECISIONS.md. Node LTS pinned to 24 (matches the installed toolchain and current LTS line at this date).
**Tests and checks:** `npm run lint` passed. `npm run typecheck` passed. `npm run test` passed (2 tests, src/lib/__tests__/utils.test.ts). `npm run build` passed. `npm run dev` started and `GET /api/health` returned `{"status":"ok"}`, then the server was stopped.
**Security notes:** src/lib/env.ts throws on a missing/invalid DATABASE_URL at import time rather than allowing a silent undefined. No secrets committed; .env.example has empty values and .gitignore excludes all real .env files while allow-listing .env.example. /.private-storage/ added to .gitignore ahead of Stage 11/12's private manuscript storage.
**Deviations:** (1) `npm install prisma@latest` resolves to a 8.0.0-rc prerelease with a broken optional dependency (effect@^4.0.1 does not exist); pinned prisma and @prisma/client to 7.10.0, the last stable release, instead. (2) Prisma 7 removed `datasource.url` from schema.prisma and requires a driver adapter; added @prisma/adapter-pg and pg, and a prisma.config.ts (not mentioned in the original CLAUDE.md file list) so the CLI can still run migrate/studio against DATABASE_URL, while src/lib/db.ts constructs PrismaClient with the pg adapter directly. This is "the current recommended Prisma setup for PostgreSQL" as the prompt asked for, just reflecting Prisma's current major version. (3) `@vitejs/plugin-react@latest` (6.x) conflicts with shadcn's own Babel 7 preset; pinned to ^4.3.4. (4) Bumped @types/node to ^24 (from the scaffold's default ^20) because vitest 5 requires it. (5) security.yml was at the repo root, not .github/workflows/ as CLAUDE.md's folder structure and Entry 000 described; moved it there unchanged so it and the new ci.yml both function as GitHub Actions workflows. (6) docs/01-foundation.md was at docs/ root, not docs/prompts/ as CLAUDE.md describes and Entry 000 claimed; moved it to docs/prompts/01-foundation.md. (7) docs/SCOPE.md, referenced by CLAUDE.md as the source of truth for scope, does not exist in the repository; proceeded using CLAUDE.md, DECISIONS.md and ROADMAP.md as the available scope record, per this stage's "do not build features" limits this had no material effect, but it should be created or the CLAUDE.md reference corrected.
**Open issues:** docs/SCOPE.md referenced by CLAUDE.md does not exist (see Deviations). All open questions from docs/DECISIONS.md remain (frontend Node.js hosting, Postgres hosting location, Crossref/DOI membership, Statistics content split, pricing).
**Next:** Stage 02: Prisma schema for all modules, migrations, seed, AuditLog.
