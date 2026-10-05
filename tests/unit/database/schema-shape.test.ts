import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Parses prisma/schema.prisma's text directly rather than going through
 * the generated client's dmmf (which, on this Prisma version, strips
 * attribute metadata like @id from the exported datamodel and so cannot
 * answer "does this field have @id"). This keeps the test meaningful and
 * independent of any particular Prisma client internals.
 */
const schemaSource = readFileSync(
  resolve(__dirname, "../../../prisma/schema.prisma"),
  "utf8",
);

type ParsedModel = { name: string; lines: string[] };

function parseModels(source: string): ParsedModel[] {
  const models: ParsedModel[] = [];
  const modelRegex = /model\s+(\w+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = modelRegex.exec(source)) !== null) {
    const [, name, body] = match;
    const lines = body
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("//"));
    models.push({ name, lines });
  }

  return models;
}

function fieldName(line: string): string | null {
  if (line.startsWith("@@")) return null;
  const token = line.split(/\s+/)[0];
  return token || null;
}

const models = parseModels(schemaSource);

describe("schema shape (no database required)", () => {
  it("found every expected model", () => {
    expect(models.length).toBeGreaterThanOrEqual(38);
  });

  it("has no plaintext token or password column anywhere", () => {
    const offenders: string[] = [];

    for (const model of models) {
      for (const line of model.lines) {
        const name = fieldName(line);
        if (!name) continue;
        if (
          /token$/i.test(name) ||
          /^password$/i.test(name) ||
          /plaintoken/i.test(name)
        ) {
          offenders.push(`${model.name}.${name}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("stores private manuscript files by storageKey, never by url", () => {
    const manuscriptFile = models.find((model) => model.name === "ManuscriptFile");
    expect(manuscriptFile).toBeDefined();

    const urlFields = manuscriptFile!.lines
      .map(fieldName)
      .filter((name): name is string => !!name && /url/i.test(name));
    expect(urlFields).toEqual([]);

    const hasStorageKey = manuscriptFile!.lines.some(
      (line) => fieldName(line) === "storageKey",
    );
    expect(hasStorageKey).toBe(true);
  });

  it("every model has a primary key and a createdAt column", () => {
    for (const model of models) {
      const hasPrimaryKey = model.lines.some((line) => line.includes("@id"));
      expect(hasPrimaryKey, `${model.name} has no @id field`).toBe(true);

      const hasCreatedAt = model.lines.some(
        (line) => fieldName(line) === "createdAt",
      );
      expect(hasCreatedAt, `${model.name} has no createdAt field`).toBe(true);
    }
  });
});
