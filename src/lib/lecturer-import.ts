import { z } from "zod";
import { parseCsv } from "./csv";
import { parseRank } from "./lecturer-rank";
import type { LecturerRank } from "@prisma/client";

const EXPECTED_HEADER = ["fullName", "honorific", "rank", "email"];
const MAX_ROWS = 200;

export type ValidImportRow = {
  row: number;
  fullName: string;
  honorific: string;
  rank: LecturerRank;
  email: string;
};

export type ImportRowError = { row: number; reason: string };

export type ImportValidationResult = {
  validRows: ValidImportRow[];
  errors: ImportRowError[];
};

const emailSchema = z.string().email();

/**
 * Pure validation for the dry-run step: no database writes. `emailExists`
 * is injected (checks both an existing User and a duplicate within this
 * same file) so this needs no live database to unit test.
 */
export async function validateLecturerImportCsv(
  csvText: string,
  deps: { emailExists: (email: string) => Promise<boolean> },
): Promise<ImportValidationResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new Error("The file is empty");
  }

  const header = rows[0].map((h) => h.trim());
  const headerMatches = EXPECTED_HEADER.every((col, i) => header[i] === col);
  if (!headerMatches) {
    throw new Error(`Expected header columns ${EXPECTED_HEADER.join(",")}, got ${header.join(",")}`);
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new Error(`The file has ${dataRows.length} rows; the maximum is ${MAX_ROWS}`);
  }

  const validRows: ValidImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seenEmailsInFile = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // 1-indexed, plus the header row
    const [fullNameRaw, honorificRaw, rankRaw, emailRaw] = dataRows[i];
    const fullName = (fullNameRaw ?? "").trim();
    const honorific = (honorificRaw ?? "").trim();
    const rankInput = (rankRaw ?? "").trim();
    const email = (emailRaw ?? "").trim().toLowerCase();

    if (!fullName) {
      errors.push({ row: rowNumber, reason: "Missing full name" });
      continue;
    }

    const emailParsed = emailSchema.safeParse(email);
    if (!emailParsed.success) {
      errors.push({ row: rowNumber, reason: `Invalid email: "${emailRaw ?? ""}"` });
      continue;
    }

    const rank = parseRank(rankInput);
    if (!rank) {
      errors.push({ row: rowNumber, reason: `Unknown or ambiguous rank: "${rankRaw ?? ""}"` });
      continue;
    }

    if (seenEmailsInFile.has(email)) {
      errors.push({ row: rowNumber, reason: `Duplicate email in file: ${email}` });
      continue;
    }

    if (await deps.emailExists(email)) {
      errors.push({ row: rowNumber, reason: `A lecturer with this email already exists: ${email}` });
      continue;
    }

    seenEmailsInFile.add(email);
    validRows.push({ row: rowNumber, fullName, honorific, rank, email });
  }

  return { validRows, errors };
}
