# Editing the website

This is a guide for the HOD and admin staff. It explains how to change what visitors see on the
website, without needing a developer.

## Signing in

Go to the site and click Sign in. Use the email and password you were given, or the link in your
invite email if this is your first time.

## Where things live

Everything you can edit is under Admin in the menu once you are signed in.

- **Site content**: the department name, the HOD welcome message, the homepage image and
  headline, the announcement bar, the numbers shown on the homepage, contact details, social
  media links and the footer text.
- **Navigation**: the menu at the top and the links in the footer.
- **Pages**: longer pages like About, History and Mission and Vision.
- **Media**: every image used on the site.
- **Programmes**: the B.Sc., M.Sc. and Ph.D. pages, and the M.Sc. specialisations.
- **Research**: the research area pages.

## Changing site content

1. Open Admin, then Site content.
2. Find the section you want (for example, Homepage hero).
3. Change the text or pick a new image.
4. Click Save.

Your change goes live straight away. Every section has a Version history button, so if something
looks wrong after a save, open it and click Restore next to an earlier version.

## Uploading images

Click the image area in any section, or go to Admin, then Media.

- Pick a file from your computer. Only JPG, PNG, WEBP and AVIF files are accepted. SVG files are
  not accepted.
- You will be asked for a short description of the image (alt text). This is required, both for
  visitors using a screen reader and for search engines.
- You can crop the image to a square, a wide banner or a standard photo shape before it is saved.
- An image cannot be deleted while it is still being used somewhere on the site. Remove it from
  wherever it is used first, then delete it.

## Writing the HOD welcome message and page content

The text editor lets you:

- Add headings, bold and italic text, bullet and numbered lists, links and quotes
- Insert an image from the media library
- Insert a mathematical formula: click the formula button, type it in LaTeX (for example
  `x^2 + y^2 = r^2`), and a preview appears as you type

Whatever you type is checked and cleaned before it is saved, so pasted content from Word or other
websites will have its formatting simplified to keep the page looking consistent.

## Editing the menu

Go to Admin, then Navigation. You can:

- Add a new link, either to a page on this site or to an outside website
- Reorder links with the up and down arrows
- Hide a link without deleting it, using the visibility toggle
- Nest a link one level under another, for a dropdown

## Editing About, History and other pages

Go to Admin, then Pages, and click a page to open it. Some pages were brought over from the old
website and are marked "Imported from the old site, needs HOD review". These pages are not shown
to visitors until you open them, check the text, and save. Saving a page automatically clears
that review flag.

## Editing programmes

Go to Admin, then Programmes, and click a programme to open it. You can change the title,
summary, full description, duration and admission requirements, and set its status. The
programme level (B.Sc., M.Sc. or Ph.D.) and its web address cannot be changed here.

Under the programme, the Specialisations list lets you:

- Add a new specialisation with a title and description
- Edit an existing one
- Reorder them with the up and down arrows
- Remove one without deleting it, using the archive button (the circular arrow brings it back)

Some programmes were brought over from the old site and are marked "Imported from the old site,
needs HOD review" until you open and save them.

## Editing research areas

Go to Admin, then Research. Click a research area to edit it, or click "New research area" to
add one.

- Title, summary, full description, image and status are all editable
- The web address (slug) is generated from the title automatically. If two areas would get the
  same address, a number is added to keep them unique
- Setting the status to Archived removes it from the public site, but visitors who already have
  the link are sent to the research overview page instead of a broken link
- Each area shows which lecturers are linked to it once lecturer profiles exist (a later stage)

Use the up and down arrows on the research list to change the order areas appear on the public
site.

## Adding lecturers

Go to Admin, then Lecturers.

- Click "New lecturer", enter their full name, honorific, rank and official email, then save. This
  creates their account and sends them nowhere yet - you still need to send the invite.
- Click "Send invite" on their row. They get an email with a link to set their own password.
  "Copy invite link" shows the same link once, in case you need to share it another way (for
  example, if the email does not arrive).
- Each lecturer completes their own profile (photo, bio, research areas, contact details,
  publications, CV) under their own sign-in. You do not need to do this for them, though you can
  edit any of their fields on their behalf from their row's "Edit" action if they ask you to.
- A profile starts as Draft. Once the lecturer has added a photo, a bio and at least one research
  area, they can request publishing. You will see a badge for this on the Lecturers list. Open
  their row and click Publish to make their page visible to the public at `/lecturer/their-slug`.
  After that, their own edits go live immediately without needing your approval again, but you
  can still unpublish them or restore an earlier version at any time.
