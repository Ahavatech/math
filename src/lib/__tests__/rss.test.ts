import { describe, expect, it } from "vitest";
import { generateNewsRss } from "../rss";

function baseItem(overrides: Partial<Parameters<typeof generateNewsRss>[0]["items"][number]> = {}) {
  return {
    title: "Emerging Economy Seminar",
    link: "https://maths.oauife.edu.ng/news/emerging-economy-seminar",
    description: "A seminar about economics.",
    publishedAt: new Date("2026-07-08T10:00:00.000Z"),
    guid: "news-1",
    ...overrides,
  };
}

describe("generateNewsRss", () => {
  it("produces a well-formed RSS 2.0 document", () => {
    const xml = generateNewsRss({ siteUrl: "https://maths.oauife.edu.ng", title: "Department News", description: "Latest news", items: [baseItem()] });
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(xml).toContain("<rss version=\"2.0\"");
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</channel>");
    expect(xml).toContain("</rss>");
    expect(xml).toContain("<item>");
    expect(xml).toContain("</item>");
  });

  it("includes title, link, description, pubDate and guid per item", () => {
    const xml = generateNewsRss({ siteUrl: "https://maths.oauife.edu.ng", title: "t", description: "d", items: [baseItem()] });
    expect(xml).toContain("<title>Emerging Economy Seminar</title>");
    expect(xml).toContain("<link>https://maths.oauife.edu.ng/news/emerging-economy-seminar</link>");
    expect(xml).toContain("<description>A seminar about economics.</description>");
    expect(xml).toMatch(/<pubDate>.+<\/pubDate>/);
    expect(xml).toContain("<guid");
  });

  it("escapes special XML characters in text fields", () => {
    const xml = generateNewsRss({
      siteUrl: "https://maths.oauife.edu.ng",
      title: "t",
      description: "d",
      items: [baseItem({ title: "A & B <script>alert(1)</script> \"quoted\" 'apos'" })],
    });
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&amp;");
    expect(xml).toContain("&lt;script&gt;");
  });

  it("produces valid output with zero items", () => {
    const xml = generateNewsRss({ siteUrl: "https://maths.oauife.edu.ng", title: "t", description: "d", items: [] });
    expect(xml).toContain("<channel>");
    expect(xml).not.toContain("<item>");
  });

  it("escapes ampersands and brackets in the channel title/description too", () => {
    const xml = generateNewsRss({ siteUrl: "https://maths.oauife.edu.ng", title: "R&D <News>", description: "d", items: [] });
    expect(xml).toContain("R&amp;D &lt;News&gt;");
  });
});
