# Design system

**Status: Stage 15, part 1 (replaces the Stage 04 chalkboard system).** The HOD has not yet seen this direction. Treat it as proposed until they confirm it.

## Direction: the exercise book, read as a Swiss editorial journal

The site reads like a beautifully typeset mathematics journal set on squared paper, not like a notebook and not like a university template.

- **Signature:** a red double margin rule runs down the left gutter of every public page, like the margin of an exercise book. It draws itself once on load. It is the only thing that is always red.
- **Squared paper** appears only in masthead zones (the homepage hero), faded out downward. It is never behind running text.
- **Figures:** mathematical illustrations are authored SVG with real notation (`src/components/sections/riemann-figure.tsx`). They cost no image download.
- **No cards** as page structure. Content is set as ruled index rows (hairline above, a red tick slides in on hover), the way a table of contents or an index is set.
- **Corners are square** (`--radius: 0.125rem`). No gradients, no glass, no shadows except the dropdown menu.

## Direction contract

- THESIS: one department site that is unmistakably mathematical because its frame is squared paper, a red margin rule and typeset notation, while the reading column stays calm. Refuses the university template (hero, stats band, card grid).
- OWN-WORLD: cool white paper, blue-black ink, one red. Source Serif 4 for headings and long reading, Hanken Grotesk for interface and body. Ruled rows, 2px ink rules under section heads.
- STORY: a visitor sees what the department is, then finds courses, calendar, news, staff or the journal within two taps.
- FIRST VIEWPORT: the department title and standfirst on squared paper, one primary action, the department's figures in one quiet line, and an authored integral figure. Header with a labelled Menu button on phones.
- FORM: the squared exercise book (assigned direction, seed key 48560c91), interpreted as an editorial system.

## Colour

Light only. Every pair is asserted by `tests/unit/design/contrast.test.ts`, which reads these hex values from `src/app/globals.css`.

| Token | Hex | Role |
| --- | --- | --- |
| `--background` | `#fbfcfc` | Page (cool white paper) |
| `--foreground` | `#0d1626` | Text and rules (blue-black ink) |
| `--primary` | `#14213d` | Buttons, links |
| `--accent` | `#b3261e` | The red: margin rule, active nav, dates, focus ring, link hover |
| `--destructive` | `#8f1d18` | Errors and destructive actions |
| `--muted`, `--secondary` | `#eef2f5` | Quiet surfaces |
| `--muted-foreground` | `#455264` | Secondary text |
| `--border` | `#d5dde4` | Hairlines |
| `--input` | `#b8c4cf` | Form field borders |
| `--grid` | `#dce6ec` | Squared-paper lines (decorative only) |

## Typography

Self-hosted variable fonts (`@fontsource-variable`), subset by unicode-range so a page downloads only what it uses. Latin-ext and Vietnamese carry the Yoruba diacritics.

- **Source Serif 4:** headings (600), the `Prose` reading style (about 17px, 1.75 line height, 68ch measure) and italics.
- **Hanken Grotesk:** navigation, labels, body text in lists, forms.
- Headings use `text-wrap: balance`, tracking -0.012em. Tables and dates use tabular lining numerals. Display size tops out at `text-6xl`.

## Components changed in this stage

`globals.css` tokens and utilities (`.site-sheet`, `.grid-paper`, `.grid-fade`, `link-rule`, `.index-row`), `Container` (uses `--gutter`), `Section`, `PageHeader` (2px ink rule), `Breadcrumbs` (red slash separators), `Prose`, `NewsCard`, `EventCard`, `PersonCard` (now ruled rows, same props), site header (active-page underline, labelled Menu button, full-screen mobile menu with search), footer, announcement bar, homepage. Event categories are shown as words ("Special lecture") through `src/lib/labels.ts`.

## Motion

