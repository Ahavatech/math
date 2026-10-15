import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression test for the bug fixed in Stage 10 (AUDIT.md Entry 021):
 * katex/dist/katex.min.css was imported only by a component nothing
 * outside the dev-only /design-preview page ever rendered, so every
 * real page's server-rendered math (renderRichText's renderMathSpans)
 * never loaded the stylesheet that hides KaTeX's MathML accessibility
 * layer - math rendered twice on every real page. The fix moved the
 * import to globals.css, imported once by the root layout for every
 * route. This test fails if either link is ever removed again.
 */
describe("KaTeX stylesheet is wired into every page, not just a dev preview", () => {
  const root = path.resolve(__dirname, "../../..");

  it("globals.css imports katex's stylesheet", () => {
    const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
    expect(css).toMatch(/@import\s+["']katex\/dist\/katex\.min\.css["']/);
  });

  it("the root layout imports globals.css, so every route gets it", () => {
    const layout = readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
    expect(layout).toMatch(/import\s+["']\.\/globals\.css["']/);
  });
});
