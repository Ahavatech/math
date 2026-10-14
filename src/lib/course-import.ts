import { parseCsv } from "./csv";
import { normalizeCourseCode, isValidCourseCode } from "./validators/course";

const EXPECTED_HEADER = ["code", "title", "units", "level", "semester", "programme", "elective", "prerequisites", "description"];
const MAX_ROWS = 500;

export type ValidCourseImportRow = {
  row: number;
  code: string;
  title: string;
  units: number;
  level: number;
  semester: "FIRST" | "SECOND";
  programmeLevel: "BSC" | "MSC" | "PHD";
  isElective: boolean;
  prerequisiteCodes: string[];
  description: string;
};

export type CourseImportRowError = { row: number; reason: string };

export type CourseImportValidationResult = {
  validRows: ValidCourseImportRow[];
  errors: CourseImportRowError[];
};

/**
 * Pure validation for the dry-run step: no database writes.
 * `codeExists` is injected (checks an existing Course) so this needs
 * no live database to unit test. A prerequisite code is accepted if it
 * matches another row in this same file or already exists in the
 * database; a cycle entirely within the file (A needs B, B needs A) is
 * also rejected here, before anything is committed.
 */
export async function validateCourseImportCsv(
  csvText: string,
  deps: { codeExists: (code: string) => Promise<boolean> },
): Promise<CourseImportValidationResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) throw new Error("The file is empty");

  const header = rows[0].map((h) => h.trim());
  if (!EXPECTED_HEADER.every((col, i) => header[i] === col)) {
    throw new Error(`Expected header columns ${EXPECTED_HEADER.join(",")}, got ${header.join(",")}`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new Error(`The file has ${dataRows.length} rows; the maximum is ${MAX_ROWS}`);
  }

  const parsedRows: (ValidCourseImportRow | null)[] = [];
  const errors: CourseImportRowError[] = [];
  const codesInFile = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2;
    const [codeRaw, titleRaw, unitsRaw, levelRaw, semesterRaw, programmeRaw, electiveRaw, prereqRaw, descriptionRaw] = dataRows[i];

    const code = normalizeCourseCode((codeRaw ?? "").trim());
    const title = (titleRaw ?? "").trim();
    const units = Number((unitsRaw ?? "").trim());
    const level = Number((levelRaw ?? "").trim());
    const semester = (semesterRaw ?? "").trim().toUpperCase();
    const programme = (programmeRaw ?? "").trim().toUpperCase();
    const isElective = (electiveRaw ?? "").trim().toLowerCase() === "true";
    const description = (descriptionRaw ?? "").trim();
    const prerequisiteCodes = (prereqRaw ?? "")
      .split(";")
      .map((c) => normalizeCourseCode(c.trim()))
      .filter(Boolean);

    if (!isValidCourseCode(code)) {
      errors.push({ row: rowNumber, reason: `Invalid course code "${codeRaw}"` });
      parsedRows.push(null);
      continue;
    }
    if (!title) {
      errors.push({ row: rowNumber, reason: "Title is required" });
      parsedRows.push(null);
      continue;
    }
    if (!Number.isInteger(units) || units < 1 || units > 12) {
      errors.push({ row: rowNumber, reason: `Invalid units "${unitsRaw}" (must be 1-12)` });
      parsedRows.push(null);
      continue;
    }
    if (!Number.isInteger(level) || level < 100 || level > 900) {
      errors.push({ row: rowNumber, reason: `Invalid level "${levelRaw}" (must be 100-900)` });
      parsedRows.push(null);
      continue;
    }
    if (semester !== "FIRST" && semester !== "SECOND") {
      errors.push({ row: rowNumber, reason: `Invalid semester "${semesterRaw}" (must be FIRST or SECOND)` });
      parsedRows.push(null);
      continue;
    }
    if (programme !== "BSC" && programme !== "MSC" && programme !== "PHD") {
      errors.push({ row: rowNumber, reason: `Invalid programme "${programmeRaw}" (must be BSC, MSC or PHD)` });
      parsedRows.push(null);
      continue;
    }
    if (codesInFile.has(code)) {
      errors.push({ row: rowNumber, reason: `Duplicate code "${code}" within this file` });
      parsedRows.push(null);
      continue;
    }
    codesInFile.add(code);

    if (await deps.codeExists(code)) {
      errors.push({ row: rowNumber, reason: `Course "${code}" already exists and will not be overwritten` });
      parsedRows.push(null);
      continue;
    }

    parsedRows.push({
      row: rowNumber,
      code,
      title,
      units,
      level,
      semester,
      programmeLevel: programme,
      isElective,
      prerequisiteCodes,
      description,
    });
  }

  // Resolve prerequisite codes (must exist in this file or the database) and check for cycles.
  const codeToRow = new Map(parsedRows.filter((r): r is ValidCourseImportRow => r !== null).map((r) => [r.code, r]));

  for (const row of parsedRows) {
    if (!row) continue;
    for (const prereqCode of row.prerequisiteCodes) {
      if (!codeToRow.has(prereqCode) && !(await deps.codeExists(prereqCode))) {
        errors.push({ row: row.row, reason: `Unknown prerequisite code "${prereqCode}"` });
      }
    }
  }

  const cycleFreeRows: ValidCourseImportRow[] = [];
  for (const row of parsedRows) {
    if (!row) continue;
    if (hasCycleWithinFile(row.code, codeToRow)) {
      errors.push({ row: row.row, reason: `Prerequisite cycle detected involving "${row.code}"` });
      continue;
    }
    cycleFreeRows.push(row);
  }

  return { validRows: cycleFreeRows, errors };
}

function hasCycleWithinFile(startCode: string, codeToRow: Map<string, ValidCourseImportRow>): boolean {
  const visited = new Set<string>();
  function walk(code: string): boolean {
    const row = codeToRow.get(code);
    if (!row) return false;
    for (const prereq of row.prerequisiteCodes) {
      if (prereq === startCode) return true;
      if (visited.has(prereq)) continue;
      visited.add(prereq);
      if (walk(prereq)) return true;
    }
    return false;
  }
  return walk(startCode);
}
