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

A template file pre-filled with the staff names found on the department's current website is at
`docs/lecturer-import-template.csv`. Only one name (the Head of Department) could be confirmed
from the live site at the time it was written; add the rest of the department's lecturers and
their email addresses yourself before uploading it.

## The homepage numbers

Go to Admin, then Site content, then Stats. Each number (staff, programmes, research areas,
alumni) can be:

- **Automatic**: calculated from what is actually in the system (for example, the number of
  published lecturer profiles)
- **Manual**: a number you type in yourself, if you want to show a different figure

The section shows which mode is active for each number.

## If something looks wrong on the live site

Open the section in Admin and check Version history. If the problem is not something you changed,
contact the development team with a screenshot and the page address.
