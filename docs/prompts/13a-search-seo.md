# Stage 13a: Global search, SEO and discoverability (plus alumni carry-over)

Branch: `stage/13a-search-seo`, from an updated `main`. Never push or merge.
Follow the Reporting rule in CLAUDE.md (9-part summary first, PR text last). Commit after each numbered step. Keep context lean.
Never write "pre-existing", "unrelated" or "flaky" without reproducing on main in a worktree (run npm install and prisma generate there first) and pasting the result. Mocks are not proof: visibility proofs use the real test database and a running production build.

## 0. Start
1. `git checkout main && git pull`, clean tree, `git checkout -b stage/13a-search-seo`, `npx prisma generate`, apply migrations to the _test database.
2. Read CLAUDE.md, docs/SCOPE.md, docs/ROADMAP.md, docs/STATE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, last 3 AUDIT.md entries. List every public route and its data source (pages, news, events, lecturers, staff, programmes, research areas, courses, handbook, downloads, calendar, journal issues and articles, alumni). Report in 15 lines what exists for sitemap, robots, metadata, JSON-LD and RSS already.

## 1. Carry-over from 12d (decisions: "set" = graduation year; confirmation list shows name, set and current role)
- Add a "Set" filter (graduation year, with a year range or single year) to the public `/alumni` list. Programme filter stays.
- Check the industry filter: it matches roleOrField exactly against an INDUSTRIES constant. Confirm the form offers that list; if roleOrField is free text, the filter is broken, so fix it (separate industry field or a controlled list) and migrate sensibly. Add a test.
- Tests still owed: alumni permission matrix (alumni.review, HOD read-only, ADMIN as defined), alumni emails contain no other alumni data, dev-fixture create and `--remove` leave zero rows for alumni, and a DB-backed test that pending, rejected, erased and non-consenting alumni never appear in the public list, filters, confirmation page data, sitemap or RSS.
- Audit all test files for hardcoded unique values (course codes, volume numbers, emails, slugs, years) that can collide across parallel workers; fix them with per-run unique values. Report the list.
- Verify the 12d migration on (a) a fresh database built from scratch and (b) a database seeded with old-shape alumni rows first; show `prisma migrate status` clean and `prisma migrate diff` empty. If it fails, fix with a NEW migration.

## 2. Decisions (record in docs/DECISIONS.md; ask if one conflicts with SCOPE)
- Search covers only PUBLIC content that a visitor could already open: pages, news, events (upcoming and past), lecturers (public fields), staff directory (public fields), programmes, research areas, courses, handbook, downloads, calendar entries, published journal articles and issues. NEVER: drafts, archived, scheduled, unpublished, pending or rejected anything, manuscripts, reviews, reviewer data, private files, users, admin content. Alumni are NOT in global search (they stay on the alumni page filters) to protect personal data.
- Each result type uses the same public-safe select as the page it links to. Search must not have its own wider query.
- Postgres full-text search (tsvector with a GIN index via a raw SQL migration, `websearch_to_tsquery`), plus a trigram or prefix match for names and course codes. Parameterized queries only (Prisma.sql). Rich text is stripped to plain text for indexing; TeX markup is stripped or normalized so math does not pollute results.
- Query limits: 2 to 100 characters, rate limited per IP, results paginated, response never reveals counts of hidden items.

## 3. Search build
- Service `site-search.ts` returning grouped, ranked results (type, title, snippet with highlighted match, URL, date). Snippets are generated from plain text, escaped, and never include hidden fields.
- `/search` page (server rendered, filter by type, pagination, empty state, no-results suggestions) marked `noindex`. A search box in the site header that submits to it (minimal markup; the visual redesign comes later). Keep keyboard and screen reader basics: label, role=search, results as a list with headings.
- Indexes added in a NEW migration. Show EXPLAIN for one query to confirm the index is used.
- Tests (real DB, unique per-run data): each type appears when public and disappears when draft, archived, scheduled, unpublished, retracted-not (retracted articles stay visible with notice, per 12c), pending or rejected; alumni never appear; reviewer, review, manuscript and private-file text never appears even when the sentinel strings are inside a published article's manuscript; query injection strings and very long input handled; ranking sanity (title match above body match); rate limit; pagination.

## 4. SEO
- `sitemap.ts`: all public static and dynamic routes, only public items, correct lastModified, split if over 50,000 URLs. Excludes /search, /admin, /api, journal dashboards, reviewer pages, alumni submit and confirm.
- `robots.ts`: allow public, disallow /admin, /api, /journal/dashboard, /journal/reviewer, /journal/submit, /alumni/submit, /alumni/confirm, /search; point to the sitemap. Use SITE_URL from env as the canonical origin; fail the build with a clear message if it is missing in production.
- Metadata: a shared helper for titles (template "Page | Department of Mathematics, OAU"), descriptions, canonical URLs, Open Graph and Twitter cards with a fallback image; every public page type uses it. Admin and authenticated pages are `noindex`. Custom 404 and 500 pages.
- JSON-LD via one helper that escapes `<` safely: CollegeOrUniversity/Organization (department), Person (lecturers, public fields only), Event, NewsArticle, Course, BreadcrumbList; ScholarlyArticle for journal articles already exists (verify it, and the Google Scholar citation tags).
- Feeds: verify RSS for news, events (ICS) and journal articles is valid XML, public items only, with correct absolute URLs and dates; add missing feeds.
- Tests: sitemap and robots output contain no private or hidden URLs (real DB with hidden items present), JSON-LD escaping test with hostile titles, metadata present on every public route (route list test so new routes cannot skip it), feeds validate.

## 5. Verify with a running production build (paste real output)
curl: /sitemap.xml, /robots.txt, /search?q=... (public item found, draft item not found, alumni name not found, sentinel manuscript text not found), the JSON-LD block of one lecturer, one event and one article, RSS and ICS heads, X-Robots-Tag or meta robots on /search and /admin. Report First Load JS for /search and the header (shared) from a webpack build (`next build --webpack`) against main, same command.

## 6. Docs and finish
docs/SEARCH.md and docs/SEO.md (how it works, what is indexed, how to add a new content type safely), DATA-MODEL, STATE, ROADMAP tick, add owed manual checks. Full suite twice, typecheck, lint, build. AUDIT.md entry (never edit old ones). Then the 9-part summary with real counts and commit hashes, a coverage table for sections 1 to 5 (built and tested with test name, built but untested, missing), UI checks not done in a browser, then the PR text. Do not push.