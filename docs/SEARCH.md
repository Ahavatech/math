# Site Search

## Overview

The site search surfaces content from 12 content types via a single `/search?q=` page. It is powered by PostgreSQL full-text search with `tsvector` GENERATED ALWAYS STORED columns and GIN indexes, supplemented by `pg_trgm` trigram indexes for name/code prefix matching.

## Architecture

### Search index columns

Each searchable table carries a `searchVec tsvector GENERATED ALWAYS AS (...) STORED` column updated automatically by PostgreSQL on every write. GIN indexes on these columns make `@@` queries fast.

| Table | Fields indexed |
|---|---|
| NewsPost | title + excerpt + body |
| Event | title + description |
| LecturerProfile | fullName + bio |
| NonTeachingStaff | name + position |
| Programme | title + summary + body |
| ResearchArea | title + summary + body |
| Download | title + description + category |
| AcademicCalendarEntry | title + description |
| JournalIssue | title + description |

Tables without a stored `searchVec` (Course, HandbookPage, Article) use a functional GIN index on `to_tsvector('english', "searchText")`.

Trigram indexes cover `LecturerProfile.fullName`, `NonTeachingStaff.name`, and `Course.code` for prefix/substring matching.

### Migration

`prisma/migrations/20261028120000_site_search_gin_indexes/migration.sql`

Adds `pg_trgm` extension, all `searchVec` columns, and all indexes. Idempotent (`IF NOT EXISTS`, `IF EXISTS`).

### Service: `src/server/services/site-search.ts`

Exports:
- `SearchResultType` — union of 12 type strings
- `SearchResult` / `SearchResults` — typed result shapes
- `validateSearchQuery(q)` — returns trimmed query or `null` if < 2 or > 100 chars
- `siteSearch(db, rawQuery, { page?, type? })` — runs 12 parallel per-type searchers, filters, paginates at 20/page

Each per-type searcher uses `db.$queryRaw(Prisma.sql\`...\`)` (parameterized). Alumni are never searched. Each searcher silently catches errors so one broken type does not break the whole response.

**Visibility rules:**
- News/Events/Downloads/Programmes/Research/Calendar/Staff: `status = 'PUBLISHED'`
- Articles: `status IN ('PUBLISHED','CORRECTED','RETRACTED')` with issue publication gate
- Lecturers: `isActive = true`
- Journal issues: `status = 'PUBLISHED'`
- Courses/Handbook: all rows (managed content, always visible)

## Page: `src/app/(site)/search/page.tsx`

- Rate-limited: 30 requests/minute per IP (in-memory, resets on restart)
- `robots: { index: false, follow: false }` — excluded from crawlers
- `searchParams` typed as `Promise<...>` per Next.js 15 async convention
- Type filter nav, pagination, ARIA roles (`role="search"`, `role="status"`)

## Query syntax

Uses `websearch_to_tsquery('english', ...)` which accepts natural-language input: quoted phrases, `-exclusions`, and implicit AND between words. No special characters are needed.

## Ranking

Results within each type are sorted by `ts_rank(searchVec, query) DESC`, then by recency where applicable. All 12 type results are merged and returned in order (news first, lecturers last).

## What is NOT searched

- Alumni entries (privacy; they are never public until admin-approved and the field is personal data)
- Draft/pending/rejected content
- Admin-only pages

## EXPLAIN note

On a near-empty database the planner chooses a Seq Scan because the GIN bitmap-scan overhead exceeds the table size. The GIN index is present and used by the planner once a table grows past a few hundred rows.

## Rate limiting

`InMemoryRateLimiter` in `src/lib/rate-limit.ts` — keyed by IP from `x-forwarded-for` or `x-real-ip`. Window: 60 s, limit: 30 requests. Returns `{ allowed: false }` on excess; the page renders a "too many searches" message without crashing.
