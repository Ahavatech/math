import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Colours must come from the semantic tokens so the page can flip between
 * light and dark. A component that writes white or black (or a hex colour)
 * stays that colour in the other scheme and breaks it.
 */
const SRC = resolve(__dirname, "../../../src");

// A QR code has to be dark on light to scan, whatever the scheme.
const ALLOWED = new Set(["app/(auth)/two-factor/two-factor-panel.tsx"]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "__tests__" || name === "emails" ? [] : walk(path);
    return /\.(tsx?|css)$/.test(name) ? [path] : [];
  });
}

const FORBIDDEN = [
  { pattern: /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b/, what: "a white or black utility class" },
  { pattern: /\b(?:bg|text|border)-\[#[0-9a-fA-F]{3,8}\]/, what: "an arbitrary hex colour class" },
  { pattern: /["'`]#(?:fff|ffffff|000|000000)["'`]/i, what: "a literal white or black" },
  {
    pattern: /\b(?:bg|text|border|ring|from|to|fill|stroke|divide|outline)-(?:red|green|blue|yellow|amber|orange|emerald|slate|gray|zinc|neutral|stone|lime|teal|cyan|sky|indigo|violet|purple|pink|rose)-\d{2,3}\b/,
    what: "a Tailwind palette colour (use a semantic token so it flips in dark mode)",
  },
];

describe("no hard-coded colours outside the token block", () => {
  const files = walk(SRC);

  it("scans a sensible number of files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  for (const rule of FORBIDDEN) {
    it(`no component uses ${rule.what}`, () => {
      const offenders = files
        .filter((file) => !ALLOWED.has(relative(SRC, file).replaceAll("\\", "/")))
        .filter((file) => rule.pattern.test(readFileSync(file, "utf8")))
        .map((file) => relative(SRC, file).replaceAll("\\", "/"));
      expect(offenders).toEqual([]);
    });
  }

  it("globals.css writes hex colours only in the two token blocks", () => {
    const css = readFileSync(join(SRC, "app/globals.css"), "utf8");
    // Remove the two token blocks, then no hex colour may remain.
    const withoutTokens = css
      .replace(/:root\s*\{[^}]*\}/, "")
      .replace(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{[^}]*\}/, "")
      .replace(/:root\[data-theme="dark"\]\s*\{[^}]*\}/, "");
    const hexes = withoutTokens.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
    expect(hexes).toEqual([]);
  });
});
