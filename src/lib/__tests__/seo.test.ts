import { describe, expect, it } from "vitest";
import { buildPageMetadata, SITE_URL } from "../seo";
import { safeJsonLdString, buildOrganizationJsonLd, buildBreadcrumbJsonLd } from "../json-ld";

describe("buildPageMetadata", () => {
  it("includes title, description, og and twitter", () => {
    const meta = buildPageMetadata({ title: "About", description: "About the department", path: "/about" });
    expect(meta.title).toEqual({ template: "%s | Department of Mathematics, OAU", default: "About" });
    expect(meta.description).toBe("About the department");
    expect((meta.openGraph as Record<string, unknown>)?.title).toContain("About");
    expect((meta.twitter as Record<string, unknown>)?.card).toBe("summary_large_image");
  });

  it("sets canonical alternates when path is provided", () => {
    const meta = buildPageMetadata({ title: "News", description: "Dept news", path: "/news" });
    expect((meta.alternates as Record<string, unknown>)?.canonical).toBe(`${SITE_URL}/news`);
  });

  it("omits alternates when path is omitted", () => {
    const meta = buildPageMetadata({ title: "News", description: "Dept news" });
    expect(meta.alternates).toBeUndefined();
  });

  it("sets noindex robots when noindex is true", () => {
    const meta = buildPageMetadata({ title: "Search", description: "Search page", noindex: true });
    expect((meta.robots as Record<string, unknown>)?.index).toBe(false);
    expect((meta.robots as Record<string, unknown>)?.follow).toBe(false);
  });
});

describe("safeJsonLdString escaping", () => {
  it("escapes < to prevent script breakout", () => {
    const hostile = { title: '</script><script>alert(1)</script>' };
    const serialized = safeJsonLdString(hostile);
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c");
  });

  it("preserves normal content unchanged (except < escaping)", () => {
    const data = { title: "A normal title", value: 42 };
    const serialized = safeJsonLdString(data);
    expect(JSON.parse(serialized)).toEqual(data);
  });
});

describe("buildOrganizationJsonLd", () => {
  it("returns CollegeOrUniversity @type", () => {
    const ld = buildOrganizationJsonLd("https://example.com");
    expect(ld["@type"]).toContain("CollegeOrUniversity");
    expect(ld.url).toBe("https://example.com");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("builds correct ListItems", () => {
    const ld = buildBreadcrumbJsonLd(
      [{ name: "Home", url: "/" }, { name: "News", url: "/news" }],
      "https://example.com",
    );
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].item).toBe("https://example.com/news");
  });
});
