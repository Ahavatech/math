# SEO

## Sitemap: `src/app/sitemap.ts`

Next.js App Router sitemap route. Returns static pages plus dynamic URLs fetched from the database:

| Content type | URL pattern | Filter |
|---|---|---|
| News posts | `/news/[slug]` | `status = 'PUBLISHED'` |
| Events | `/events/[slug]` | all |
| Lecturers | `/lecturer/[slug]` | `isActive = true` |
| Programmes | `/programmes/[level]` | all |
| Research areas | `/research/[slug]` | all |
| Courses | `/students/courses/[slug]` | all |
| Handbook pages | `/students/handbook/[slug]` | all |
| Journal issues | `/journal/issues/[volume]/[number]` | `status = 'PUBLISHED'` |
| Journal articles | `/journal/articles/[slug]` | `status IN ('PUBLISHED','CORRECTED','RETRACTED')` |

Each DB query is wrapped in `try/catch` so a broken table does not abort the whole sitemap.

## Robots: `src/app/robots.ts`

Disallows crawlers from:
- `/admin` (admin area)
- `/api/` (API routes)
- `/journal/dashboard`, `/journal/reviewer`, `/journal/submit`, `/journal/verify`, `/journal/register`
- `/alumni/submit`, `/alumni/confirm`
- `/search` (search page is also marked `noindex` via its own metadata)

Sitemap URL: `${SITE_URL}/sitemap.xml`

## Metadata helper: `src/lib/seo.ts`

`buildPageMetadata(options)` returns a Next.js `Metadata` object with:
- Title template: `"%s | Department of Mathematics, OAU"`
- `openGraph.type = 'website'`, title, description, url, siteName, images
- `twitter.card = 'summary_large_image'`
- Canonical URL via `alternates.canonical` (when `path` is provided)
- `robots: { index: false, follow: false }` (when `noindex: true`)

`SITE_URL` is exported from `src/lib/seo.ts` and derives from `NEXT_PUBLIC_SITE_URL` (required in production).

## JSON-LD: `src/lib/json-ld.ts`

### `safeJsonLdString(data)`

Serializes JSON-LD for `dangerouslySetInnerHTML`. Escapes `<` to `<` to prevent script breakout if a field contains `</script>`.

### `buildOrganizationJsonLd(siteUrl)`

`@type: ["CollegeOrUniversity", "Organization"]` with `parentOrganization` (OAU) and Nigerian postal address. Embedded on the homepage.

### `buildBreadcrumbJsonLd(items, siteUrl)`

`@type: BreadcrumbList` helper for per-page breadcrumbs.

## Environment variable

`NEXT_PUBLIC_SITE_URL` (required in production) — used for canonical URLs, sitemap, robots, and JSON-LD. Set to `http://localhost:3000` in `.env` for development.

## Search page exclusion

`src/app/(site)/search/page.tsx` exports:
```ts
export const metadata = {
  title: "Search",
  robots: { index: false, follow: false },
};
```
This produces `<meta name="robots" content="noindex, nofollow">` on the search page in addition to the `Disallow: /search` rule in `robots.txt`.
