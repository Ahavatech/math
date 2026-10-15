Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/DATA-MODEL.md, docs/AUTH.md, docs/DESIGN.md, docs/MEDIA.md, docs/PATTERNS.md, docs/CONTENT-EDITING.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 08. Save this exact prompt as docs/prompts/08-news-events.md.

PRE-CHECK
- Stage 07b must be merged into main and main must be up to date. If not, stop and tell me.
- Create branch stage/08-news-events from main.

PROCESS
Use Superpowers writing-plans, then test-driven development for services, date logic, ICS generation, scheduling, slugs and permissions. Follow docs/PATTERNS.md and docs/DESIGN.md and reuse existing components. Do not reopen decisions in DECISIONS.md. Run /security-review at the end and fix every real finding.

GOAL
The department can announce things and run an events calendar. The admin posts news and events in a couple of minutes, and visitors see Upcoming and Past events, flyers, galleries and an add-to-calendar button. Content that is now real replaces the self-hiding blocks on the homepage.

0. SMALL ITEMS FIRST
- Add to docs/ROADMAP.md under Stage 14: "Production seed must exclude [SAMPLE] data and test accounts. Seed adds missing NavItems with an order that does not collide with existing ones (Staff and Journal collided on a seeded database)."
- Fix the seed so new NavItems get an order after the current maximum for that location. Test it.

1. SCHEMA (one migration, tests included)
- NewsPost and Event: add previousSlugs String[] (for 308 redirects, as with lecturers).
- Record changes in docs/DATA-MODEL.md.

2. TIME RULES (write docs/TIME.md and unit tests first)
- All instants stored in UTC. All public display and admin input in Africa/Lagos (WAT, no daylight saving), with "WAT" shown in the output. Use one shared date helper module, no ad hoc formatting.
- "Upcoming" means the event has not ended: endsAt if set, otherwise the end of the start day in WAT. "Past" is everything else. Boundary tests around midnight WAT and around endsAt.
- Validation: endsAt must be after startsAt.

3. ADMIN: NEWS (/admin/news, permission news.manage)
- List with title, category, status, pinned, published date. Filter by status and category, search by title.
- Create and edit: title, slug (auto, unique, editable until first publication, afterwards changing it pushes the old one into previousSlugs), category (ANNOUNCEMENT, ACHIEVEMENT, ADMISSION, RESEARCH), excerpt (max 300 characters), body (rich text editor with media library images and math), cover image (alt required), pinned, status, publishedAt.
- Scheduling: publishing with a future publishedAt hides the post until that time. Public queries filter on status PUBLISHED and publishedAt <= now. List pages use time-based revalidation (300 seconds) so scheduled posts appear without manual action. Document this in docs/TIME.md.
- Archive and restore, never hard delete. Revisions, audit and version history as in the pattern. A "View as public" preview for drafts behind the session check (noindex).

4. ADMIN: EVENTS (/admin/events, permission events.manage)
- List with Upcoming and Past tabs, status, type, date. Search by title or speaker.
- Create and edit: title, slug (same rules), type (SEMINAR, COLLOQUIUM, SPECIAL_LECTURE, CONFERENCE, GRADUATION, OTHER), start and end date-time pickers (WAT), venue, speaker name and affiliation, description (rich text), flyer (alt required), registration URL, slides URL, recording URL (https only), series (choose or create an EventSeries inline), status.
- Gallery manager: add up to 30 images (sequential uploads using the existing compression and signed-upload pipeline, folder oau-maths/events), caption and alt required, reorder with up and down buttons, remove.
- "Duplicate event" action: copies everything except dates, gallery, slides, recording and status (the copy starts DRAFT).
- EventSeries manager: create and edit series (title, slug, description) and see their events.
- Same revisions, audit, archive and version history.

5. PUBLIC: NEWS
- /news: published posts, pinned first, then newest first, 12 per page with pagination, category filter by query parameter (works without JavaScript). Empty state when none.
- /news/[slug]: cover image, date, category, body through renderRichText, a "More news" block with the three latest other posts. Redirect old slugs with 308. Metadata and Open Graph image, schema.org NewsArticle JSON-LD, breadcrumbs.
- /news/rss.xml: RSS feed of the latest 20 posts. Escape all text. Test the output is well-formed.
- Flyer viewing: the department posts flyers, so images in news and events must open in an accessible full-screen viewer. Build a small lightbox on the native dialog element: keyboard (Escape closes, focus trapped and restored), click outside to close, large image fitted to the screen with pinch or double-tap zoom on touch, caption and alt. Load it with a dynamic import only on pages that contain zoomable images. The bundle-leak guard must still pass.

