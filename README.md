# OAU Department of Mathematics website

A Next.js platform for the website of the Department of Mathematics, Obafemi
Awolowo University, Ile-Ife. The HOD and staff manage content, lecturers,
news, events, alumni and the department journal from an admin area, so no
developer is needed for day-to-day changes.

See [CLAUDE.md](./CLAUDE.md) for the full build brief and rules, and
[docs/](./docs) for scope, decisions and the stage roadmap.

## Requirements

- Node.js (version pinned in [.nvmrc](./.nvmrc))
- Docker, for a local PostgreSQL database (or your own PostgreSQL instance)

## Running locally

```bash
npm install
docker compose up -d
cp .env.example .env
# fill in DATABASE_URL (and any other variables the current stage needs)
npm run db:migrate
npm run dev
```

The app runs at http://localhost:3000. `GET /api/health` returns
`{ "status": "ok" }` once the server is up.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (`output: "standalone"`) |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm run test` | Vitest |
| `npm run format` | Prettier, writes changes |
| `npm run db:migrate` | Prisma migrate (dev) |
| `npm run db:seed` | Prisma seed |
| `npm run db:studio` | Prisma Studio |

## Project docs

- [CLAUDE.md](./CLAUDE.md): working agreement, stack, rules, folder structure
- [PRODUCT.md](./PRODUCT.md): product context (users, purpose, constraints)
- [docs/DECISIONS.md](./docs/DECISIONS.md): settled decisions
- [docs/ROADMAP.md](./docs/ROADMAP.md): stage checklist
- [AUDIT.md](./AUDIT.md): history of every prompt run against this project
