# CLAUDE.md: OAU Mathematics Department Website

## What we are building
A replacement for maths.oauife.edu.ng, the website of the Department of Mathematics, Obafemi Awolowo University, Ile-Ife. The HOD is Prof. B. S. Ogundare. The new site is a Next.js platform where the HOD and staff manage almost everything from an admin area, so no developer is needed for day-to-day changes.

Where things live:
- docs/SCOPE.md is the source of truth for scope.
- docs/DECISIONS.md lists decisions already made. Do not reopen them without asking.
- docs/ROADMAP.md is the stage checklist.
- AUDIT.md is the history of every prompt. It is updated after every prompt, no exceptions.

## Modules (summary of scope)
A. Public site. B. Lecturer portfolios at /lecturer/[slug]. C. Journal at /journal with submission and peer review. D. Alumni (form links, pending queue, admin approval). E. Events (upcoming and past). F. News. G. Student resources (handbook, courses, downloads). H. Site content management by the HOD and admins.

## Stack (fixed)
- Next.js App Router, TypeScript (strict), Tailwind CSS, shadcn/ui
- PostgreSQL with Prisma ORM
- Auth.js for authentication, with roles and invite links
- Cloudinary for images (compressed before upload) and public PDFs
- Manuscripts and reviewer reports are private. They are stored on the backend server disk (PRIVATE_STORAGE_DIR, outside the web root) and served only through an authorised route.
- Resend for email (invites, alumni links, journal notifications)
- Vitest for unit tests, Playwright for end-to-end tests on critical flows later
- Deployment: university provides frontend hosting only. The backend runs on a KVM 1 VPS. The final topology is still open (see docs/DECISIONS.md), so do not use Vercel-specific features. Keep the app deployable as a single Node server (output: standalone) behind Nginx.

## Working agreement (every prompt)
1. Start by reading this file, docs/ROADMAP.md and the last three entries of AUDIT.md.
2. Process: use the Superpowers skills. Brainstorm only when a decision is genuinely open. Write a short plan before coding. Write tests first for services, validators and permission checks. Use verification-before-completion before saying anything is done. Request a code review at the end of each stage.
3. UI work: follow the Impeccable design context (.impeccable and /impeccable commands). Avoid the generic AI look. No placeholder lorem ipsum in finished screens.
4. Run /security-review at the end of any stage that touches auth, uploads, forms, tokens or data access.
5. Before finishing ANY prompt: append an entry to AUDIT.md using the template in that file, and tick completed items in docs/ROADMAP.md. A prompt is not finished until this is done.
6. One stage equals one branch named stage/NN-short-name, with conventional commits. Never commit to main directly. Never push unless asked.
7. If something in the prompt conflicts with SCOPE.md or DECISIONS.md, stop and ask.

## Rules that must not be broken
Content
- Nothing dynamic is hard-coded. HOD welcome address, hero text and image, stats, contacts, programmes, research areas, menu and footer all come from the database and are editable in /admin.
- Never invent department facts (staff, statistics, dates, names). Use clearly marked sample data in seeds, and keep it easy to remove.
- No em dashes in UI copy, emails or docs.

Security and privacy
- Check authorisation on the server for every mutation and every private read. Hiding a button is not security.
- A lecturer can edit only their own profile (ownership check in the service layer).
- Alumni form tokens are random, stored hashed, expire, and are rate limited. Alumni entries are never public until approved.
- Manuscripts and reviews are private. Reviewer identity is hidden from authors.
- Validate all input on the server with zod. Check file type and size on every upload. Sanitise rich text before rendering.
- Invite and reset tokens are single-use, hashed in the database, and expire.
- Admin actions write to an AuditLog table.
- Alumni consent is stored with a timestamp (Nigeria Data Protection Act).
- No secrets in the repo. Environment variables are validated in src/lib/env.ts.

Code
- Data access only through src/server/services. Components never call Prisma directly.
- Zod schemas live in src/lib/validators and are shared by forms and server actions.
- Prefer server components and server actions. Keep client components small.
- Public pages should be static or incrementally regenerated where possible. Budget for slow mobile connections: compress images, avoid heavy client bundles.
- File names in kebab-case. Components in PascalCase.

## Folder structure
```
oau-maths-site/
  CLAUDE.md
  AUDIT.md
  README.md
  docs/
    SCOPE.md          scope and brief
    DECISIONS.md      decisions and open questions
    ROADMAP.md        stage checklist
    prompts/          every prompt we run, numbered
  prisma/
    schema.prisma
    migrations/
    seed.ts
  public/
  src/
    app/
      (site)/         public pages: about, programmes, research, staff, lecturer/[slug],
                      news, events, alumni, students, journal (+ submit, dashboard), contact
      (auth)/         login, accept-invite/[token], forgot-password
      admin/          dashboard and every content manager
      api/            health, webhooks, upload signing, private file streaming
    components/
      ui/             shadcn primitives
      layout/         header, footer, nav
      sections/       homepage and page sections
      admin/          admin tables, forms, editors
      journal/        journal-specific components
    lib/
      env.ts  db.ts  auth.ts  rbac.ts  cloudinary.ts  email.ts  private-storage.ts
      validators/
    server/
      services/       all business logic and data access
      actions/        server actions
    emails/           React Email templates for Resend
    styles/
  tests/              unit and e2e
  deploy/             nginx config, process manager config, backup scripts
  .github/workflows/  ci.yml, security.yml
```

## Commands
- npm run dev, build, start
- npm run lint, typecheck, test, format
- npm run db:migrate, db:seed, db:studio
- Before saying a stage is done: lint, typecheck, test and build must all pass.