6. PUBLIC: EVENTS
- /events: tabs Upcoming and Past through ?tab=past (server rendered, works without JavaScript). Upcoming sorted soonest first. Past sorted most recent first with pagination and a year filter. Type filter. Each EventCard shows date, time in WAT, type badge, title, venue and speaker.
- /events/[slug]: flyer (zoomable), date and time with WAT, venue, speaker, description, registration button (only while upcoming), slides and recording links when present, gallery for past events (lightbox), "Part of the [series]" with other events in the series, and the add-to-calendar block.
- Calendar: GET /events/[slug]/calendar.ics returns a valid RFC 5545 file generated in-house (no dependency): UID, DTSTAMP, DTSTART and DTEND in UTC, SUMMARY, LOCATION, DESCRIPTION as plain text, URL, correct escaping and line folding at 75 octets. Fields must be sanitised against CRLF injection. Also a "Google Calendar" link. Add GET /events/feed.ics with all upcoming events so people can subscribe.
- Event JSON-LD (schema.org Event), metadata, Open Graph image, breadcrumbs. Old slugs redirect with 308.
- /events/series/[slug]: series description and all its events.

7. SEED FROM THE LIVE SITE (idempotent, never overwrites admin edits)
- Use curl through Bash on https://maths.oauife.edu.ng to read the News section. Seed the real items found: the announcement "Emerging Economy seminar holds on 8 July 2026" (news), the Emerging Economy seminar on 8 July 2026 at 11:00 AM (speaker Banji Osatumberu, MD/CEO of Market Scan International Nigeria, topic "What is the relevance of a Mathematician?", venue Departmental seminar room), and the special undergraduate lecture on optimization methods in machine learning on 24 June 2026, 10:00 AM to 12:30 PM (lecturer Adebanji Adelowo, alumnus, venue Departmental seminar room, focus areas as listed on the site). Do not copy the base64 flyer images. Mark all as "Imported from the old site, needs HOD review" in the admin only, status PUBLISHED. Do not invent anything else. Report any difference from what I listed.

8. HOMEPAGE AND NAVIGATION
- Wire the homepage "Latest news" (3 posts) and "Upcoming events" (next 3) blocks to real data. They still hide themselves when empty. Keep the announcement bar as a separate setting.
- Enable "News" and "Events" in the header and footer navigation through data, and in the admin sidebar. Dashboard card "Upcoming events" now shows the real count, plus "Draft posts".
- Revalidate the homepage, lists and detail pages whenever news or events change.

9. TESTS
- Time: WAT conversion, upcoming versus past boundaries, endsAt validation, DST-free assumption documented.
- Scheduling: future publishedAt hidden, visible after the time.
- ICS: valid structure, escaping of commas, semicolons, backslashes and newlines, line folding, CRLF injection rejected, UTC conversion. RSS well-formed with special characters.
- Slugs and 308 redirects for news and events. Duplicate event rules. Gallery order and the 30-image cap.
- URL validation (https only, reject javascript: and data:). Sanitisation of rich text in body and description.
- Public queries exclude DRAFT, ARCHIVED and future-dated posts, and never expose author emails or unpublished data.
- Permissions: LECTURER-only gets 403 on /admin/news and /admin/events. ADMIN, HOD and SUPER_ADMIN can use them. Update the permission matrix test if names changed.
- Seed idempotency and no overwrite.

10. PERFORMANCE AND DOCS
- Report First Load JS for /news, /news/[slug], /events and /events/[slug]. The lightbox must load only where needed. Bundle-leak guard must pass.
- docs/TIME.md as above. Update docs/CONTENT-EDITING.md with "Post a news item" and "Add a seminar in two minutes" in plain language, no em dashes. Add decisions to docs/DECISIONS.md (WAT display, scheduling by revalidation, in-house ICS, native dialog lightbox).

11. VERIFY AND REPORT
- Run lint, typecheck, test and build. All must pass.
- Verify by hand and report each: create and publish a news post with a cover and a flyer and zoom it on desktop and a phone-width view, schedule a post a few minutes ahead and see it appear, create an upcoming event with a flyer, add it to a calendar by downloading the .ics and importing it into Google Calendar or Apple Calendar and check the time is correct in WAT, subscribe check of /events/feed.ics, view the Past tab with a gallery, change a slug and confirm the redirect, duplicate an event, archive and restore, and confirm a LECTURER-only user gets 403.
- Run /security-review and fix every real finding. List them in the audit entry.
- Commit as conventional commits. Do not push or merge.
- Append the next AUDIT entry. Tick Stage 08 in docs/ROADMAP.md.
- Finish with: results of each step, any difference between the seeded items and the live site, deviations, anything I must do by hand, and a ready-to-paste PR title and description.
