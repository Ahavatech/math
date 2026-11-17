# Design system

**Status: Stage 15, part 1 (replaces the Stage 04 chalkboard system).** The HOD has not yet seen this direction. Treat it as proposed until they confirm it.

## Direction: the exercise book, read as a Swiss editorial journal

The site reads like a beautifully typeset mathematics journal set on squared paper, not like a notebook and not like a university template.

- **Signature:** a red double margin rule runs down the left gutter of every public page, like the margin of an exercise book. It draws itself once on load. It is the only thing that is always red.
- **Squared paper** appears only in masthead zones (the homepage hero), faded out downward. It is never behind running text.
- **Figures:** mathematical illustrations are authored SVG with real notation (`src/components/sections/riemann-figure.tsx`). They cost no image download.
- **No cards** as page structure. Content is set as ruled index rows (hairline above, a red tick slides in on hover), the way a table of contents or an index is set.
- **Corners are square** (`--radius: 0.125rem`) for controls and page structure. Two surfaces are deliberately soft, because they are the phone's native shapes: inset grouped lists (`--radius-group`) and sheets (`--radius-sheet`). No gradients and no shadows except the dropdown menu. Glass is used only on the bars the page scrolls under (see Phone conventions).

## Direction contract

- THESIS: one department site that is unmistakably mathematical because its frame is squared paper, a red margin rule and typeset notation, while the reading column stays calm. Refuses the university template (hero, stats band, card grid).
- OWN-WORLD: cool white paper, blue-black ink, one red. Source Serif 4 for headings and long reading, Hanken Grotesk for interface and body. Ruled rows, 2px ink rules under section heads.
- STORY: a visitor sees what the department is, then finds courses, calendar, news, staff or the journal within two taps.
- FIRST VIEWPORT: the department title and standfirst on squared paper, one primary action, the department's figures in one quiet line, and an authored integral figure. Header with a labelled Menu button on phones.
- FORM: the squared exercise book (assigned direction, seed key 48560c91), interpreted as an editorial system.

## Colour

Light and dark, following the device (`prefers-color-scheme`). Every colour is a semantic token that flips; no component writes white, black or a hex colour (`tests/unit/design/no-hardcoded-colours.test.ts` fails the build if one does, except the QR code, which must stay dark on light to scan). Every pair, in both schemes, is asserted by `tests/unit/design/contrast.test.ts`, which reads the hex values from `src/app/globals.css`. The table is the light scheme; the dark scheme is the `@media (prefers-color-scheme: dark)` block next to it.

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
| `--input` | `#7a8796` | Form field borders (3:1 against the page) |
| `--grid` | `#dce6ec` | Squared-paper lines (decorative only) |
| `--chrome`, `--chrome-foreground` | `#0d1626`, `#fbfcfc` | The dark admin sidebar and sheet scrims; a dark panel in both schemes |

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

Admin is an Operate surface: denser than the public site, same ink, rules and single red. `src/app/admin/admin-shell.tsx` and `admin-nav.tsx` make an ink sidebar with the department mark, collapsible groups (only the current one open), a jump-to-page box (press `/`) and a solid red current page. It can be hidden on a large screen (remembered in the browser) and is a slide-in drawer below 1024px. `StatusBadge` shows status as a word in a consistent style: solid ink is live, dashed outline is unfinished, red needs a person, grey is set aside. The dashboard leads with "Waiting for you" (alumni to approve, new messages, manuscripts awaiting screening, draft posts), shown only where the user has the permission to act, then the site's counts as ruled lists instead of stat cards. A small unlayered block at the end of `globals.css` styles `.admin-main` titles, section headings, tables and a 13px text floor, so the 100+ existing admin pages share one look without being edited one by one.

## Donations page (Stage 16)

`/donate` uses the reading-page grammar: serif introduction, ruled "What gifts support" list, and a sticky "How to give" panel with a red rule under its title, the account number set large and selectable, and a copy button with a spoken confirmation. The footer shows a "Support the department" button only while the page is switched on.