- Deactivating a lecturer's account (from Admin, Users) immediately hides their public profile,
  even if it was published.

### Bulk-adding several lecturers at once

Go to Admin, then Lecturers, then "Bulk import". Upload a CSV file with the columns `fullName`,
`honorific`, `rank`, `email` (up to 200 rows). The wizard has three steps:

1. **Check**: shows which rows are valid and which have a problem (bad email, an unrecognised
   rank, a duplicate), without changing anything yet.
2. **Create**: creates the accounts and draft profiles for the valid rows. No email is sent yet.
3. **Send invites**: a separate step, with its own confirmation, that emails every created
   account. If one email fails to send, the others still go out.

A template file pre-filled with the 8 academic staff listed on the department's current website
is at `docs/lecturer-import-template.csv`. Names are initials only (as the site shows them) and
emails are blank; see `docs/lecturer-import-notes.md` for what still needs filling in before you
upload it, including three rows whose rank could not be read precisely from the site.

## Reordering lecturers

On the Lecturers list, use the up and down arrows next to a name to change where they appear on
the public staff page and on research area pages. Within the same rank, this order decides who
shows first - for example, if you want the Head of Department to appear first among Professors,
move them to the top with the arrows. There is no automatic "HOD first" rule; the arrows are the
only way to control this.

## Non-teaching and administrative staff

Go to Admin, then Staff, to manage office and support staff (secretaries, lab staff, and similar).

- Click "New staff member" to add someone: name, position, an optional photo, and optional email
  and phone.
- **"Show email and phone on the public staff page"** is off by default. Contact details are never
  shown publicly unless you tick this for that person.
- Use the up and down arrows to change the order they appear in on the public staff page.
- "Archive" hides someone from the public page without deleting their record; "Restore" brings
  them back.
- A few records were brought over from the old website and are marked "Imported from the old site,
  needs HOD review" until you open and save them.

## The homepage numbers

Go to Admin, then Site content, then Stats. Each number (staff, programmes, research areas,
alumni) can be:

- **Automatic**: calculated from what is actually in the system (for example, the number of
  published lecturer profiles)
- **Manual**: a number you type in yourself, if you want to show a different figure

The section shows which mode is active for each number.

## Featured lecturer on the homepage

Go to Admin, then Site content, then Featured lecturer.

- **Automatic** (the default): the homepage shows a different published lecturer each day, chosen
  only from those who have both a photo and a bio filled in. You do not need to do anything for
  this to work.
- **Manual**: pick one specific published lecturer to always feature. If that person is later
  unpublished, the homepage automatically falls back to the automatic rotation until you choose
  someone else or switch back.

## Post a news item

Go to Admin, then News, then "New post".

1. Write a title. The web address (slug) is filled in automatically from the title; you can
   change it yourself until the post is first published. Changing it afterwards still works, and
   the old address keeps working too (visitors are sent to the new one automatically).
2. Pick a category (Announcement, Achievement, Admission or Research).
3. Write a short excerpt (up to 300 characters) - this is what shows on the news list page.
4. Write the full body with the text editor. You can add images and mathematical formulas the
   same way as everywhere else.
5. Add a cover image if you have one (a description/alt text is required for it).
6. Choose whether the post should be pinned (pinned posts always show first on the news list).
7. Set the status to Published, and leave the published date and time blank to make it visible
   straight away, or pick a future date and time to schedule it - it stays hidden from visitors
   until that moment, then appears on its own within about five minutes, no further action needed
   from you.
8. Click Save.

A draft post has a "View as public" link so you can see exactly how it will look before
publishing.

## Add a seminar in two minutes

Go to Admin, then Events, then "New event".

1. Write a title and pick a type (Seminar, Colloquium, Special lecture, Conference, Graduation or
   Other).
2. Set the start date and time. All times you enter here are in West Africa Time (WAT), the same
   time shown to visitors - you do not need to convert anything. An end time is optional; without
   one, the event counts as "upcoming" until the end of its start day.
3. Fill in the venue and, if there is one, the speaker's name and where they are from.
4. Write a description if you want one, and add a flyer image (a description/alt text is
   required).
5. If the event has a registration link, paste it in - it must be a secure (https) link. The same
   applies to slides and recording links, which you can add once they exist.
6. If this event is part of a recurring series (for example, a regular seminar), choose it from
   the Series list, or click "Manage series" to create a new one first.
