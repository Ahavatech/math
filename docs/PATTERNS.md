# PATTERNS.md

The admin-to-public content pattern this site uses, established in Stage 06
for programmes and research areas. Every later content-heavy stage
(lecturers, news, events, alumni, student resources) should follow the same
steps rather than inventing its own.

## 1. Service layer owns every write

Components and server actions never call `db.<model>.update` etc. directly
for anything with a revision history or an audit trail. A server action
parses and validates the form data, then calls a function in
`src/server/services/<name>.ts` that does the actual write, inside a
`db.$transaction`.

## 2. Every save writes a ContentRevision and an AuditLog entry

Use the generic helpers in `src/server/services/revisions.ts`
(`createRevision`, `listRevisions`, `getRevision`) and
`src/server/services/audit.ts` (`logAction`). Don't write `ContentRevision`
or `AuditLog` rows by hand in a new service; both Stage 05's settings/pages
code and Stage 06's programmes/research-areas code call these same
functions, keyed by `entityType` (a short PascalCase name like `"Programme"`
or `"ResearchArea"`) and `entityId` (the row's id).

## 3. Version history and restore in the admin UI

`src/components/admin/version-history-dialog.tsx` is the generic dialog:
pass it a `listRevisions` callback and an `onRestore` callback, and it
handles the list, the "(current)" label, and the restore button. A restore
calls the same update function the normal save path uses, with the
revision's stored snapshot as the input - never a bespoke restore code
path. (Stage 05's `src/app/admin/site/version-history-dialog.tsx` is the
older, settings-specific version of this; new code should use the generic
one instead of copying that file again.)

## 4. Archive, never hard-delete

Content with a `status: ContentStatus` field (DRAFT/PUBLISHED/ARCHIVED) is
never deleted; "deleting" it from the admin sets `status: ARCHIVED`. A
content type with no natural status field but a sub-list that needs to be
removable (like `Specialisation` under a `Programme`) gets its own
`isActive: Boolean` column instead of a schema-level cascade delete.

A public route for an archived item's slug does not 404; it redirects to
the section's index page (e.g. an archived research area's slug redirects
to `/research`, not a 404), since the slug may still be linked from
outside the site.

## 5. Public queries are their own functions, and are never trusted to throw

Every public-facing read goes through a dedicated function (e.g.
`listResearchAreasPublic`, `getProgrammeByLevel`) that:

- Filters to `status: "PUBLISHED"` only (or the admin-provided default
  filter for a status-less model) - never exposes DRAFT or ARCHIVED rows.
- Selects only public-safe fields (see docs/DATA-MODEL.md's "Public-safe
  fields" section for what that means per model).
- Wraps the query in try/catch, returning `[]` or `null` on failure, so a
  page that calls it still builds and renders when the database is empty
  or briefly unreachable (this matters most for a statically-generated
  page, since `next build` runs these queries at build time).

## 6. Up/down reordering, not drag-and-drop

Every orderable list (Specialisations within a Programme, Research areas
globally, NavItems within a location from Stage 05) uses two buttons that
swap the `order` field with the adjacent sibling - see
`reorderSpecialisation` and `reorderResearchArea` in
`src/server/services/programmes.ts` / `research-areas.ts` for the pattern:
fetch the ordered sibling list (scoped correctly - see the note on test
isolation below), find the target's index, and swap `order` with its
neighbour in one `$transaction`. Reordering the first item up, the last
item down, or a lone item in either direction, is always a silent no-op,
never an error.

**Test isolation note:** if the sibling list is scoped to something global
(no parent id to scope by, like `ResearchArea`), a shared test database
already holds real seeded rows in that same scope. Either nest reorder
test fixtures under a fresh parent row so the scope is isolated (works
when there is a parent, like `Specialisation.programmeId`), or give test
fixtures `order` values well outside the real data's range (works for a
genuinely global list, like `ResearchArea.order`). Stage 05's navigation
tests and Stage 06's research-areas tests hit this same issue; see either
test file for a worked example.

## 7. Slugs

A model with a user-facing slug uses `src/lib/slugify.ts`: `slugify(title)`
for a plain slug, or `generateUniqueSlug(title, exists)` when collisions
are possible, where `exists` is an injected `(candidate) => Promise<boolean>`
so the function needs no database to unit test.

## 8. Imported-but-unreviewed content

A stage that seeds real content fetched from the live site (never invented
text) marks each such record in a settings-registry key following the
`"<model>.importFlags"` pattern (`pages.importFlags`,
`programmes.importFlags`, `research.importFlags`): a
`Record<string, boolean>` keyed by slug, admin-only, cleared the moment
that record is next saved (since editing it IS the review). The seed
itself must never overwrite a field an admin has already changed - the
working rule is: only write a field that still holds the exact
placeholder sentinel (`src/lib/placeholder.ts`'s `PLACEHOLDER_PROSE`); the
instant a save gives it real content, re-running the seed leaves it alone
forever.

## 9. Revalidation

A save action calls `revalidatePath` for every public route the change
could affect: the content's own detail page, its index/listing page, and
`/` if the homepage surfaces it. Do this in the action, not the service -
the service layer has no business knowing which routes exist.
