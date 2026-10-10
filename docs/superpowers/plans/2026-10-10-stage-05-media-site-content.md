# Stage 05: Media Pipeline and Site Content — Plan

**Spec:** docs/prompts/05-media-site-content.md (full detail, not retyped here).

**Scope reality check:** this is the largest stage so far (media pipeline, rich text editor, settings registry with version history, nav editor, pages editor with live-site seeding, full homepage composition, a bundle-leak guard). Built directly in this session, in dependency order, test-first on the genuinely security/logic-critical pieces (HTML sanitizer, settings registry schemas, server-side media registration, stats computation, nav reorder logic). UI polish (crop tool, version-history view, nav editor) is built functional and correct, not gold-plated, consistent with "no redesign of admin features" from Stage 03 and docs/DESIGN.md's Operate-mode guidance (utilitarian, dense).

**No schema changes expected** — MediaAsset, SiteSetting, ContentRevision, NavItem, Page, AuditLog all already exist from Stage 02 with the fields this stage needs.

**Review focus:**
- Media registration must never trust client-supplied width/height/URL — re-fetch from Cloudinary server-side by public_id before writing MediaAsset.
- The signing endpoint must check session + permission before issuing a signature, not just validate inputs.
- The sanitizer must survive a real XSS payload battery (script tags, event handlers, javascript: URLs, SVG, iframes, style injection) on both save and render paths — test first.
- Settings registry: every key has a zod schema; a save that doesn't validate must be rejected, not partially applied.
- Stats: automatic vs manual mode must be unambiguous and never silently show stale manual data after switching back to automatic.
- Public pages (homepage, about) must not crash or show broken sections when the database is empty — same pattern already proven in Stage 04's site-content service.
- Editor/crop/KaTeX-preview bundles must not leak into public routes — a build-output check script enforces this, not just a promise.

## Tasks

1. **HTML sanitizer (TDD)** — src/lib/sanitize-html.ts wrapping `sanitize-html` with a strict allowlist (headings h2/h3, p, strong/em, ul/ol/li, a[href], blockquote, img[src|alt], span[data-latex] for math). XSS payload battery test first.
2. **Media: Cloudinary SDK + env** — server-only `cloudinary` package; env.ts additions (CLOUDINARY_* required now, already set).
3. **Media: signing route** — POST /api/upload-signing, session+permission check, folder allowlist (oau-maths/{entity}/), format/size constraints baked into the signed params, rate limited.
4. **Media: client compression** — dynamic-imported browser-side resize/re-encode to WebP (browser-image-compression or canvas-based), max 2000px long edge, target <400KB, strips GPS EXIF, keeps orientation.
5. **Media: registration service (TDD)** — src/server/services/media.ts: registerMediaAsset(publicId, ...) fetches real resource details from Cloudinary's Admin/Upload API server-side, never trusts client dimensions; tests mock the Cloudinary client.
6. **CloudImage component** — src/components/ui/cloud-image.tsx, Cloudinary loader (f_auto,q_auto, responsive widths), alt required at the type level; next.config.ts remotePatterns for res.cloudinary.com only.
7. **Admin crop tool** — dynamic-imported (react-easy-crop or canvas), aspect presets, admin-only route.
8. **/admin/media** — grid, upload, alt-text edit, usage lookup (query models with mediaId FKs), delete-if-unused.
9. **Rich text: Tiptap editor** — dynamic-imported admin component with the listed marks/nodes plus a custom Math node (data-latex) with live KaTeX preview; image insertion from media library (alt required).
10. **Settings registry (TDD)** — src/server/services/site-settings.ts: typed registry (key → {schema, default, label, section}), get/set with ContentRevision+AuditLog on every write, revalidatePath on save.
11. **/admin/site** — sectioned form UI (Identity, HOD, Hero, Announcement, Stats, Contact, Social, Footer), unsaved-changes warning, version history + restore per section.
12. **Stats service (TDD)** — src/server/services/stats.ts: automatic computation (published non-emeritus lecturers, approved alumni, programmes, research areas) with manual-override resolution per stat key.
13. **Navigation editor** — /admin/navigation: header/footer items, one level nesting, visibility toggle, up/down reorder (order integer swap, no DnD lib), internal-link validation against a known-route list. Fix the seeded duplicate "Contact" footer item from Stage 02's seed.
14. **Pages editor** — /admin/pages: list/edit Page records with the rich text editor, status, preview. Seed about/history/mission-vision/statistics-note via WebFetch from the live site, marked "Imported... needs HOD review" (admin-only flag, never public), with a clearly marked placeholder for anything unfetchable.
15. **Homepage composition** — hero, HOD welcome excerpt, stats strip, research areas, latest news/upcoming events/featured lecturer/featured alumni (each section hides itself with no data, not an EmptyState on the public side).
16. **/about** — Page content + HOD address, semantic headings, LCP image priority, explicit sizes.
17. **Bundle-leak guard script** — scripts/check-bundle-leaks.ts (or .mjs): parses the build output/manifests for public-route chunks and fails if tiptap/crop-tool/katex-preview-only code is present.
18. **Docs** — docs/MEDIA.md, docs/CONTENT-EDITING.md, docs/DECISIONS.md additions.
19. **Verify** — lint/typecheck/test/build; manual walkthrough (upload → HOD photo → welcome address → hero → announcement → menu → About → restore → public confirmation; LECTURER 403 on /admin/site and /admin/media); `/security-review`; AUDIT.md entry + ROADMAP tick.
