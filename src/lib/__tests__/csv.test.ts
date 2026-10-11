import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated file with a header row", () => {
    const rows = parseCsv("a,b,c\n1,2,3\n4,5,6");
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  it("handles quoted fields containing a comma", () => {
    const rows = parseCsv('name,note\n"Doe, Jane",ok');
    expect(rows).toEqual([
      ["name", "note"],
      ["Doe, Jane", "ok"],
    ]);
  });

  it("handles an escaped quote inside a quoted field", () => {
    const rows = parseCsv('name\n"Jane ""JJ"" Doe"');
    expect(rows).toEqual([["name"], ['Jane "JJ" Doe']]);
  });

  it("trims a trailing newline and ignores fully blank lines", () => {
    const rows = parseCsv("a,b\n1,2\n\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
