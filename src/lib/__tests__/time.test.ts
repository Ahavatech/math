import { describe, expect, it } from "vitest";
import {
  WAT_OFFSET_MINUTES,
  toWATDate,
  endOfDayWAT,
  isUpcoming,
  formatWAT,
  formatDateWAT,
  validateEventTimes,
  watLocalInputToUtc,
  utcToWatLocalInput,
} from "../time";

describe("WAT offset", () => {
  it("is a fixed UTC+1, no daylight saving", () => {
    expect(WAT_OFFSET_MINUTES).toBe(60);
  });
});

describe("toWATDate", () => {
  it("shifts a UTC instant forward by one hour", () => {
    const utc = new Date("2026-07-08T10:00:00.000Z");
    const wat = toWATDate(utc);
    expect(wat.getUTCHours()).toBe(11);
  });
});

describe("endOfDayWAT", () => {
  it("returns 22:59:59.999 UTC for a WAT midday instant (23:59:59.999 WAT)", () => {
    const noonWat = new Date("2026-07-08T11:00:00.000Z"); // 12:00 WAT
    const end = endOfDayWAT(noonWat);
    expect(end.toISOString()).toBe("2026-07-08T22:59:59.999Z");
  });

  it("handles an instant just after WAT midnight correctly (stays on the same WAT day)", () => {
    // 2026-07-09T00:30 WAT == 2026-07-08T23:30 UTC
    const justAfterMidnightWat = new Date("2026-07-08T23:30:00.000Z");
    const end = endOfDayWAT(justAfterMidnightWat);
    // should be end of 2026-07-09 WAT, i.e. 2026-07-09T22:59:59.999Z
    expect(end.toISOString()).toBe("2026-07-09T22:59:59.999Z");
  });
});

describe("isUpcoming", () => {
  it("is upcoming when endsAt is in the future", () => {
    const now = new Date("2026-07-08T09:00:00.000Z");
    expect(isUpcoming({ startsAt: new Date("2026-07-08T10:00:00.000Z"), endsAt: new Date("2026-07-08T12:00:00.000Z") }, now)).toBe(true);
  });

  it("is past when endsAt is in the past", () => {
    const now = new Date("2026-07-08T13:00:00.000Z");
    expect(isUpcoming({ startsAt: new Date("2026-07-08T10:00:00.000Z"), endsAt: new Date("2026-07-08T12:00:00.000Z") }, now)).toBe(false);
  });

  it("with no endsAt, is upcoming until the end of the start day in WAT", () => {
    // starts 2026-07-08T10:00 UTC (11:00 WAT); end of that WAT day is 2026-07-08T22:59:59.999Z
    const event = { startsAt: new Date("2026-07-08T10:00:00.000Z"), endsAt: null };
    expect(isUpcoming(event, new Date("2026-07-08T22:59:59.000Z"))).toBe(true);
    expect(isUpcoming(event, new Date("2026-07-08T23:00:00.001Z"))).toBe(false);
  });

  it("boundary: exactly at endsAt is still upcoming (not yet past)", () => {
    const endsAt = new Date("2026-07-08T12:00:00.000Z");
    expect(isUpcoming({ startsAt: new Date("2026-07-08T10:00:00.000Z"), endsAt }, endsAt)).toBe(true);
  });

  it("boundary: one millisecond after endsAt is past", () => {
    const endsAt = new Date("2026-07-08T12:00:00.000Z");
    const justAfter = new Date(endsAt.getTime() + 1);
    expect(isUpcoming({ startsAt: new Date("2026-07-08T10:00:00.000Z"), endsAt }, justAfter)).toBe(false);
  });
});

describe("validateEventTimes", () => {
  it("rejects endsAt equal to startsAt", () => {
    const t = new Date("2026-07-08T10:00:00.000Z");
    expect(validateEventTimes(t, t)).not.toBeNull();
  });

  it("rejects endsAt before startsAt", () => {
    const start = new Date("2026-07-08T12:00:00.000Z");
    const end = new Date("2026-07-08T10:00:00.000Z");
    expect(validateEventTimes(start, end)).not.toBeNull();
  });

  it("accepts endsAt after startsAt", () => {
    const start = new Date("2026-07-08T10:00:00.000Z");
    const end = new Date("2026-07-08T12:00:00.000Z");
    expect(validateEventTimes(start, end)).toBeNull();
  });

  it("accepts a null endsAt", () => {
    expect(validateEventTimes(new Date(), null)).toBeNull();
  });
});

describe("formatWAT", () => {
  it("appends WAT to the formatted output", () => {
    const formatted = formatWAT(new Date("2026-07-08T10:00:00.000Z"));
    expect(formatted).toMatch(/WAT$/);
  });

  it("reflects the WAT-shifted hour, not the raw UTC hour", () => {
    const formatted = formatWAT(new Date("2026-07-08T10:00:00.000Z"), { hour: "2-digit", minute: "2-digit", hour12: false });
    expect(formatted).toContain("11:00");
  });
});

describe("formatDateWAT", () => {
  it("does not append a WAT suffix (no time-of-day is shown)", () => {
    expect(formatDateWAT(new Date("2026-07-08T10:00:00.000Z"))).not.toMatch(/WAT/);
  });

  it("reflects the WAT calendar day, which can differ from the UTC day near midnight", () => {
    // 2026-07-08T23:30 UTC is 2026-07-09T00:30 WAT
    const result = formatDateWAT(new Date("2026-07-08T23:30:00.000Z"));
    expect(result).toContain("9 July 2026");
  });
});

describe("watLocalInputToUtc / utcToWatLocalInput round-trip", () => {
  it("converts a WAT local datetime-local string to the correct UTC instant", () => {
    const utc = watLocalInputToUtc("2026-07-08T11:00");
    expect(utc.toISOString()).toBe("2026-07-08T10:00:00.000Z");
  });

  it("round-trips a UTC instant back to the same WAT local input string", () => {
    const utc = new Date("2026-07-08T10:00:00.000Z");
    expect(utcToWatLocalInput(utc)).toBe("2026-07-08T11:00");
  });
});
