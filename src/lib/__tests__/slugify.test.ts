import { describe, expect, it } from "vitest";
import { slugify, generateUniqueSlug } from "../slugify";

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Graph Theory and Combinatorics")).toBe("graph-theory-and-combinatorics");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("Algebra & Number Theory!")).toBe("algebra-number-theory");
  });

  it("collapses repeated separators and trims leading/trailing hyphens", () => {
    expect(slugify("  Fluid   Mechanics -- 101  ")).toBe("fluid-mechanics-101");
  });
});

describe("generateUniqueSlug", () => {
  it("returns the plain slug when it does not exist", async () => {
    const slug = await generateUniqueSlug("Topology and Geometry", async () => false);
    expect(slug).toBe("topology-and-geometry");
  });

  it("appends -2 when the base slug already exists", async () => {
    const taken = new Set(["topology-and-geometry"]);
    const slug = await generateUniqueSlug("Topology and Geometry", async (s) => taken.has(s));
    expect(slug).toBe("topology-and-geometry-2");
  });

  it("keeps incrementing until a free slug is found", async () => {
    const taken = new Set(["topology-and-geometry", "topology-and-geometry-2", "topology-and-geometry-3"]);
    const slug = await generateUniqueSlug("Topology and Geometry", async (s) => taken.has(s));
    expect(slug).toBe("topology-and-geometry-4");
  });
});
