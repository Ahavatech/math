import { describe, expect, it } from "vitest";
import type { LecturerRank } from "@prisma/client";
import { sortLecturersForDirectory } from "@/lib/lecturer-directory-sort";

type Row = { id: string; rank: LecturerRank; order: number; fullName: string };

function row(id: string, rank: LecturerRank, order: number, fullName: string): Row {
  return { id, rank, order, fullName };
}

describe("sortLecturersForDirectory", () => {
  it("sorts by rank seniority first", () => {
    const rows = [
      row("1", "LECTURER_I", 0, "A Zed"),
      row("2", "PROFESSOR", 0, "B Yankee"),
      row("3", "SENIOR_LECTURER", 0, "C Xray"),
    ];
    expect(sortLecturersForDirectory(rows).map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("breaks rank ties with admin order", () => {
    const rows = [
      row("1", "PROFESSOR", 2, "A Zed"),
      row("2", "PROFESSOR", 0, "B Yankee"),
      row("3", "PROFESSOR", 1, "C Xray"),
    ];
    expect(sortLecturersForDirectory(rows).map((r) => r.id)).toEqual(["2", "3", "1"]);
  });

  it("breaks order ties with family name (last word of fullName)", () => {
    const rows = [
      row("1", "PROFESSOR", 0, "Zed Adebayo"),
      row("2", "PROFESSOR", 0, "Yankee Babatunde"),
    ];
    expect(sortLecturersForDirectory(rows).map((r) => r.id)).toEqual(["1", "2"]); // Adebayo < Babatunde
  });

  it("does not automatically put the HOD or any specific role first - order wins", () => {
    const rows = [
      row("hod", "PROFESSOR", 5, "Z HOD"),
      row("other", "PROFESSOR", 0, "A Other"),
    ];
    expect(sortLecturersForDirectory(rows).map((r) => r.id)).toEqual(["other", "hod"]);
  });
});
