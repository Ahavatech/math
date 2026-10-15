import { describe, expect, it } from "vitest";
import { levelSlugToEnum, enumToLevelSlug } from "../programme-level";

describe("levelSlugToEnum", () => {
  it("maps known slugs to the enum", () => {
    expect(levelSlugToEnum("bsc")).toBe("BSC");
    expect(levelSlugToEnum("msc")).toBe("MSC");
    expect(levelSlugToEnum("phd")).toBe("PHD");
  });

  it("returns null for anything else", () => {
    expect(levelSlugToEnum("bachelors")).toBeNull();
    expect(levelSlugToEnum("")).toBeNull();
    expect(levelSlugToEnum("BSC")).toBeNull();
  });
});

describe("enumToLevelSlug", () => {
  it("maps the enum back to its public slug", () => {
    expect(enumToLevelSlug("BSC")).toBe("bsc");
    expect(enumToLevelSlug("MSC")).toBe("msc");
    expect(enumToLevelSlug("PHD")).toBe("phd");
  });
});
