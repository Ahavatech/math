# Stage 04: Design System and Public Shell — Plan

**Spec:** docs/prompts/04-design-system.md (full detail, not retyped here).

**Design process note:** No image-generation tool exists in this session, so Impeccable's comp-led path is unavailable; this is a code-led build. The stage prompt is itself a precise, prescriptive brief (explicit component list, explicit "no OAU colors, propose + confirm", explicit font-hosting rule, explicit anti-generic-AI-look instructions), so the direction is treated as brief-pinned rather than run through the full concept-seed/decision-page ceremony. Mode: Read/Operate hybrid (an academic department's informational site, not a marketing/persuade surface) — color strategy: Restrained (neutrals + a working accent), per craft-floor.md's guidance that Operate/Read surfaces are well served by restraint, not Persuade's bolder strategies.

**Review focus:**
- Regression tests must actually catch the Stage 03 defects if reintroduced (passwordHash leak, email-send-failure leak, 5-minute recheck gate) — not just assert today's already-fixed behavior trivially.
- Contrast test must compute real WCAG ratios from the actual token hex values, not hardcode "AA: true".
- Math component must escape/sanitize: a malicious LaTeX string must not produce executable script in the rendered HTML (KaTeX's own trust:false default, verified with a test).
- Header/footer must render a sane fallback with zero DB rows (fresh dev db) and not crash.
- /design-preview must 404 under NODE_ENV=production.

## Tasks

1. **Stage 03 regression tests (TDD)** — tests/unit/database or src tests for: no password/token hash ever returned by a user-read service; forgotPasswordAction/inviteUser/resendInvite identical response on email-send failure (mock Resend to throw); jwt callback 5-minute recheck gate (mock Date, assert DB called at >5min, not before; assert a flipped isActive is reflected after the recheck window). Fix InviteUserDialog to close+refresh on success.
2. **docs/DESIGN.md** — principles, audience/tone, palette (named tokens + contrast ratios + confirmation flag), type scale, spacing, radii, elevation, motion, component inventory. Light theme only, dark mode noted as future.
3. **Tokens + fonts** — CSS variables in globals.css mapped to Tailwind v4 `@theme`, two self-hosted next/font faces. Contrast test (WCAG formula in a test file, iterating token pairs).
4. **Components** — Container, Section, PageHeader, Breadcrumbs, Button (extend existing shadcn), Badge (existing), Card base, NewsCard, EventCard, PersonCard, Prose, EmptyState, Pagination, Alert, Skeleton, Math (KaTeX server-render, tests for injection safety).
5. **Services for layout data** — src/server/services/site-settings.ts (or nav.ts) reading NavItem/SiteSetting with safe fallbacks when empty.
6. **Public layout** — src/app/(site)/layout.tsx: skip link, announcement bar, header (wordmark/logo slot, nav with one dropdown level, disabled search, accessible mobile menu), footer (nav columns, contact/social from SiteSetting, copyright). prefers-reduced-motion respected, visible focus states.
7. **/design-preview** — dev-only style guide page (404 in production), all tokens/components in realistic states at mobile/desktop.
8. **Admin shell tokens** — apply the same CSS variables to /admin, denser/utilitarian, no feature redesign.
9. **Performance check** — build output First Load JS per route, target <130kB gzipped for public routes.
10. **Verify** — lint/typecheck/test/build; Impeccable audit/critique on /design-preview, fix real findings; manual keyboard/mobile-menu check; Playwright screenshots if available; AUDIT.md entry + ROADMAP tick.
