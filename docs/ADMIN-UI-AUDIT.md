# Admin UI audit (Stage 20)

Scope: the admin area (`/admin`), 116 page files. This audit is based on looking at the dashboard, the News, Events, Alumni and Lecturers lists, the New post form and the shell at desktop and phone width, on automated accessibility scans of six admin pages (Stage 17), and on reading the shared components. It is not a review of every admin screen. Pages not looked at are listed at the end.

Severity: P1 blocks or seriously slows a task, P2 causes real difficulty or looks unfinished, P3 polish.

## Fixed in this stage

| # | Finding | Sev | Fix |
| --- | --- | --- | --- |
| 1 | The sidebar was a plain white list of 24 to 27 links that needed scrolling on a laptop screen, had no logo and no colour, and could not be closed on a large screen. | P1 | Ink sidebar with the department mark and "Mathematics / Admin"; groups fold away and only the group you are in starts open, so the list is about 8 lines; a "Jump to a page" box (press `/`) filters every page by name; the active page is solid red; a "Hide the menu" button and a top-bar Menu button hide and show it (remembered in the browser); on a phone it is a slide-in drawer that closes with Escape or by tapping outside. A closed drawer is now removed from the accessibility tree. |
| 2 | The top bar was empty apart from "Signed in as" and gave no sense of where you were. | P2 | The bar is sticky and shows the current page and its group, plus View public site and Sign out. |
| 3 | Every status label was the same grey, so a list of drafts and published items read as one block. | P2 | `StatusBadge`: solid ink = live, dashed outline = unfinished, red = needs a person, grey = set aside. The word is always shown. Used on news, events, courses, programmes, research, handbook, downloads, lecturers and messages. |
| 4 | Badges, buttons and body text were 12 to 14 px, with small tap targets. | P2 | Body 15 px, badges 13 px and 24 px tall, buttons at least 36 px tall, across the admin. |
| 5 | The Upcoming/Past and Pending/Approved/... switches were tiny text links with an underline for the current one. | P2 | Real tabs (`UnderlineTabs`) on Events and Alumni, announcing the current tab. |
| 6 | Raw database values showed in lists ("SPECIAL_LECTURE", "ANNOUNCEMENT"). | P2 | Shown as words on the Events, News and Messages lists. |
| 7 | Lists were capped at a narrow column, leaving most of a wide screen empty. | P3 | Cap raised to 60rem. |
| 8 | The Alumni empty state said only "No entries here." | P3 | Says which list is empty and what will appear. |
| 9 | `/admin/users` listed every user with no pages (about 2,700 test accounts made the page very long and an accessibility scan take minutes). | P1 | 25 per page, a search over name and email, a "Showing 1 to 25 of N" line and Previous/Next (`listUsersPage`, tested). |

## Still open

| # | Finding | Sev | Suggested fix |
| --- | --- | --- | --- |
| B | The forms (News, Events, Pages, Programmes) are one long column of 32 to 36 px fields with small labels and no grouping or sticky save bar, so saving a long form means scrolling to the bottom. | P2 | Sections with headings, 44 px fields, a sticky Save and Cancel bar, and an "unsaved changes" warning. |
| C | The rich-text editor toolbar is text-only ("H2", "H3", "Bold") with no icons, no grouping and no keyboard hints. | P2 | Icon buttons with accessible names, grouped, with a visible active state. |
| D | Row actions are tiny repeated words ("Archive", "View public") with no object, so a screen reader hears the same name on every row. | P2 | Add `aria-label` such as "Archive: <title>" and use a "More" menu for rarely used actions. |
| E | Destructive actions (archive, erase, deactivate) were not reviewed for confirmation and undo. | P2 | Audit each; use a confirm dialog that names what will happen. |
| F | Empty states on most other lists are still a bare sentence. | P3 | Use the pattern from Alumni: what is empty, why, what to do. |
| G | Other lists may still show raw enum values (courses, lecturers' invite state, journal manuscripts). | P3 | Route every enum through `humanise()` or a label map. |
| H | The dashboard counts are not links except the "Waiting for you" rows. | P3 | Link each count to its list. |
| I | There are no breadcrumbs on deep admin pages (for example `/admin/news/[id]`). | P3 | Add a "Back to News" link at the top of every edit page. |
| J | Colour is limited to the sidebar and badges; the content area is still white and flat. | P3 | Decide with the HOD whether the admin needs more of the brand; do not add colour that does not carry meaning. |

## Not looked at

Media library, Navigation editor, Pages editor, Programmes and Research editors, Handbook and Courses editors, Downloads, Calendar, Messages detail, Users, the whole of `/admin/journal/*` (manuscripts, reviewers, issues, articles, board, settings), `/admin/my-profile`, and every dialog. These inherit the new shell, text sizes and status badges but were not reviewed one by one.
