Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 05. Save this exact prompt as docs/prompts/05-media-site-content.md.

PRE-CHECK
- Stage 04 must be merged into main and main must be up to date. If not, stop and tell me.
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set in .env. If missing, stop and tell me which. Never print their values.
- Create branch stage/05-media-site-content from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for the sanitiser, settings registry, media registration, stats and navigation logic. Follow the Impeccable design context and docs/DESIGN.md. Do not reopen decisions in DECISIONS.md. Run /security-review at the end and fix every real finding.

GOAL
The HOD can change the site's pictures, text and menus from /admin with no developer, and the public homepage and About pages render from that live data. This stage proves the "everything dynamic goes through the admin" promise.

1. MEDIA PIPELINE (images only, no PDFs yet)
- Install the Cloudinary SDK (server only). Add env.ts entries as required now.
- Compress before upload: in the browser, resize to a maximum of 2000 px on the long edge and re-encode to WebP (JPEG fallback) targeting under 400 KB, keeping EXIF orientation and stripping location metadata. Show the before and after size. Lazy-load this code, it must not enter public bundles.
- Upload with signed direct uploads: a server route issues a signature only after checking the session and the permission for the target folder. Restrict allowed formats to jpg, png, webp and avif. Block SVG and anything else. Enforce a size limit client-side and in the signed parameters. Rate limit the signing endpoint.
- After upload, a server action registers the asset. It must NOT trust client-supplied dimensions or URLs: fetch the resource details from Cloudinary on the server using the public_id, then create the MediaAsset row. Folder structure: oau-maths/{entity}/.
- Alt text is required when attaching an image to any content. Provide a prominent field and tests for it.
- src/components/ui/cloud-image.tsx: a wrapper around next/image with a Cloudinary loader using f_auto, q_auto and responsive widths. Always requires alt. Configure remotePatterns for res.cloudinary.com only.
- Admin simple crop step with aspect presets (square, 4:3, 16:9, free). Dynamic import, admin only.
- /admin/media: grid of assets, upload, edit alt text, see where each asset is used, and delete only when unused. Permission: site.edit or the permission of the entity being edited.
- docs/MEDIA.md: pipeline, limits, folders, and the Cloudinary free-plan limits to watch.

2. RICH TEXT
- Tiptap editor component for admin only, dynamically imported. Features: headings (2 and 3), bold, italic, lists, links, blockquote, image from the media library (alt required), and a math node for inline and display LaTeX with live KaTeX preview.
- Store content as sanitised HTML in the existing body fields. Sanitise on save AND on render with a strict allowlist (sanitize-html or equivalent). Math is stored as a span with data-latex and rendered on the server through the existing Math component.
- Tests with a battery of XSS payloads (script tags, event handlers, javascript: URLs, SVG, iframes, style injection). All must be neutralised.
- Public rendering goes through the Prose component with the sanitiser.

3. SITE SETTINGS EDITOR (/admin/site, permission site.edit)
- A typed settings registry in src/server/services/site-settings.ts: every key has a zod schema, a default, and a label. No ad hoc keys.
- Sections: Identity (department name, tagline, logo), HOD (name, title, photo, welcome address as rich text), Homepage hero (heading, subheading, image, one call to action), Announcement bar (text, link, enabled), Stats (see below), Contact (address, phone numbers, office hours, map latitude and longitude), Social links, Footer text.
- Every save writes a ContentRevision and an AuditLog entry. Provide a "Version history" view per section with restore.
- On save, revalidate the affected public pages so changes appear without a rebuild.
- Unsaved-changes warning and clear success and error states.

4. NAVIGATION EDITOR (/admin/navigation)
- Edit header and footer items, one level of nesting, visibility toggle, reorder with up and down buttons (no drag and drop library). Validate internal links against known routes or allow external URLs.
- Fix the duplicate "Contact" in the footer: the footer shows one contact link and the dedicated contact block, with no seeded duplicate.

5. PAGES EDITOR (/admin/pages)
- List and edit Page records (about, history, mission-vision, statistics-note) with the rich text editor, status and preview. Seed these pages by fetching the current text from https://maths.oauife.edu.ng with WebFetch. Mark each seeded page "Imported from the old site, needs HOD review" in the admin only, never on the public page. Do not invent text. If something cannot be fetched, leave a clearly marked placeholder.

6. PUBLIC PAGES
- Homepage composed of sections that read live data: hero, HOD welcome (excerpt and link to About), stats strip, research areas, latest news, upcoming events, featured lecturer, featured alumni.
- Stats: each stat is either automatic (academic staff = published non-emeritus lecturer profiles, approved alumni entries, programmes, research areas) or a manual override set in the editor. Show a label in the editor saying which mode is active.
- Sections whose data does not exist yet (news, events, lecturers, alumni) hide themselves on the public page rather than showing empty boxes. Keep an EmptyState in the admin only.
- /about renders the Page records plus the HOD address. Fix semantic headings, LCP image priority, and image sizes.
- All of it falls back safely when the database is empty or unreachable.

7. PERFORMANCE
- Report First Load JS for each public route. The editor, crop tool and KaTeX preview must not appear in public route bundles. Add a build-output check script that fails if they do.

8. DOCS
- docs/CONTENT-EDITING.md: a short plain-language guide for the HOD and admins (how to change the welcome address, picture, menu, announcement), written so it can be used in training later. No em dashes.
- Add decisions to docs/DECISIONS.md: signed direct uploads, client-side compression, no SVG, sanitised HTML storage, settings registry, up and down reordering.

9. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: upload an image from design-assets, attach it as the HOD photo, change the welcome address, change the hero, toggle the announcement bar, edit the menu, edit the About page, restore a previous version, and confirm each appears on the public site. Confirm a LECTURER-only user gets a 403 on /admin/site and /admin/media.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 05 in docs/ROADMAP.md.
- Finish with: results of each step, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
