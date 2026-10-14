# TIME.md: date and time rules

## The rule

Every instant is stored in the database as UTC (Prisma's `DateTime` columns). Every public
display and every admin date/time input is in Africa/Lagos time (WAT). WAT is a fixed UTC+1
offset: Nigeria has never observed daylight saving, so there is no DST transition to handle and
no timezone database lookup is needed, just a constant 60-minute offset
(`WAT_OFFSET_MINUTES` in `src/lib/time.ts`).

No file outside `src/lib/time.ts` formats or parses a date/time by hand. Every place that needs
to show a WAT time, convert an admin's WAT input to UTC for storage, or decide whether something
is upcoming or past, imports from there.

## `src/lib/time.ts`

- `toWATDate(utcDate)` - shifts a UTC instant forward by the WAT offset, so the result's
  `getUTC*()` accessors read as WAT wall-clock values. Internal helper, rarely used directly.
- `endOfDayWAT(utcDate)` - the last millisecond (23:59:59.999) of the WAT calendar day that
  `utcDate` falls on, returned as its UTC equivalent.
- `isUpcoming({ startsAt, endsAt }, now?)` - an event is upcoming until it has ended: its
  explicit `endsAt` if set, otherwise the end of its start day in WAT. Exactly at the boundary
  instant it still counts as upcoming, not past (`>=`, not `>`).
- `validateEventTimes(startsAt, endsAt)` - returns an error message if `endsAt` is not strictly
  after `startsAt`, otherwise `null`. A `null` `endsAt` is always valid.
- `formatWAT(date, options?)` - formats a UTC instant for display, in WAT, with "WAT" appended to
  the output.
- `watLocalInputToUtc(value)` / `utcToWatLocalInput(date)` - converts between an HTML
  `<input type="datetime-local">` value (always interpreted as WAT wall-clock time on both the
  admin's screen and in this function) and the UTC `Date` that gets stored or read back.

## Upcoming vs past

"Upcoming" means the event has not ended yet:

- If `endsAt` is set, the event is upcoming until `endsAt`.
- If `endsAt` is not set, the event is upcoming until the end of its `startsAt` day in WAT (so a
  one-off seminar with no stated end time stays "upcoming" for the rest of that WAT calendar day,
  then moves to "past" the next day).

"Past" is everything else. This is computed at read time from `startsAt`/`endsAt`; it is never
stored as a separate column, so it can never drift out of sync with the actual dates.

## Validation

`endsAt`, when provided, must be strictly after `startsAt`. This is enforced in the event
validator (`src/lib/validators/event.ts`) using `validateEventTimes`, not duplicated by hand
anywhere else.

## Scheduling (publishedAt)

A news post can be created with a `publishedAt` in the future. The admin UI shows it as scheduled;
the public queries filter on `status: "PUBLISHED"` **and** `publishedAt <= now`, so a
future-dated post stays invisible to the public until that moment passes - there is no separate
"SCHEDULED" status. Nothing flips the post's status automatically at the scheduled time; instead,
the news list pages use Next.js time-based revalidation (`export const revalidate = 300`, i.e.
every 5 minutes) so a scheduled post appears on its own, without anyone needing to resave or
revalidate it by hand, within five minutes of its `publishedAt` passing. The post's own detail
page at `/news/[slug]` is revalidated the same way, so visiting the URL directly also respects the
schedule without needing the list page to have refreshed first.

## Academic calendar dates (Stage 10)

`AcademicCalendarEntry.startDate`/`endDate` are `@db.Date` columns: a calendar date with no time-of-day and no timezone attached, unlike every other date in this app. A session's resumption date is "14 September 2026", not an instant - there is no WAT-to-UTC conversion to do, and `src/lib/time.ts` is not involved. The admin form uses a plain `<input type="date">`, and the public calendar page and the `.ics` feed both render/emit the date exactly as stored (the `.ics` feed uses `DTSTART;VALUE=DATE` all-day events, per RFC 5545, with an exclusive `DTEND` the day after the entry's own end date).

## Why no DST handling

Nigeria has used WAT (UTC+1) year-round since it stopped observing British double summer time in
the 1960s. There is no DST rule to apply, so `src/lib/time.ts` uses a plain numeric offset instead
of `Intl`/timezone-database-driven conversion for the UTC<->WAT math (though `formatWAT` does use
`Intl.DateTimeFormat` with `timeZone: "Africa/Lagos"` for locale-correct display formatting,
which happens to agree with the fixed offset exactly because there is no DST). If this app is
ever used somewhere with DST, `WAT_OFFSET_MINUTES` and the manual offset arithmetic in
`endOfDayWAT`/`watLocalInputToUtc`/`utcToWatLocalInput` would need to be replaced with real
timezone-aware conversion.
