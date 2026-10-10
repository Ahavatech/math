import { describe, expect, it } from "vitest";
import katex from "katex";

/**
 * Tests katex.renderToString directly (the same call Math makes) rather
 * than rendering the React component, since the property under test is
 * "what HTML string does KaTeX itself produce," independent of React.
 */
const options = { throwOnError: false, trust: false, strict: "warn" as const };

describe("Math component safety (KaTeX server render)", () => {
  it("renders plain inline math to HTML containing no script tags", () => {
    const html = katex.renderToString("x^2 + y^2 = z^2", { ...options, displayMode: false });
    expect(html).toContain("katex");
    expect(html).not.toMatch(/<script/i);
  });

  it("renders display math", () => {
    const html = katex.renderToString("\\int_0^1 x\\,dx", { ...options, displayMode: true });
    expect(html).toContain("katex-display");
  });

  it("does not produce a live javascript: link from \\href with trust:false", () => {
    const html = katex.renderToString("\\href{javascript:alert(1)}{click}", options);
    // trust:false refuses the \href macro entirely (no <a> tag at all);
    // the raw source text still appears, inert, inside KaTeX's
    // <annotation> element for accessibility/copy-paste, which is not
    // an exploitable sink. The actual property under test is: no live
    // anchor element, and the text is HTML-escaped, not a raw attribute.
    expect(html).not.toMatch(/<a\s/i);
    expect(html).not.toMatch(/href\s*=\s*["']javascript:/i);
    expect(html).not.toMatch(/<script/i);
  });

  it("does not throw on malformed LaTeX (throwOnError:false) and produces no script tag", () => {
    expect(() => katex.renderToString("\\frac{1}{", options)).not.toThrow();
    const html = katex.renderToString("\\frac{1}{", options);
    expect(html).not.toMatch(/<script/i);
  });

  it("never produces a live <img> tag or an unescaped onerror attribute from an HTML-injection payload", () => {
    const payload = '<img src=x onerror="alert(1)">';
    const html = katex.renderToString(payload, options);
    // The source text appears as inert content inside KaTeX's own
    // <mi>/<annotation> text nodes (see note above); the actual property
    // under test is that it is never parsed back into a live element.
    expect(html).not.toMatch(/<img\s/i);
    expect(html).not.toMatch(/onerror\s*=\s*["']/);
  });
});
