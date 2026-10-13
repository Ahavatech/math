/**
 * In-house RFC 5545 (iCalendar) generator. No dependency: the format is
 * simple enough, and a dependency is one more thing to audit for a
 * format whose main risk is exactly the kind of string-escaping bug this
 * file exists to get right once, in one place.
 *
 * Security note: every text value goes through escapeIcsText before it
 * is ever placed into a property line. That function turns a raw CR/LF
 * inside the value into the literal two-character escape "\n" - it is
 * what actually prevents CRLF injection, since a value can therefore
 * never contain the real line terminator ("\r\n") the format itself
 * uses to separate properties. There is no allowlist to bypass; nothing
 * but escaped text is ever written.
 */

export type IcsEventInput = {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: Date;
  endsAt: Date | null;
  url: string;
};

const CRLF = "\r\n";
const PRODID = "-//Department of Mathematics OAU//Events//EN";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Folds a single unfolded "PROPERTY:value" line at 75 octets, per RFC 5545 section 3.1. */
function foldLine(line: string): string {
  const MAX_OCTETS = 75;
  let result = "";
  let lineOctets = 0;
  let continuation = false;

  for (const char of line) {
    const charOctets = Buffer.byteLength(char, "utf8");
    const limit = continuation ? MAX_OCTETS - 1 : MAX_OCTETS; // the leading space on a continuation line counts toward its own 75
    if (lineOctets + charOctets > limit) {
      result += CRLF + " ";
      continuation = true;
      lineOctets = 1;
    }
    result += char;
    lineOctets += charOctets;
  }
  return result;
}

function formatUtc(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

function property(name: string, value: string): string {
  return foldLine(`${name}:${escapeIcsText(value)}`);
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function buildVEvent(event: IcsEventInput, dtstamp: string): string {
  const dtend = event.endsAt ?? new Date(event.startsAt.getTime() + ONE_HOUR_MS);
  const lines = [
    "BEGIN:VEVENT",
    property("UID", `${event.id}@maths.oauife.edu.ng`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${formatUtc(event.startsAt)}`,
    `DTEND:${formatUtc(dtend)}`,
    property("SUMMARY", event.title),
  ];
  if (event.venue) lines.push(property("LOCATION", event.venue));
  if (event.description) lines.push(property("DESCRIPTION", event.description));
  if (event.url) lines.push(property("URL", event.url));
  lines.push("END:VEVENT");
  return lines.join(CRLF);
}

function wrapCalendar(vevents: string[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", property("PRODID", PRODID), "CALSCALE:GREGORIAN", ...vevents, "END:VCALENDAR"];
  return lines.join(CRLF) + CRLF;
}

/** A single-event .ics file for one event's "Add to calendar" download. */
export function generateEventIcs(event: IcsEventInput): string {
  const dtstamp = formatUtc(new Date());
  return wrapCalendar([buildVEvent(event, dtstamp)]);
}

/** A multi-event .ics feed (e.g. all upcoming events) for subscribing. */
export function generateIcsFeed(events: IcsEventInput[]): string {
  const dtstamp = formatUtc(new Date());
  return wrapCalendar(events.map((e) => buildVEvent(e, dtstamp)));
}

export type IcsAllDayEventInput = {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
};

function formatDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function buildAllDayVEvent(entry: IcsAllDayEventInput, dtstamp: string): string {
  // RFC 5545: an all-day DTEND is exclusive, i.e. the day AFTER the
  // event's own last day - a one-day entry with no endDate therefore
  // gets DTEND = startDate + 1 day, not DTEND = startDate itself.
  const exclusiveEnd = addDays(entry.endDate ?? entry.startDate, 1);
  const lines = [
    "BEGIN:VEVENT",
    property("UID", `${entry.id}@maths.oauife.edu.ng`),
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${formatDateOnly(entry.startDate)}`,
    `DTEND;VALUE=DATE:${formatDateOnly(exclusiveEnd)}`,
    property("SUMMARY", entry.title),
  ];
  if (entry.description) lines.push(property("DESCRIPTION", entry.description));
  lines.push("END:VEVENT");
  return lines.join(CRLF);
}

/** A multi-event all-day .ics feed (the academic calendar) for subscribing or downloading. */
export function generateAllDayIcsFeed(entries: IcsAllDayEventInput[]): string {
  const dtstamp = formatUtc(new Date());
  return wrapCalendar(entries.map((e) => buildAllDayVEvent(e, dtstamp)));
}
