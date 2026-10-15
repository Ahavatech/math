# Design system

**Status: proposed.** The palette and type choices below are a considered starting point, not a locked identity — the HOD/department should confirm or redirect before Stage 05 builds real pages on top of them. Nothing here assumes OAU's institutional navy-and-gold; see "Why not OAU's colours" below.

## Principles

1. **Read mode, not persuade mode.** Visitors come to find a programme, a staff member, a paper, a date. The job of this design is to get out of the way of dense, structured information, not to sell anything. Clarity and scanability outrank visual drama.
2. **Scholarly but welcoming** (per PRODUCT.md). Scholarly means precise, unornamented, confident in whitespace and type rather than decoration. Welcoming means legible at a glance, generous touch targets, never cold or bureaucratic.
3. **Built for slow connections.** Every design decision is also a performance decision: two font families, no client-side animation library, no decorative imagery that isn't load-bearing.
4. **Nothing hard-coded.** The design system is tokens and components; the content behind header, footer, and every page comes from the database (Stage 04 builds the shell with safe fallbacks; Stage 05+ fills it in).

## Audience and tone

Four audiences share these pages: prospective/current students (need facts, fast), academic peers and journal readers (expect a credible, citation-literate surface), alumni (coming back to something familiar), and the general public/press. None of them are being sold to. The tone is a well-kept departmental noticeboard and journal front page, not a product landing page: confident typography, real structure, no filler copy.

## Why not OAU's colours

The department crest (navy and gold) exists in `design-assets/oau-logo.png` and will likely appear in the header as the actual university mark. But the *site's own* working palette is proposed independently here, for two reasons: the brief explicitly asks not to assume it, and reusing crest navy/gold as UI color (link color, button color, focus rings) risks fighting the crest itself for attention when both appear in the header. The logo stays exactly as supplied; the surrounding system is its own decision, below.

## Colour strategy: Restrained

This is a Read-mode surface: neutrals carry nearly everything, with one working accent doing real jobs (links, primary actions, focus states) rather than scattered decoration. The source material is the department's own tool: the chalkboard. Historically chalkboards are a dark, desaturated green, not black — "blackboard" is a misnomer kept by habit. That gives a mathematics department an accent that is genuinely its own material (not a generic brand-blue, not the AI-default purple/terracotta pairing) while staying restrained enough for a dense, reading-first site.

| Token | Hex | Role |
| --- | --- | --- |
| `--color-background` | `#FAF9F5` | Page background. Warm off-white (paper), not stark white — reduces glare for long reading sessions. |
| `--color-foreground` | `#1B1D1A` | Primary text. Warm near-black, not pure black. |
| `--color-muted` | `#F1EFE8` | Subtle surface fill (cards, table stripes, code/math blocks). |
| `--color-muted-foreground` | `#5C6058` | Secondary text (captions, metadata, timestamps). |
| `--color-border` | `#E1DED3` | Hairlines, dividers, input borders. |
| `--color-primary` (chalkboard) | `#1F3D2E` | Links, primary buttons, active nav, focus rings. The one accent. |
| `--color-primary-foreground` | `#FAF9F5` | Text/icons on a primary-filled surface. |
| `--color-accent` (chalk dust) | `#74603F` | Sparing secondary accent: badges, small highlights, the "pinned" marker. Never a CTA colour. |
| `--color-accent-foreground` | `#FAF9F5` | Text on an accent-filled surface. |
| `--color-destructive` | `#8C3326` | Errors, destructive actions. A muted brick red, not alarm red — stays inside the same restrained family. |
| `--color-destructive-foreground` | `#FAF9F5` | Text on a destructive-filled surface. |
| `--color-success` | `#1F3D2E` | Reuses primary; a department site has few "success" moments (form submitted, saved) and doesn't need a second green. |

### Contrast (WCAG — verified by `tests/unit/design/contrast.test.ts`, computed from these exact hex values, not asserted by hand)

| Pair | Ratio | Needs | Use |
| --- | --- | --- | --- |
| foreground on background | ≈15.3:1 | 4.5:1 (body) | Body text |
| muted-foreground on background | ≈6.1:1 | 4.5:1 (body) | Captions, metadata |
| primary-foreground on primary | ≈11.2:1 | 4.5:1 (body) | Button/link text on filled primary |
| accent-foreground on accent | ≈5.7:1 | 4.5:1 (body) | Badge text on filled accent |
| destructive-foreground on destructive | ≈7.9:1 | 4.5:1 (body) | Error button/alert text |
| primary on background | ≈8.4:1 | 4.5:1 (body) | Link text directly on the page |
| border on background | ≈1.3:1 | 3:1 (UI non-text) | n/a — borders are decorative, not held to text contrast |

