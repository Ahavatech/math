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
| research | oau-maths/research | site.edit |
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

## Limits to watch on Cloudinary's free plan

- 25 monthly credits (roughly 25GB of combined storage, bandwidth and transformations). Client-side
  compression before upload is the main defence against burning through this quickly.
- 500 transformations per asset per day is not a realistic ceiling at this site's traffic, but if
  a page starts requesting many different sizes of the same image, consider fixing a small set of
  `w_` values instead of letting `next/image` request every viewport width.
- If the department outgrows the free tier, the signed-upload and `f_auto/q_auto` pattern in this
  codebase does not need to change: only the Cloudinary plan does.
