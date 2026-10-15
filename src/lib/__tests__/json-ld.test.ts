import { describe, expect, it } from "vitest";
import { safeJsonLdString } from "../json-ld";

describe("safeJsonLdString", () => {
  it("escapes < so a title cannot break out of the surrounding <script> tag", () => {
    const malicious = { name: '</script><script>alert(1)</script>' };
    const result = safeJsonLdString(malicious);
    expect(result).not.toContain("</script>");
    expect(result).toContain("\\u003c");
  });

  it("still parses back to the original value", () => {
    const data = { name: "A, B; C <D>", year: 2026 };
    expect(JSON.parse(safeJsonLdString(data))).toEqual(data);
  });
});