One authored moment: the margin rule draws down the page on load. Everything else is a short hover or focus transition (180 to 200 ms, exponential ease-out): the link underline thickening, the ruled-row tick, the arrow nudge, the menu opening. `prefers-reduced-motion` collapses all of it. No animation library.

## Inner pages (Stage 15, part 2)

Recomposed with the same grammar (2px ink rule under the title, ruled rows, square controls 48px tall, links with a drawn underline, red used for dates, active states and labels):

- Listings: Staff (search and filters as a plain bar, staff as flat rows), News and Events (filter choices are real links with `aria-current`, Upcoming/Past as underline tabs, shared `PageNav`), Programmes (one ruled row per level), Research (ruled two-column index), Students hub, Courses (table that collapses to two columns on phones), Calendar (date column, past entries folded), Downloads, Handbook, Alumni, Search.
- Details: Lecturer (sticky sidebar with photo, contact and links; publications by year; courses as ruled rows), News post, Event, Programme, Research area, About (HOD address two-column), Contact (department details beside the form).
- New shared pieces: `src/components/ui/filter-links.tsx` (`FilterLinks`, `UnderlineTabs`, `PageNav`) and `src/components/ui/field-classes.ts`.

## Journal (Stage 15b)

The journal has its own running head (`src/app/(site)/journal/layout.tsx`, `journal-nav.tsx`): the journal's name, its sections (About, Articles, Archive, Editorial board, Guidelines, Call for papers, Policies), My submissions and, when submissions are open, Submit a manuscript. It scrolls sideways on phones and reads no session, so journal pages stay static. Redone: landing, articles list, article page (title in serif, abstract, keywords, PDF, how to cite, retraction and correction notices as bordered notices), issue archive and issue page, editorial board, the four text pages, and the author dashboard, reviewer dashboard and wizard forms (restyled controls and buttons). Manuscript and review statuses use `StatusTag` (`src/components/journal/status-tag.tsx`): words carry the meaning, red fill means it needs the reader, ink fill means finished, red outline means failed. The rainbow status pills are gone.

## Admin (Stage 15c)

Admin is an Operate surface: denser than the public site, same ink, rules and single red. `src/app/admin/admin-nav.tsx` is a grouped sidebar (Overview, Website, Academics, People, News and events, Journal) with the current page filled in ink; below 1024px it collapses behind a labelled Menu button (the old fixed sidebar made admin unusable on phones). The dashboard leads with "Waiting for you" (alumni to approve, new messages, manuscripts awaiting screening, draft posts), shown only where the user has the permission to act, then the site's counts as ruled lists instead of stat cards. A small unlayered block at the end of `globals.css` styles `.admin-main` titles, section headings, tables and a 13px text floor, so the 100+ existing admin pages share one look without being edited one by one.

## Donations page (Stage 16)

`/donate` uses the reading-page grammar: serif introduction, ruled "What gifts support" list, and a sticky "How to give" panel with a red rule under its title, the account number set large and selectable, and a copy button with a spoken confirmation. The footer shows a "Support the department" button only while the page is switched on.

## Standalone screens (Stage 18)

Sign-in, forgot password, reset password and accept invite share `src/app/(auth)/auth-shell.tsx`: the department mark, a serif title with the 2px ink rule, one narrow column on squared paper, 48px fields, and a way back to the website. The 403 and 404 pages use the same frame; the 404 offers six section links and a search box. All of them are `main` landmarks. One-time-link pages are `noindex` with `referrer: no-referrer`.

## Layout width

The page container is now 80rem (was 72rem). The primary navigation is inline from 1366 px up; below that the labelled Menu button is used, because ten navigation items do not fit beside the title at 1280 px.

## Not yet redesigned

The journal author and reviewer inner screens (manuscript detail, review form, invitation, verify, register) only had their controls, headings and statuses restyled, not recomposed. The individual admin pages (forms, lists, dialogs) were not recomposed: they inherit the new tokens, fonts, titles and tables only. The old shadcn dark theme block was removed because the site is light only.