7. Set the status to Published and click Save.

That's it - the event now appears on the public Events page, with an "Add to calendar" button
that works with Google Calendar, Apple Calendar and most other calendar apps.

Once an event is in the past, open it again to add photos to its gallery: choose an image, write
a caption and a description/alt text for it, and click "Add to gallery". You can reorder photos
with the up and down arrows, up to 30 per event.

To reuse most of an event's details for a similar one later, open it and click "Duplicate event" -
everything copies over except the dates, gallery, slides and recording links, and it starts as a
new draft so you can set a fresh date before publishing it.

## Pilot rollout

Before inviting every lecturer at once, run a small pilot first:

1. Invite two or three lecturers to start. Walk them through accepting their invite and filling in
   their profile (see `docs/LECTURER-GUIDE.md`), and fix anything confusing before going further.
2. Once the pilot lecturers have published profiles you are happy with, invite the rest in
   batches (for example, by rank or by research area) rather than all on the same day, so you can
   answer questions and review publishing requests as they come in without being overwhelmed.
3. Use the CSV bulk import for each batch if you have several names ready at once (see "Adding
   lecturers" above), or add people one at a time as they are confirmed.

## Send alumni links

Go to Admin, then Alumni, then Links.

1. Click "Create link". Give it a label (for example, "2010 cohort"), and optionally a graduation
   year, an expiry (90 days by default) and a maximum number of uses.
2. The link is shown to you once, together with a ready-to-send message. Copy it now and send it to
   the alumnus yourself, by email, WhatsApp or however you reach them. The site does not send it for
   you, and it will not be shown again.
3. If you need links for a whole range of graduation years at once, use "Generate links for years"
   instead. Enter a range (for example 2000-2005) or a list (2001,2003,2007), up to 60 at a time, and
   download the CSV file it offers. That file contains live links, so treat it like a password and do
   not post it anywhere public.
4. If a link stops being needed, click Deactivate on its row. "Regenerate" replaces a link's address
   with a new one and immediately breaks the old address, in case it was shared somewhere it should
   not have been.

## Review and approve entries

Go to Admin, then Alumni. Pending entries are shown first, oldest first.

1. Click an entry to review it. You can see every detail, including their email (which is never
   shown publicly) and their photo if they added one.
2. You can correct small mistakes, like a misspelled organisation, before approving.
3. If the entry shows "Possible duplicate", check the other entry it matches before deciding. Your
   options are: approve this one separately, replace the existing entry with this one (the old one
   is hidden but kept), or reject this one as a duplicate.
4. Click Approve to publish it, or "Approve and feature" to also show it in the "Where are they now"
   spotlight. Click Reject and write a short reason if it should not be published - the reason is
   kept privately and is never shown to the alumnus or anyone else.
5. Entries with no duplicate flag can be approved together using the "Bulk approve" button on the
   Pending list. A flagged entry must always be reviewed on its own.
6. Once approved, an entry can be edited, featured or unfeatured, or withdrawn (this hides it from
   the public page but keeps the data, and can be undone) from the Approved tab.
7. "Erase permanently" deletes an entry and its photo for good, and can only be done by the HOD or a
   super admin. There is a confirmation step because this cannot be undone.

## Handle a removal request

An alumnus who wants their entry corrected or removed uses the Contact page, which sends you a
message with a reference to their entry.

1. Check the sender's email in the message matches the private email on the alumni entry itself,
   so you know the request is really from that person.
2. If they want a correction, open their entry in Admin, then Alumni, edit it and save.
3. If they want to be removed, withdraw their entry (hides it, keeps the data, reversible) or erase
   it permanently if they specifically asked for deletion.

## Add a handbook page

Go to Admin, then Handbook, then "New page".

1. Write a title. The web address fills in automatically from the title.
2. Write a short summary (shown on the handbook's start page) and the full page using the text
   editor, the same one used everywhere else.
3. If this page belongs under another page, choose it as the parent. The handbook only supports
   two levels, so you cannot nest a page under a page that already has a parent.
4. Set the status to Published and save.

Use the up and down arrows on the Handbook list to reorder pages. Changing a page's web address
later still works, since the old address keeps redirecting to the new one.

## Import the handbook

If you have handbook content already written as Markdown files, put them in the
`docs/handbook-import` folder (see that folder's own instructions for the exact format) and run:

```bash
npm run handbook:import
```

This only shows you a plan of what would happen. Nothing is written until you run it again with
`-- --apply`. Every imported page starts as a draft, so you can review it before publishing, and
the importer never overwrites a page you have already edited.

## Import the course list

Go to Admin, then Courses, then "Import CSV". The file needs these columns: code, title, units,
level, semester, programme, elective, prerequisites, description. Prerequisite codes go in one
cell separated by semicolons, for example "MTH 101;MTH 102".

Choose your file and you will see a dry-run report: which rows are valid and which have a problem
(an invalid code, a duplicate, an unknown prerequisite, or prerequisites that would create a loop).
Nothing is created until you click the button to commit. Every imported course starts as a draft.

## Add a form to Downloads

Go to Admin, then Downloads.

1. Choose a PDF file (up to 10MB), give it a title, an optional description, and a category
   (Handbook, Form, Guideline, Timetable or Other).
2. Set the status to Published and upload.

Use the up and down arrows to reorder files within their category. Uploading a replacement file for
an existing download removes the old file automatically once nothing else is using it.

## Update the calendar

Go to Admin, then Calendar. Add an entry with a session label (for example "2026/2027"), a title,
a start date, and an optional end date. Visitors can subscribe to the calendar or download it as a
file that works with most calendar apps.

## Answer a contact message

Go to Admin, then Messages. Opening a new message marks it as read automatically.

- Use "Reply by email" to open your own email program with the sender's address filled in. This
  site never sends a reply for you.
- If a message is about an alumni entry, you will see a link straight to that entry so you can
  check it and take action.
- Change a message's status (New, Read, Replied, Archived) as you work through it. Archived
  messages are kept for 12 months, then deleted automatically.
- If you want to be told by email whenever a new message arrives, set your address in the
  notification box at the top of the Messages page.

## Set up the journal

Go to Admin, then Journal settings. Fill in the journal's name, short name, ISSN (if it has one),
publisher, frequency, and the licence that applies to articles. Until you set a name here, the
public journal pages show the neutral label "Departmental Journal" instead. You will see a banner
reminding you to set the name, ISSN and licence before you announce the journal publicly.

The journal also has four pages you can edit under Admin, then Journal pages: About, Guidelines,
Call for Papers, and Policies. Each one starts with placeholder text that says "Needs editor
input." A page with that placeholder text never shows up on the public site, so visitors never see
unfinished content. Replace the placeholder with your own text and save, and the page goes live.

## Add the editorial board

Go to Admin, then Editorial board. For each member, either:

- Choose one of our own lecturers from the list (their name, photo and department come from their
  own profile automatically), or
- Enter an external member by hand: name, affiliation, country, and optionally an ORCID number and
  a website link.

Give each member a role title (Editor-in-Chief, Associate Editor, Editorial Board Member, Advisory
Board Member, or your own wording), then use the up and down arrows to put them in the order you
want them to appear. If a lecturer's own profile is later taken offline, they disappear from the
public board automatically until it is restored.

## Publish an issue and articles

Go to Admin, then Journal issues, and click New issue. Give it a volume number, an issue number,
and a year - these three must be unique together. Add an optional title, description and cover
image. Save it as Draft while you are still preparing it, then change the status to Published when
it is ready to go live.

Next, go to Journal articles and click New article. Fill in the title, the abstract (you can use
the same rich text editor and maths notation as everywhere else on the site), keywords, and the
authors in the order they should appear - each author can have an affiliation, an ORCID number and
a private email address that is never shown publicly. Choose which issue the article belongs to,
or leave it blank for an "online first" article that is not yet tied to an issue.

Before you can publish an article, you need: a title, an abstract, at least one author, and an
uploaded PDF. The edit page shows a checklist so you always know what is still missing. Once an
article is saved and has an id, a PDF upload box appears - choose the file and it uploads straight
away.

If you give an article the same title as one that already exists in the same issue, you will see a
warning when you move away from the title field. This is just a warning - you can save anyway if
it is intentional (for example, a correction or an erratum).

Changing an article's title before it has ever been published also changes its web address
automatically. Once an article has been published for the first time, its web address stays fixed
even if you later change the title, so that links and citations to it keep working.

Unpublishing an issue immediately hides every article inside it from the public site, including
their PDF downloads - this happens automatically, you do not need to unpublish each article one by
one.

## If something looks wrong on the live site

Open the section in Admin and check Version history. If the problem is not something you changed,
contact the development team with a screenshot and the page address.
