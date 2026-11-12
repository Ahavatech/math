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
| 10 | The forms (News, Events, Pages, Programmes, Research, Handbook, Courses, Journal pages and issues) were one long column with the Save button at the very end. | P2 | A sticky Save bar (`SaveBar`) stays at the bottom of the screen and shows "You have unsaved changes"; the News and Events forms are split into titled sections (`FormSection`); fields are at least 40 px tall with 15 px labels and larger checkboxes. The forms that already warned on leaving with unsaved edits still do. |
| 11 | The rich-text editor toolbar was text-only ("H2", "Bold"). | P2 | Grouped icon buttons with accessible names and tooltips (with the Ctrl+B / Ctrl+I hints), a filled state for the formatting at the cursor (`aria-pressed`), and a labelled toolbar landmark. |
| 12 | Row actions were a bare word repeated on every row ("Archive", "Restore", "View public", "Move up"), so a screen reader heard the same name each time. | P2 | Each now includes the item ("Archive: Open day"), on news, events, downloads, lecturers, staff, research, calendar, users and the media library. The visible word is unchanged. |
| 13 | Destructive actions had no confirmation, or used the browser's plain `confirm` box. | P2 | `ConfirmButton` dialog that says what will happen and whether it can be undone: media delete, menu item delete, calendar entry delete, user and lecturer deactivation, alumni erase, journal issue archive. Reversible archive/restore buttons deliberately do not ask. |
| 14 | Most empty lists were a bare "No X yet." | P3 | `AdminEmpty` says what is missing and what to do, on alumni links, calendar, downloads, event series, handbook, manuscripts, reviewers, lecturers, research and staff. |
| 15 | Some lists still showed raw values ("UNDER_REVIEW", "UNDERGRADUATE", role names). | P3 | Alumni, review form, journal articles, issues, journal pages, pages, manuscripts, messages and the users table now show words or status badges. |
| 16 | Dashboard counts were plain numbers. | P3 | Each count links to its list (only when the person may open it). |
| 17 | Deep pages had no way back. | P3 | The shell shows "Back to <list>" above any page that sits under a listed page (edit screens, `my-profile/security`, `alumni/links`). |

## Still open

| # | Finding | Sev | Suggested fix |
| --- | --- | --- | --- |
| J | Colour is limited to the sidebar and badges; the content area is still white and flat. | P3 | A design decision for the HOD, not a defect: do not add colour that does not carry meaning. Left as is on purpose. |
| K | The sticky Save bar and sections were applied to the nine long forms above. Other forms (site settings, lecturer admin fields, alumni review, navigation, programme specialisations) were not restructured. | P3 | Apply `SaveBar` and `FormSection` to them in the same way when each is next touched. |
| L | Row actions that are tiny words rather than a "More" menu: the labels are now unambiguous, but a row with five buttons (lecturers) is still busy. | P3 | A per-row menu for rarely used actions. |

## Not looked at

Media library, Navigation editor, Pages editor, Programmes and Research editors, Handbook and Courses editors, Downloads, Calendar, Messages detail, Users, the whole of `/admin/journal/*` (manuscripts, reviewers, issues, articles, board, settings), `/admin/my-profile`, and every dialog. These inherit the new shell, text sizes and status badges but were not reviewed one by one.
