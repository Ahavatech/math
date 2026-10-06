Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 04. Save this exact prompt as docs/prompts/04-design-system.md.

PRE-CHECK
- Stage 03 must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/04-design-system from main.

PROCESS
Use Superpowers writing-plans. Use the Impeccable skill and its commands for design direction and checks. Run its help or list to see which commands are installed, and use the ones that fit (design critique, polish, accessibility audit). Do not add features outside this prompt. Do not reopen decisions in DECISIONS.md.

GOAL
A design system and the public site shell: tokens, typography, core components, header, footer and layout, plus a dev-only style guide page I can review in the browser. No data pages yet, those come in later stages.

0. REGRESSION TESTS FROM STAGE 03 (do these first, test-first)
- A test proving no user service or query returns passwordHash or any token hash to callers (listUsers and any other user read).
- A test proving forgotPasswordAction and the invite and resend flows give an identical response whether or not the email send fails.
- A unit test for the jwt callback's recheck gate: roles and isActive are re-read from the database after 5 minutes and not before, and a deactivated user's session stops working after the recheck.
- Fix the InviteUserDialog so it closes and refreshes the list after a successful invite.

1. DESIGN DIRECTION
- Write docs/DESIGN.md: principles, audience, tone (scholarly but welcoming, see PRODUCT.md), colour palette with named tokens, type scale, spacing scale, radii, elevation, motion rules, and a component inventory. Do not assume OAU brand colours. Propose a palette that suits a mathematics department, state why, and mark clearly that I will confirm it. Include contrast ratios for every text and background pair.
- Avoid the generic AI look: no default purple gradients, no stock card grids with identical icons, no centred hero cliches. Use real structure that suits the content: dense, readable, academic.
- Light theme only for now. Note dark mode as a later option.

2. TOKENS AND TYPOGRAPHY
- Implement tokens as CSS variables mapped into Tailwind and shadcn.
- Self-host fonts with next/font. No runtime requests to Google Fonts. Choose a readable text face and a heading face that suits mathematics. Limit to two families and few weights.
- Add a test that computes WCAG contrast for every text and background token pair and fails below AA.

3. COMPONENTS (build only these)
Container, Section, PageHeader, Breadcrumbs, Button variants, Badge, Card base, NewsCard, EventCard, PersonCard (these three with placeholder props only), Prose (rich text typography), EmptyState, Pagination, Alert, Skeleton, and a Math component.
- Math: renders LaTeX with KaTeX on the server (katex renderToString), inline and display modes, safe against injection, with tests. Include katex CSS only on pages that use it. Record this decision in DECISIONS.md.
- Use shadcn primitives where they fit and restyle them with tokens.

4. LAYOUT
- src/app/(site)/layout.tsx with: skip-to-content link, announcement bar (shown only if SiteSetting announcement is set and enabled), header, main, footer.
- Header: wordmark area with a slot for a logo from SiteSetting or design-assets (text wordmark until a logo is provided), primary navigation from NavItem (location HEADER, with one level of dropdown), search button that is disabled with a "coming soon" label until Stage 13, mobile menu that is keyboard and screen reader friendly.
- Footer: columns from NavItem (location FOOTER), contact details and social links from SiteSetting, copyright line.
- All of it reads from the database through src/server/services with a safe fallback when the database has no data. Nothing hard-coded except the fallback.
- Respect prefers-reduced-motion. Visible focus states everywhere.

5. STYLE GUIDE
- /design-preview shows every token and component in realistic states, at mobile and desktop widths. It must return 404 in production.

6. ADMIN
- Apply the same tokens to the admin shell so it matches, but keep it denser and utilitarian. No redesign of admin features.

7. PERFORMANCE
- Report First Load JS for each route from the build output. Target under 130 kB gzipped for public routes. If a library pushes it over, explain and fix. No client-side animation libraries.

8. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Run the Impeccable accessibility and design checks on /design-preview, fix real issues, and list what you fixed.
- Check keyboard navigation and the mobile menu by hand and report.
- If Playwright is available, take screenshots of /design-preview at 375, 768 and 1280 pixel widths and save them to docs/screenshots/. If not, tell me and skip.
- /security-review is not required this stage unless you touched auth or data access code beyond the regression tests. If you did, run it.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 04 in docs/ROADMAP.md.
- Finish with: results of each step, the palette and font choices with reasons, deviations, what I must confirm or provide (logo, brand colours), and a ready-to-paste PR title and description.
