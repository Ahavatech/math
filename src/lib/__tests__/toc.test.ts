import { describe, expect, it } from "vitest";
import { extractTableOfContents, addHeadingIds } from "../toc";

describe("extractTableOfContents", () => {
  it("extracts h2 and h3 headings with generated ids", () => {
    const html = "<h2>Overview</h2><p>Text</p><h3>Details</h3><h2>Next section</h2>";
    const toc = extractTableOfContents(html);
    expect(toc).toEqual([
      { id: "overview", level: 2, text: "Overview" },
      { id: "details", level: 3, text: "Details" },
      { id: "next-section", level: 2, text: "Next section" },
    ]);
  });

  it("returns an empty list when there are no headings", () => {
    expect(extractTableOfContents("<p>Just a paragraph</p>")).toEqual([]);
  });

  it("de-duplicates repeated heading text with a numeric suffix", () => {
    const html = "<h2>Overview</h2><h2>Overview</h2>";
    const toc = extractTableOfContents(html);
    expect(toc[0].id).toBe("overview");
    expect(toc[1].id).toBe("overview-2");
  });
});

describe("addHeadingIds", () => {
  it("injects matching id attributes into the h2/h3 tags themselves", () => {
    const html = "<h2>Overview</h2><p>Text</p>";
    const result = addHeadingIds(html);
    expect(result).toContain('<h2 id="overview">Overview</h2>');
  });
});
