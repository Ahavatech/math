import { describe, expect, it } from "vitest";
import { pickAutomaticFeatured } from "../featured-lecturer";

describe("pickAutomaticFeatured", () => {
  const eligible = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("returns null for an empty list", () => {
    expect(pickAutomaticFeatured([])).toBeNull();
  });

  it("is deterministic for the same day and list", () => {
    const date = new Date("2026-03-05T10:00:00Z");
    const first = pickAutomaticFeatured(eligible, date);
    const second = pickAutomaticFeatured(eligible, new Date("2026-03-05T23:59:00Z"));
    expect(first).toEqual(second);
  });

  it("can change pick on a different day", () => {
    const picks = new Set<string>();
    for (let i = 0; i < eligible.length; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i));
      picks.add(pickAutomaticFeatured(eligible, date)!.id);
    }
    expect(picks.size).toBeGreaterThan(1);
  });

  it("returns the only item when the list has one eligible lecturer", () => {
    expect(pickAutomaticFeatured([{ id: "solo" }])?.id).toBe("solo");
  });
});
