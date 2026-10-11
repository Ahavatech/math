/**
 * The single shared date/time helper for the whole app. See docs/TIME.md.
 *
 * Rule: every instant is stored in the database as UTC. Every public
 * display and every admin date/time input is in Africa/Lagos (WAT),
 * which is a fixed UTC+1 offset with no daylight saving - Nigeria has
 * never observed DST, so this never needs a timezone database, just a
 * constant offset. No other file in this app should format or parse a
 * date/time itself; everything goes through here.
 */

export const WAT_OFFSET_MINUTES = 60;
const WAT_OFFSET_MS = WAT_OFFSET_MINUTES * 60_000;

/** Shifts a UTC instant forward by the WAT offset, so getUTC*() methods on the result read as WAT wall-clock values. */
export function toWATDate(utcDate: Date): Date {
  return new Date(utcDate.getTime() + WAT_OFFSET_MS);
}

/**
 * The last millisecond of the WAT calendar day that `utcDate` falls on,
 * returned as the equivalent UTC instant. Used as the implicit end of an
 * event that has no explicit `endsAt`.
 */
export function endOfDayWAT(utcDate: Date): Date {
  const wat = toWATDate(utcDate);
  const endOfDayAsIfUtc = Date.UTC(wat.getUTCFullYear(), wat.getUTCMonth(), wat.getUTCDate(), 23, 59, 59, 999);
  return new Date(endOfDayAsIfUtc - WAT_OFFSET_MS);
}

/**
 * An event is "upcoming" until it has ended: its explicit `endsAt` if
 * set, otherwise the end of its start day in WAT. Exactly at the
 * boundary instant it still counts as upcoming (not yet past).
 */
export function isUpcoming(event: { startsAt: Date; endsAt: Date | null }, now: Date = new Date()): boolean {
  const effectiveEnd = event.endsAt ?? endOfDayWAT(event.startsAt);
  return effectiveEnd.getTime() >= now.getTime();
}

/** Returns an error message if endsAt is not strictly after startsAt, otherwise null. */
export function validateEventTimes(startsAt: Date, endsAt: Date | null): string | null {
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
    return "End time must be after start time";
  }
  return null;
}

const DEFAULT_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** Formats a UTC instant for public/admin display in WAT, with the "WAT" label appended. */
export function formatWAT(date: Date, options: Intl.DateTimeFormatOptions = DEFAULT_FORMAT_OPTIONS): string {
  const formatted = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Africa/Lagos" }).format(date);
  return `${formatted} WAT`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Parses an HTML `<input type="datetime-local">` value (e.g.
 * "2026-07-08T11:00"), interpreted as WAT wall-clock time, into the
 * equivalent UTC Date to store.
 */
export function watLocalInputToUtc(value: string): Date {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  return new Date(asIfUtc - WAT_OFFSET_MS);
}

/** The inverse of watLocalInputToUtc: formats a UTC Date as a datetime-local input value in WAT. */
export function utcToWatLocalInput(date: Date): string {
  const wat = toWATDate(date);
  return `${wat.getUTCFullYear()}-${pad(wat.getUTCMonth() + 1)}-${pad(wat.getUTCDate())}T${pad(wat.getUTCHours())}:${pad(wat.getUTCMinutes())}`;
}
