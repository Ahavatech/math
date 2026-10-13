import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../markdown-to-html";

describe("markdownToHtml", () => {
  it("converts headings", () => {
    expect(markdownToHtml("## Heading two")).toContain("<h2>Heading two</h2>");
    expect(markdownToHtml("### Heading three")).toContain("<h3>Heading three</h3>");
  });

  it("converts paragraphs", () => {
    expect(markdownToHtml("Just a paragraph.")).toContain("<p>Just a paragraph.</p>");
  });

  it("converts bold and italic", () => {
    expect(markdownToHtml("**bold** and *italic*")).toContain("<strong>bold</strong> and <em>italic</em>");
  });

  it("converts an unordered list", () => {
    const html = markdownToHtml("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("<li>two</li>");
  });

  it("converts an ordered list", () => {
    const html = markdownToHtml("1. first\n2. second");
    expect(html).toContain("<ol>");
    expect(html).toContain("<li>first</li>");
  });

  it("converts a link", () => {
    expect(markdownToHtml("See [the handbook](https://example.com/handbook)")).toContain(
      '<a href="https://example.com/handbook">the handbook</a>',
    );
  });

  it("converts inline math $...$ into a non-display math span", () => {
    const html = markdownToHtml("The formula $x^2 + y^2 = r^2$ is well known.");
    expect(html).toContain('<span data-latex="x^2 + y^2 = r^2" data-display="false">');
  });

  it("converts display math $$...$$ into a display math span", () => {
    const html = markdownToHtml("$$\\int_0^1 x\\,dx$$");
    expect(html).toContain('data-display="true"');
  });

  it("escapes a raw script tag in the source instead of passing it through", () => {
    const html = markdownToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes an inline event handler attempt inside a link", () => {
    const html = markdownToHtml('[click](javascript:alert(1))');
    expect(html).not.toContain("javascript:alert");
  });
});
