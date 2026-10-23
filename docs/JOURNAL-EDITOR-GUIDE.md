# JOURNAL-EDITOR-GUIDE.md

Plain-language guide for editors who manage manuscript publication. Read JOURNAL.md for the technical details.

## Who can do what

| Role | Can do |
|---|---|
| SUPER_ADMIN, Editor-in-Chief | All publication actions |
| JOURNAL_EDITOR | Screen, assign reviewers, record decisions; cannot publish, correct, or retract |
| HOD | Read-only access to manuscripts |
| ADMIN | No journal access |

## Step 1: Accept a manuscript

After recording a final ACCEPT decision on the manuscript detail page (`/admin/journal/manuscripts/[id]`), the manuscript status changes to ACCEPTED. This is the entry point for publication.

## Step 2: Prepare for publication

On the ACCEPTED manuscript's page, if you are the EiC or SUPER_ADMIN, you will see a "Prepare for publication" button. Clicking it:

- Creates an article record in DRAFT status, copying the title, abstract, keywords, and authors from the manuscript.
- Sends the corresponding author a "paper is being prepared" email.
- Redirects you to the new article edit page.

This step is irreversible (the article exists from this point). If you made a mistake, edit the article's metadata instead.

## Step 3: Edit article metadata

On the article edit page (`/admin/journal/articles/[id]`), fill in or confirm:

- **Title, abstract, keywords**: verify the typeset versions match what was accepted.
- **Authors**: confirm name, affiliation, ORCID for each author. Email is stored privately (not shown publicly).
- **Issue**: assign to an existing issue, or leave blank for "online first".
- **Page range**: enter start/end page numbers once you know them.
- **DOI**: enter in the format `10.xxxx/...` if the journal has a DOI prefix. Optional.
- **Licence**: defaults to the journal's global licence; override here only if this article uses a different one.
- **Received/Accepted dates**: should have been imported from the manuscript; verify them.

## Step 4: Upload the final PDF

Still on the article edit page, use the PDF upload button. The PDF is stored in Cloudinary (public file pipeline) and is publicly accessible at `/journal/articles/[slug]/pdf`. A sha256 fingerprint is recorded at upload time.

The publishing checklist (visible at the top of the form) shows whether title, abstract, authors, PDF, and licence are all present. All five must be green before publishing.

## Step 5: Schedule or publish

The "Publishing" panel at the bottom of the article edit page (EiC/SUPER_ADMIN only) offers:

- **Publish now**: immediately publishes the article. Sends a "your article is published" email to all listed authors.
- **Schedule for**: set a date and time, then click Schedule. The article moves to SCHEDULED status. The `journal:publish-scheduled` script promotes it automatically when the time arrives.

After the article is published, its URL (`/journal/articles/[slug]`) is permanent and indexed.

## Step 6: Correct a published article

If errors are found after publication, use "Add correction" in the Publishing panel. Type a description of what was corrected and when, then click "Add correction". The article status changes to CORRECTED and a correction banner appears on the public page. You can add multiple corrections over time.

## Step 7: Retract an article

If an article must be retracted, use "Retract article" in the Publishing panel. A reason is required. The article moves to RETRACTED status. The public page stays accessible with a retraction banner showing the reason; this is intentional (Decision 76). The PDF download also remains available.

## Reviewer acknowledgements

Reviewers who opted in appear on `/journal/reviewers/[year]`. Reviewers control this via their dashboard (`acknowledgementOptIn`). Editors cannot add or remove names from this list directly; only the reviewer's own preference matters.

## Things that are NOT possible through the admin

- Changing a retracted article back to published (use the database directly, with care).
- Unpublishing an already-published article (use correct or retract instead).
- Showing reviewer identity on any public page (reviewer identity is always hidden from authors and the public).