## Standalone screens (Stage 18)

Sign-in, forgot password, reset password and accept invite share `src/app/(auth)/auth-shell.tsx`: the department mark, a serif title with the 2px ink rule, one narrow column on squared paper, 48px fields, and a way back to the website. The 403 and 404 pages use the same frame; the 404 offers six section links and a search box. All of them are `main` landmarks. One-time-link pages are `noindex` with `referrer: no-referrer`.

## Layout width

The page container is now 80rem (was 72rem). The primary navigation is inline from 1366 px up; below that the labelled Menu button is used, because ten navigation items do not fit beside the title at 1280 px.

## Not yet redesigned

The journal author and reviewer inner screens (manuscript detail, review form, invitation, verify, register) only had their controls, headings and statuses restyled, not recomposed. The individual admin pages (forms, lists, dialogs) were not recomposed: they inherit the new tokens, fonts, titles and tables only. The old shadcn `.dark` class block was removed; dark mode now comes from the device setting through the token block described under Colour.


## Phone conventions (Stage 22)

The platform conventions for phone apps, translated for a website (this is a website, so none of it uses native components):

- **Tab bar, glass, content flows under.** Below 768px (public) and 1024px (admin) a fixed bottom tab bar replaces the header Menu button: Home plus the three most useful sections the department has in its menu (taken from the database menu, never hard-coded), and More or Menu. It is translucent (`.glass`: the page is blurred behind it and scrolls under it) and falls back to a solid bar where blur is unavailable or the person asked for reduced transparency. The page ends above it (`body[data-tabbar]` padding, with the safe-area inset).
- **Symbols match the text.** Icons are lucide, drawn at the weight of the text beside them (a hairline next to regular text, heavier next to medium or bold; `svg.lucide` rules in `globals.css`), sized to the text, and coloured from the text. Section icons come from the address (`src/lib/nav-icons.ts`, `src/lib/admin-icons.ts`), so a renamed menu keeps its symbols.
- **Grouped lists, not a card per row.** Related rows share one inset rounded container with hairlines between them (`.grouped`): admin lists of news, events, lecturers, staff, alumni, messages and so on, and the phone menu. A row is never its own bordered card.
- **A large title that tucks into the bar, and a Back that never scrolls away.** Pages keep their large title. The sticky glass bar carries the Back button (to the section the page belongs to; `src/lib/parent-path.ts` only returns real pages) and shows the page title in compact form once the large one has scrolled under it. On desktop admin the bar always shows the title.
- **Real sheets.** The phone menu, the admin menu and every dialog open as a bottom sheet on a phone: it slides up, has a grab handle, soft top corners and a scrim, and is dismissed by pulling it down, tapping outside or pressing Escape (`DialogContent`, `useSheetDrag`). From 640px dialogs are centred modals again.
- **Success you see, not read.** A save or a sent message shows a check mark that pops in and draws itself, with a short haptic tick on phones that allow vibration (`SavedMark`, `src/lib/haptics.ts`). There is no "Saved." banner; screen readers still get a status message. Haptics are skipped for people who prefer reduced motion, and do nothing on browsers without the Vibration API (iPhone Safari), where the check mark alone carries it.
- **Dark mode** is described under Colour. A three-way Appearance toggle (Light, Dark, System) is in the footer, the phone menu sheet and the admin sidebar (`ThemeToggle`). The choice is kept in this browser (`oau-theme`) and applied as `data-theme` on `<html>` by a tiny inline script before first paint, so there is no flash; System removes it and the device decides. The forced-dark palette is asserted identical to the dark-device palette by the contrast test.
- Tap targets are at least 44px tall on phones: footer links, breadcrumbs and section links were raised in this stage. Form field borders are 3:1 against the page (a gap found by the new contrast tests).