(Ratios above are computed values from the automated test; if a future token edit drops one below its row's "needs" threshold, that test fails the build.)

## Typography

Two families, self-hosted via `next/font/google` (downloaded at build time into the app's own origin — no runtime request to Google Fonts' CDN, satisfying the "no external font requests" rule while still using next/font's pipeline).

- **IBM Plex Serif** — headings. A text-driven, slightly technical serif designed for sustained reading and data-dense contexts (IBM commissioned Plex partly for technical/engineering documentation), giving headings an academic-journal character without reaching for a Persuade-mode display serif (Fraunces/Playfair/Cormorant) that would overstate a department noticeboard's drama.
- **IBM Plex Sans** — body and UI. Same family as the heading face (shared design DNA avoids an awkward pairing), highly legible at small sizes, neutral enough to disappear into long paragraphs and dense tables/forms.
- Weights used: Serif 500, 600. Sans 400, 500, 600. Five total — few, as asked.

### Type scale (1.2 modular ratio from a 16px base)

| Token | Size / line-height | Use |
| --- | --- | --- |
| `--text-xs` | 12px / 16px | Fine print, timestamps |
| `--text-sm` | 14px / 20px | Captions, metadata, form labels |
| `--text-base` | 16px / 26px | Body text (measure capped at 70ch via `.prose`) |
| `--text-lg` | 18px / 28px | Lead paragraphs |
| `--text-xl` | 20px / 30px | Card titles |
| `--text-2xl` | 24px / 32px | Section headings |
| `--text-3xl` | 30px / 38px | Page subheadings |
| `--text-4xl` | 36px / 44px | Page titles |
| `--text-5xl` | 48px / 56px | Homepage hero only (ceiling — this is a Read surface, not a Persuade hero; no 6rem display type here) |

## Spacing, radii, elevation

- Spacing: Tailwind's default 4px scale, used on an 8px rhythm for section/component spacing (more space above a heading than below it).
- Radii: modest — `--radius: 0.375rem` (6px) as the shadcn base; nothing pill-shaped. An academic noticeboard reads as crisp rectangles, not a bubbly SaaS surface.
- Elevation: flat by default. One soft shadow level for popovers/dropdowns/dialogs (`0 4px 16px -4px rgb(0 0 0 / 0.12)`, offset + blur, never a zero-offset colour halo). No glass, no backdrop-blur-as-decoration.

## Motion

- `prefers-reduced-motion` is respected everywhere — when set, transitions and the mobile-menu animation collapse to instant.
- Transitions: 150–200ms, ease-out, on opacity/transform only (hover states, menu open/close, focus rings). No scroll-triggered reveal animation, no client-side animation library (explicit requirement — keeps public-route JS light).
- The one deliberate motion moment: the mobile nav drawer slides in with a matching backdrop fade; everything else is instant or CSS-only (`:hover`, `:focus-visible`).

## Dark mode

Light theme only for this stage. Tokens are structured as CSS custom properties so a `prefers-color-scheme: dark` or `[data-theme="dark"]` block can be added later without restructuring components, but no dark values are authored now.

## Component inventory (Stage 04 scope)

`Container`, `Section`, `PageHeader`, `Breadcrumbs`, `Button` (shadcn, restyled to tokens), `Badge` (shadcn, restyled), `Card` (base), `NewsCard`, `EventCard`, `PersonCard` (these three take placeholder props only — no data wiring until their stages), `Prose` (rich-text typography wrapper), `EmptyState`, `Pagination`, `Alert`, `Skeleton`, `Math` (server-rendered KaTeX, inline and display).

## What I need you to confirm

1. **The chalkboard-green / chalk-dust palette above** — or redirect me toward something else (including, if you want it, working the OAU crest navy/gold into the UI itself rather than keeping them separate).
2. **IBM Plex Serif + IBM Plex Sans** as the two type families — or a different pairing if you have a preference.
3. Whether the OAU crest (`design-assets/oau-logo.png`) should sit in the header wordmark area now, or wait until Stage 05's media pipeline.
