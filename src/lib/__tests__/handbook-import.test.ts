import { describe, expect, it } from "vitest";
import { parseHandbookImportFile, planHandbookImport } from "../handbook-import";

const SAMPLE = `---
title: Admission Requirements
slug: admission-requirements
order: 1
summary: What you need to apply
---
## Overview

Here is some **bold** text and a formula $x^2$.
`;

describe("parseHandbookImportFile", () => {
  it("parses front matter and converts the body to sanitized HTML", () => {
    const parsed = parseHandbookImportFile("welcome.md", SAMPLE);
    expect(parsed.title).toBe("Admission Requirements");
    expect(parsed.slug).toBe("admission-requirements");
    expect(parsed.order).toBe(1);
    expect(parsed.summary).toBe("What you need to apply");
    expect(parsed.parent).toBeNull();
    expect(parsed.bodyHtml).toContain("<h2>Overview</h2>");
    expect(parsed.bodyHtml).toContain("<strong>bold</strong>");
    expect(parsed.bodyHtml).toContain('data-latex="x^2"');
  });

  it("renders a literal <script> tag as inert escaped text, never as a real tag", () => {
    const withScript = SAMPLE.replace("Here is some", "<script>alert(1)</script> Here is some");
    const parsed = parseHandbookImportFile("evil.md", withScript);
    expect(parsed.bodyHtml).not.toContain("<script>");
    expect(parsed.bodyHtml).toContain("&lt;script&gt;");
  });

  it("reads the parent slug from front matter when present", () => {
    const withParent = SAMPLE.replace("order: 1", "order: 1\nparent: programmes");
    const parsed = parseHandbookImportFile("child.md", withParent);
    expect(parsed.parent).toBe("programmes");
  });

  it("throws when required front matter fields are missing", () => {
    expect(() => parseHandbookImportFile("bad.md", "---\ntitle: Only Title\n---\nBody")).toThrow(/slug/i);
  });
});

describe("planHandbookImport", () => {
  async function slugExists(slug: string): Promise<boolean> {
    return slug === "already-exists";
  }

  it("plans a create for a new slug", async () => {
    const files = [parseHandbookImportFile("a.md", SAMPLE)];
    const plan = await planHandbookImport(files, { slugExists });
    expect(plan[0].action).toBe("create");
  });

  it("skips a slug that already exists, never overwriting an admin's edit", async () => {
    const existing = SAMPLE.replace("admission-requirements", "already-exists");
    const files = [parseHandbookImportFile("a.md", existing)];
    const plan = await planHandbookImport(files, { slugExists });
    const item = plan[0];
    expect(item.action).toBe("skip");
    if (item.action === "skip") expect(item.reason).toMatch(/already exists/i);
  });

  it("rejects a page nested more than two levels (a child whose parent is itself a child)", async () => {
    const parentFile = parseHandbookImportFile("parent.md", SAMPLE.replace("admission-requirements", "mid-level").replace("order: 1", "order: 1\nparent: top-level"));
    const childFile = parseHandbookImportFile("child.md", SAMPLE.replace("admission-requirements", "deep-level").replace("order: 1", "order: 1\nparent: mid-level"));
    const plan = await planHandbookImport([parentFile, childFile], {
      slugExists: async (slug) => slug === "top-level",
    });
    const childPlan = plan.find((p) => p.file.slug === "deep-level");
    expect(childPlan?.action).toBe("skip");
    if (childPlan?.action === "skip") expect(childPlan.reason).toMatch(/two levels/i);
  });
});
