import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../../src/app/globals.css"), "utf8");

/** Parses the :root { ... } block's hex custom properties into a map. */
function parseRootTokens(source: string): Record<string, string> {
  const rootMatch = source.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) throw new Error(":root block not found in globals.css");

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

describe("WCAG AA contrast of design tokens", () => {
  it("parsed at least the expected core tokens from globals.css", () => {
    for (const key of ["background", "foreground", "primary", "accent", "destructive"]) {
      expect(tokens[key], `token --${key} not found`).toBeDefined();
    }
  });

  for (const pair of TEXT_PAIRS) {
    it(`${pair.name} meets ${pair.minRatio}:1`, () => {
      const fgHex = tokens[pair.fg];
      const bgHex = tokens[pair.bg];
      expect(fgHex, `--${pair.fg} not found`).toBeDefined();
      expect(bgHex, `--${pair.bg} not found`).toBeDefined();

      const ratio = contrastRatio(fgHex, bgHex);
      expect(ratio).toBeGreaterThanOrEqual(pair.minRatio);
    });
  }
});
