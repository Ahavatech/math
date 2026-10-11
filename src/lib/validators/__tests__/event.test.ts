import { describe, expect, it } from "vitest";
import { eventInputSchema } from "../event";

function baseInput(overrides: Partial<Parameters<typeof eventInputSchema.parse>[0]> = {}) {
  return {
    title: "Test Seminar",
    type: "SEMINAR" as const,
    startsAt: new Date("2026-07-08T10:00:00.000Z"),
    endsAt: new Date("2026-07-08T12:00:00.000Z"),
    venue: "",
    speakerName: "",
    speakerAffiliation: "",
    description: "",
    flyerId: null,
    registrationUrl: "",
    slidesUrl: "",
    recordingUrl: "",
    seriesId: null,
    status: "DRAFT" as const,
    ...overrides,
  };
}

describe("eventInputSchema", () => {
  it("accepts a valid event", () => {
    expect(() => eventInputSchema.parse(baseInput())).not.toThrow();
  });

  it("accepts a null endsAt", () => {
    expect(() => eventInputSchema.parse(baseInput({ endsAt: null }))).not.toThrow();
  });

  it("rejects endsAt before startsAt", () => {
    expect(() =>
      eventInputSchema.parse(
        baseInput({ startsAt: new Date("2026-07-08T12:00:00.000Z"), endsAt: new Date("2026-07-08T10:00:00.000Z") }),
      ),
    ).toThrow();
  });

  it("rejects a non-https registration URL", () => {
    expect(() => eventInputSchema.parse(baseInput({ registrationUrl: "http://example.com" }))).toThrow();
  });

  it("rejects a javascript: slides URL", () => {
    expect(() => eventInputSchema.parse(baseInput({ slidesUrl: "javascript:alert(1)" }))).toThrow();
  });

  it("rejects a data: recording URL", () => {
    expect(() => eventInputSchema.parse(baseInput({ recordingUrl: "data:text/html,x" }))).toThrow();
  });

  it("accepts empty-string optional URLs", () => {
    expect(() =>
      eventInputSchema.parse(baseInput({ registrationUrl: "", slidesUrl: "", recordingUrl: "" })),
    ).not.toThrow();
  });
});
