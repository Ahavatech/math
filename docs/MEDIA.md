# MEDIA.md

How images move through the site, for anyone maintaining this code later.

## Pipeline

1. An admin picks a file in a media picker (`src/components/admin/media-picker.tsx`).
2. The file is compressed in the browser (`src/components/admin/image-compress.ts`): resized to a
   2000px long edge, re-encoded as WebP, targeted under 400KB, GPS EXIF stripped. This runs before
   anything leaves the device.
3. Optionally, the admin crops it (`src/components/admin/image-crop-dialog.tsx`) with a square,
   4:3, 16:9 or free aspect preset.
4. The browser asks `/api/upload-signing` for a signature. That route checks the session, the
   permission for the target folder, and rate limits the request, before signing a Cloudinary
   upload restricted to the folder and to jpg/png/webp/avif.
5. The browser uploads the file directly to Cloudinary using that signature. The server never
   proxies the bytes.
6. The browser calls `registerMediaAction`, which calls `registerMediaAsset`
   (`src/server/services/media.ts`). This re-fetches the asset's real width, height, bytes and
   format from Cloudinary's API and only then writes the `MediaAsset` row. Client-supplied
   dimensions are never trusted or stored.
7. Alt text is required at registration time; there is no way to save a `MediaAsset` without one.

## Folders

Each media folder maps to one permission, enforced both when signing the upload and when
registering the asset:

| Folder | Cloudinary path | Required permission |
|---|---|---|
| site | oau-maths/site | site.edit |
| lecturers | oau-maths/lecturers | lecturers.manage |
| news | oau-maths/news | news.manage |
| events | oau-maths/events | events.manage |
| alumni | oau-maths/alumni | alumni.review |
| research | oau-maths/research | academics.manage |
| journal | oau-maths/journal | journal.edit |

See `src/lib/media-folders.ts`.

## Rendering

Public pages render images through `CloudImage` (`src/components/ui/cloud-image.tsx`), a thin
wrapper around `next/image` that appends `f_auto,q_auto` to the Cloudinary URL so the browser
always gets an auto-negotiated format and quality. `next.config.ts` only allows
`res.cloudinary.com` as a remote image host.

## Deletion

`/admin/media` only allows deleting an asset that is not referenced anywhere. `countMediaUsage`
checks every nullable `MediaAsset` foreign key across the schema (research areas, lecturer
profiles, non-teaching staff, news posts, events, event gallery images, alumni entries, journal
issues, downloads) before a delete is permitted; a `MediaInUseError` is thrown otherwise. A
successful delete removes the Cloudinary asset too.

## CV uploads (PDF pipeline, Stage 07a)

Researched directly against Cloudinary's current documentation before building this (not from
memory), since it is the first file type in this codebase that is not an image compressed in the
browser:

- **Resource type**: Cloudinary's own docs state plainly that "PDF files are uploaded as an
  `image` asset type", not `raw`. The upload-signing route and the registration lookup both use
  `resource_type: "image"` for a CV, the same as every photo upload, not `raw`.
- **Public delivery is blocked by default on a free account.** Cloudinary disables delivering PDF
  and ZIP files publicly unless the account owner explicitly turns it on: Console → Settings →
  Security → "PDF and ZIP files delivery" → check "Allow delivery of PDF and ZIP files" → Save →
  accept the terms of service shown. Until that box is checked, a PDF's public URL returns
  `HTTP 401`, even though the upload itself succeeds. **This is the thing most likely to trip up a
  first CV upload on a fresh account** - the upload will look successful, and only the public
  download link will fail. The CV upload pipeline here checks this automatically (a HEAD request
  against the resulting delivery URL right after registering it) and shows an admin-readable
  message naming this exact setting if the check comes back 401, instead of a silent broken link.
- **File size**: Cloudinary does not expose a signed upload parameter that caps file size at
  upload time; "in the signed parameters" enforcement is a misconception worth noting for whoever
  reads this next. The real limit is an account-wide one (free-plan community reports put the
  `image` resource type's upload ceiling around 10MB, well above this project's own 5MB CV cap).
  Enforcement here is: (1) a client-side pre-check before the upload even starts, and (2) the real
  guarantee, a server-side re-check after upload that fetches the resource's actual `bytes` and
  `format` from Cloudinary's Admin API and deletes the asset immediately if either is wrong,
  exactly like `registerMediaAsset` already does for images (see Pipeline above) - a client can
  lie about a file before upload, so nothing before that second server-side fetch is trusted.
- **Format verification**: the registration step confirms Cloudinary's own reported `format` is
  `pdf`; where feasible, a ranged `Range: bytes=0-4` fetch of the uploaded file additionally
  confirms the first bytes are the literal `%PDF` magic number, independent of what Cloudinary
  itself reports, before trusting the file as a real PDF.

## Limits to watch on Cloudinary's free plan

- 25 monthly credits (roughly 25GB of combined storage, bandwidth and transformations). Client-side
  compression before upload is the main defence against burning through this quickly.
- 500 transformations per asset per day is not a realistic ceiling at this site's traffic, but if
  a page starts requesting many different sizes of the same image, consider fixing a small set of
  `w_` values instead of letting `next/image` request every viewport width.
- If the department outgrows the free tier, the signed-upload and `f_auto/q_auto` pattern in this
  codebase does not need to change: only the Cloudinary plan does.
