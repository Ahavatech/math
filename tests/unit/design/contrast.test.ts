import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../src/app/globals.css"), "utf8");

/** Parses the first (light) :root { ... } block's hex custom properties into a map. */
function parseRootTokens(source: string, scheme: "light" | "dark" = "light"): Record<string, string> {
  const rootMatch =
    scheme === "light"
      ? source.match(/:root\s*\{([^}]*)\}/)
      : source.match(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);
  if (!rootMatch) throw new Error(`${scheme} :root block not found in globals.css`);

  const tokens: Record<string, string> = {};
  const lineRegex = /--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = lineRegex.exec(rootMatch[1])) !== null) {
    tokens[match[1]] = match[2];
  }
  return tokens;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [channel(r), channel(g), channel(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

const tokens = parseRootTokens(css);

// Text-on-background pairs that actually render text in the app, with
// the WCAG AA threshold each pair must clear (4.5:1 for body text,
// 3:1 for large text / non-text UI components).
const TEXT_PAIRS: Array<{ name: string; fg: string; bg: string; minRatio: number }> = [
  { name: "foreground on background", fg: "foreground", bg: "background", minRatio: 4.5 },
  { name: "muted-foreground on background", fg: "muted-foreground", bg: "background", minRatio: 4.5 },
  { name: "card-foreground on card", fg: "card-foreground", bg: "card", minRatio: 4.5 },
  { name: "primary-foreground on primary", fg: "primary-foreground", bg: "primary", minRatio: 4.5 },
  { name: "accent-foreground on accent", fg: "accent-foreground", bg: "accent", minRatio: 4.5 },
  {
    name: "destructive-foreground on destructive",
    fg: "destructive-foreground",
    bg: "destructive",
    minRatio: 4.5,
  },
  { name: "primary on background (links)", fg: "primary", bg: "background", minRatio: 4.5 },
  { name: "secondary-foreground on secondary", fg: "secondary-foreground", bg: "secondary", minRatio: 4.5 },
];

const darkTokens = parseRootTokens(css, "dark");

// Pairs that exist only because of the admin chrome and borders.
const EXTRA_PAIRS: Array<{ name: string; fg: string; bg: string; minRatio: number }> = [
  { name: "chrome-foreground on chrome (admin sidebar)", fg: "chrome-foreground", bg: "chrome", minRatio: 4.5 },
  { name: "accent on background (dates, active nav)", fg: "accent", bg: "background", minRatio: 4.5 },
  { name: "destructive on background (errors)", fg: "destructive", bg: "background", minRatio: 4.5 },
  { name: "accent on card", fg: "accent", bg: "card", minRatio: 4.5 },
  { name: "muted-foreground on card", fg: "muted-foreground", bg: "card", minRatio: 4.5 },
  { name: "muted-foreground on muted", fg: "muted-foreground", bg: "muted", minRatio: 4.5 },
  // Field borders are non-text UI and need 3:1 against the page.
  { name: "input border on background", fg: "input", bg: "background", minRatio: 3 },
];

describe.each([
  ["light", tokens],
  ["dark", darkTokens],
] as const)("WCAG AA contrast of design tokens (%s)", (scheme, set) => {
  it("parsed at least the expected core tokens from globals.css", () => {
    for (const key of ["background", "foreground", "primary", "accent", "destructive", "chrome"]) {
      expect(set[key], `token --${key} not found`).toBeDefined();
    }
  });

  it("defines every token the light scheme defines, so nothing falls back to light in dark", () => {
    if (scheme === "light") return;
    const missing = Object.keys(tokens).filter((key) => !(key in darkTokens) && !key.startsWith("chart-"));
    // Tokens that are deliberately shared between schemes.
    const shared = new Set(["radius", "radius-group", "radius-sheet", "gutter", "sheet-width"]);
    expect(missing.filter((key) => !shared.has(key))).toEqual([]);
  });

  for (const pair of [...TEXT_PAIRS, ...EXTRA_PAIRS]) {
    it(`${pair.name} meets ${pair.minRatio}:1`, () => {
      const fgHex = set[pair.fg];
      const bgHex = set[pair.bg];
      expect(fgHex, `--${pair.fg} not found`).toBeDefined();
      expect(bgHex, `--${pair.bg} not found`).toBeDefined();

      const ratio = contrastRatio(fgHex, bgHex);
      expect(ratio).toBeGreaterThanOrEqual(pair.minRatio);
    });
  }
});

describe("the Dark choice in the toggle", () => {
  it("uses exactly the same colours as a dark device", () => {
    const forced = css.match(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
    expect(forced, "no :root[data-theme=dark] block").not.toBeNull();
    const forcedTokens: Record<string, string> = {};
    for (const m of forced![1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) forcedTokens[m[1]] = m[2];
    expect(forcedTokens).toEqual(darkTokens);
  });
});
