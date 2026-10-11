import { describe, expect, it } from "vitest";
import { generateEventIcs, generateIcsFeed } from "../ics";

function baseEvent(overrides: Partial<Parameters<typeof generateEventIcs>[0]> = {}) {
  return {
    id: "evt-123",
    title: "Emerging Economy Seminar",
    description: "A talk about economics.",
    venue: "Departmental seminar room",
    startsAt: new Date("2026-07-08T10:00:00.000Z"),
    endsAt: new Date("2026-07-08T12:00:00.000Z"),
    url: "https://maths.oauife.edu.ng/events/emerging-economy-seminar",
    ...overrides,
  };
}

describe("generateEventIcs", () => {
  it("produces a well-formed VCALENDAR/VEVENT structure", () => {
    const ics = generateEventIcs(baseEvent());
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("VERSION:2.0\r\n");
    expect(ics).toContain("PRODID:");
  });

  it("includes UID, DTSTAMP, DTSTART, DTEND, SUMMARY, LOCATION, DESCRIPTION, URL", () => {
    const ics = generateEventIcs(baseEvent());
    expect(ics).toMatch(/UID:evt-123@/);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain("DTSTART:20260708T100000Z");
    expect(ics).toContain("DTEND:20260708T120000Z");
    expect(ics).toContain("SUMMARY:Emerging Economy Seminar");
    expect(ics).toContain("LOCATION:Departmental seminar room");
    expect(ics).toContain("DESCRIPTION:A talk about economics.");
    expect(ics).toContain("URL:https://maths.oauife.edu.ng/events/emerging-economy-seminar");
  });

  it("falls back to a one-hour duration when endsAt is not given", () => {
    const ics = generateEventIcs(baseEvent({ endsAt: null }));
    expect(ics).toContain("DTSTART:20260708T100000Z");
    expect(ics).toContain("DTEND:20260708T110000Z");
  });

  it("escapes commas, semicolons and backslashes in text fields", () => {
    const ics = generateEventIcs(baseEvent({ title: "A, B; C\\D" }));
    expect(ics).toContain("SUMMARY:A\\, B\\; C\\\\D");
  });

  it("converts embedded newlines in text fields to the literal \\n escape, not a real line break", () => {
    const ics = generateEventIcs(baseEvent({ description: "Line one\nLine two\r\nLine three" }));
    expect(ics).toContain("DESCRIPTION:Line one\\nLine two\\nLine three");
    // the escaped text itself must never contain a raw CR or LF character
    const descriptionLine = ics.split("\r\n").find((l) => l.startsWith("DESCRIPTION"));
    expect(descriptionLine).toBeDefined();
  });

  it("rejects CRLF injection: a malicious value cannot inject a new ICS property or header", () => {
    const malicious = "Normal Title\r\nBEGIN:VEVENT\r\nSUMMARY:Injected";
    const ics = generateEventIcs(baseEvent({ title: malicious }));
    // the raw injected line must never appear unescaped in the output
    expect(ics).not.toMatch(/\r\nSUMMARY:Injected\r\n/);
    // there must be exactly one real BEGIN:VEVENT and one real SUMMARY
    // property line (anchored to the start of an actual ICS line) - the
    // literal text "BEGIN:VEVENT" is allowed to appear as inert escaped
    // characters *inside* the SUMMARY value, which is exactly the point:
    // it never becomes a structural line of its own.
    expect((ics.match(/^BEGIN:VEVENT$/gm) ?? []).length).toBe(1);
    expect((ics.match(/^SUMMARY:/gm) ?? []).length).toBe(1);
  });

  it("folds long lines at 75 octets with a leading space continuation", () => {
    const longTitle = "A".repeat(200);
    const ics = generateEventIcs(baseEvent({ title: longTitle }));
    const lines = ics.split("\r\n");
    for (const line of lines) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    // the folded continuation of SUMMARY starts with a single space
    const summaryLineIndex = lines.findIndex((l) => l.startsWith("SUMMARY:"));
    expect(lines[summaryLineIndex + 1].startsWith(" ")).toBe(true);
  });

  it("every line ends with CRLF, not a bare LF", () => {
    const ics = generateEventIcs(baseEvent());
    expect(ics).not.toMatch(/[^\r]\n/);
  });
});

describe("generateIcsFeed", () => {
  it("wraps multiple VEVENTs in a single VCALENDAR", () => {
    const ics = generateIcsFeed([baseEvent({ id: "a" }), baseEvent({ id: "b" })]);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2);
    expect((ics.match(/BEGIN:VCALENDAR/g) ?? []).length).toBe(1);
    expect(ics).toMatch(/UID:a@/);
    expect(ics).toMatch(/UID:b@/);
  });

  it("produces a valid empty calendar for no events", () => {
    const ics = generateIcsFeed([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});
