import { describe, expect, it } from "vitest";
import { sanitizeRichText, renderRichText } from "../sanitize-html";

describe("sanitizeRichText", () => {
  it("keeps allowlisted structure and formatting", () => {
    const input =
      "<h2>Heading</h2><p>Some <strong>bold</strong> and <em>italic</em> text.</p>" +
      "<ul><li>One</li><li>Two</li></ul><blockquote>A quote</blockquote>";
    const output = sanitizeRichText(input);
    expect(output).toContain("<h2>Heading</h2>");
    expect(output).toContain("<strong>bold</strong>");
    expect(output).toContain("<li>One</li>");
    expect(output).toContain("<blockquote>A quote</blockquote>");
  });

  it("keeps a safe link with href", () => {
    const output = sanitizeRichText('<p><a href="https://example.com">link</a></p>');
    expect(output).toContain('href="https://example.com"');
  });

  it("keeps an image with alt text", () => {
    const output = sanitizeRichText(
      '<img src="https://res.cloudinary.com/x/image/upload/y.jpg" alt="A description">',
    );
    expect(output).toContain("src=");
    expect(output).toContain('alt="A description"');
  });

  it("keeps the math span with data-latex", () => {
    const output = sanitizeRichText('<span data-latex="x^2" data-display="false">x^2</span>');
    expect(output).toContain("data-latex=");
  });

  it("strips <script> tags entirely", () => {
    const output = sanitizeRichText('<p>Hello</p><script>alert(document.cookie)</script>');
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toContain("alert(document.cookie)");
  });

  it("strips inline event handler attributes", () => {
    const output = sanitizeRichText('<p onclick="alert(1)">Click me</p>');
    expect(output).not.toMatch(/onclick/i);
  });

  it("strips a javascript: URL from an href", () => {
    const output = sanitizeRichText('<a href="javascript:alert(1)">click</a>');
    expect(output).not.toMatch(/javascript:/i);
  });

  it("strips a javascript: URL from an img src", () => {
    const output = sanitizeRichText('<img src="javascript:alert(1)" alt="x">');
    expect(output).not.toMatch(/javascript:/i);
  });

  it("strips <svg> and its contents (onload vector)", () => {
    const output = sanitizeRichText('<svg onload="alert(1)"><circle r="1"/></svg>');
    expect(output).not.toMatch(/<svg/i);
    expect(output).not.toMatch(/onload/i);
  });

  it("strips <iframe> entirely", () => {
    const output = sanitizeRichText('<iframe src="https://evil.example"></iframe>');
    expect(output).not.toMatch(/<iframe/i);
  });

  it("strips <style> tags and style attribute injection", () => {
    const output = sanitizeRichText(
      '<style>body{background:url("javascript:alert(1)")}</style><p style="background:url(javascript:alert(1))">x</p>',
    );
    expect(output).not.toMatch(/<style/i);
    expect(output).not.toMatch(/style=/i);
    expect(output).not.toMatch(/javascript:/i);
  });

  it("strips a data: URL with embedded script from an href", () => {
    const output = sanitizeRichText(
      '<a href="data:text/html,<script>alert(1)</script>">click</a>',
    );
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toMatch(/data:text\/html/i);
  });

  it("strips disallowed tags (form, input, object, embed, link, meta, base)", () => {
    const output = sanitizeRichText(
      '<form><input type="text"></form><object></object><embed><link rel="x"><meta><base href="x">',
    );
    expect(output).not.toMatch(/<form|<input|<object|<embed|<link|<meta|<base/i);
  });

  it("is idempotent: sanitizing already-sanitized output changes nothing", () => {
    const input = "<h2>Heading</h2><p>Safe <strong>text</strong>.</p>";
    const once = sanitizeRichText(input);
    const twice = sanitizeRichText(once);
    expect(twice).toBe(once);
  });
});

describe("renderRichText", () => {
  it("renders an inline math span to KaTeX markup instead of raw LaTeX source", () => {
    const output = renderRichText(
      '<p>Some text <span data-latex="x^2 + y^2 = r^2" data-display="false">x^2 + y^2 = r^2</span></p>',
    );
    expect(output).toContain("katex");
    expect(output).not.toContain("data-latex");
  });

  it("renders a display math span in display mode", () => {
    const output = renderRichText(
      '<span data-latex="\\int_0^1 x\\,dx" data-display="true">\\int_0^1 x\\,dx</span>',
    );
    expect(output).toContain("katex-display");
  });

  it("still strips disallowed content before rendering math", () => {
    const output = renderRichText('<script>alert(1)</script><p>Safe</p>');
    expect(output).not.toMatch(/<script/i);
    expect(output).toContain("Safe");
  });

  it("does not throw on an unparsable LaTeX source", () => {
    const output = renderRichText('<span data-latex="\\notarealcommand{" data-display="false">bad</span>');
    expect(() => output).not.toThrow();
  });
});
