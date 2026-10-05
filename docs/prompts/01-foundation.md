# Prompt 01: Project foundation

Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/ROADMAP.md and AUDIT.md first. This is Stage 01 of the roadmap. Do not build any features. Do not reopen decisions in DECISIONS.md.

Process: use the Superpowers writing-plans skill to write a short plan, then execute it. Skip brainstorming, the design is already decided. Use verification-before-completion before you report back. Work on a branch named stage/01-foundation.

## 1. Scaffold
- Create the Next.js app in this folder: TypeScript, App Router, `src/` directory, Tailwind CSS, ESLint, import alias `@/*`. If create-next-app complains that the folder is not empty, scaffold in a temporary folder and move the files in, keeping the existing CLAUDE.md, AUDIT.md, docs/, .github/ and .claude/ untouched.
- Set `output: "standalone"` in the Next.js config.
- Pin the current Node LTS in `.nvmrc` and `engines`.
- Initialise shadcn/ui with its default setup. Do not add components yet.

## 2. Tooling
- Install: prisma, @prisma/client, zod, server-only, prettier, prettier-plugin-tailwindcss, vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/jest-dom.
- Do not install Auth.js, Cloudinary, Resend or React Email yet. Each is added in the stage that uses it.
- Enable TypeScript strict mode.
- Add npm scripts: dev, build, start, lint, typecheck, test, format, db:migrate, db:seed, db:studio.
- Configure Vitest with one passing sample test for a tiny utility so the test pipeline is proven.

## 3. Folder structure
Create the folder structure exactly as shown in CLAUDE.md. Put a `.gitkeep` in empty folders. Create only these real files: a bare homepage (just the department name, no styling work), a root layout, and `src/app/api/health/route.ts` returning `{ "status": "ok" }`.

## 4. Environment
- Create `src/lib/env.ts` that validates environment variables with zod. Required now: DATABASE_URL. Optional for now, required by the stage that uses them: AUTH_SECRET, AUTH_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, RESEND_API_KEY, EMAIL_FROM, PRIVATE_STORAGE_DIR, NEXT_PUBLIC_SITE_URL.
- Create `.env.example` listing all of them with comments. Never commit a real `.env`.
- Update `.gitignore` for node_modules, .next, .env*, except `.env.example`, and a local `.private-storage/` folder.

## 5. Database setup (no models yet)
- Run the current recommended Prisma setup for PostgreSQL. Create `prisma/schema.prisma` with the datasource and generator only. Models come in Stage 02.
- Add `docker-compose.yml` with a local PostgreSQL for development only. Document the DATABASE_URL to use with it.
- Create `src/lib/db.ts` with a safe singleton Prisma client.

## 6. CI
- `.github/workflows/security.yml` already exists. Do not change it.
- Create `.github/workflows/ci.yml` that runs on pull requests and pushes to main: install, lint, typecheck, test, build.

## 7. Docs
- Create a short README.md: what the project is, requirements, how to run locally (install, start the local database, copy .env.example, migrate, dev), the scripts, and a pointer to CLAUDE.md and docs/.
- Make sure docs/prompts/01-foundation.md (this prompt) is committed.

## 8. Verify and report
- Run lint, typecheck, test and build. All must pass. Start the dev server and confirm `/api/health` returns ok.
- Commit in logical conventional commits on the branch stage/01-foundation. Do not push.
- Append Entry 001 to AUDIT.md using the template, and tick Stage 01 in docs/ROADMAP.md.
- Finish with a short summary: what was created, commands run with results, anything I need to do by hand, and any deviation.
