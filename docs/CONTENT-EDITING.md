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

## If something looks wrong on the live site

Open the section in Admin and check Version history. If the problem is not something you changed,
contact the development team with a screenshot and the page address.
