export interface CitationInput {
  title: string;
  authors: string[];
  year: number;
  journalName: string;
  volume?: number | null;
  issue?: number | null;
  pageStart?: number | null;
  pageEnd?: number | null;
  doi?: string | null;
  slug: string;
}

/** Strips CR/LF (and other control characters) so a field can never inject a new record/line. */
function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u0009\u000B-\u001F]/g, "").replace(/[\r\n]/g, " ").trim();
}

function splitName(fullName: string): { surname: string; given: string; initials: string } {
  const tokens = fullName.trim().split(/\s+/);
  const surname = tokens.pop() ?? fullName;
  const given = tokens.join(" ");
  const initials = tokens.map((t) => `${t.charAt(0).toUpperCase()}.`).join(" ");
  return { surname, given, initials };
}

function sentenceCase(title: string): string {
  if (!title) return title;
  return title.charAt(0).toUpperCase() + title.slice(1).toLowerCase();
}

function joinApaAuthors(authors: string[]): string {
  const entries = authors.map((name) => {
    const { surname, initials } = splitName(name);
    return initials ? `${surname}, ${initials}` : surname;
  });
  if (entries.length === 1) return entries[0];
  if (entries.length === 2) return `${entries[0]}, & ${entries[1]}`;
  return `${entries.slice(0, -1).join(", ")}, & ${entries[entries.length - 1]}`;
}

export function formatApaCitation(input: CitationInput): string {
  const authorsPart = joinApaAuthors(input.authors);
  let main = `${authorsPart} (${input.year}). ${sentenceCase(input.title)}. ${input.journalName}`;

  let tail = "";
  if (input.volume) {
    tail += `, ${input.volume}`;
    if (input.issue) tail += `(${input.issue})`;
  }
  if (input.pageStart) {
    tail += `, ${input.pageStart}-${input.pageEnd ?? input.pageStart}`;
  }
  main += tail;

  if (input.doi) {
    main += `. https://doi.org/${input.doi}`;
  } else {
    main += ".";
  }

  return main;
}

/** Escapes BibTeX's special characters, never $ or ^ (math delimiters are preserved as-is). */
function escapeBibTex(value: string): string {
  return stripControlChars(value).replace(/[%&_{}]/g, "\\$&");
}

export function formatBibTex(input: CitationInput): string {
  const lines: string[] = [`@article{${input.slug},`];

  lines.push(`  title = {${escapeBibTex(input.title)}},`);
  const authorField = input.authors
    .map((name) => {
      const { surname, given } = splitName(name);
      return escapeBibTex(given ? `${surname}, ${given}` : surname);
    })
    .join(" and ");
  lines.push(`  author = {${authorField}},`);
  lines.push(`  year = {${input.year}},`);
  lines.push(`  journal = {${escapeBibTex(input.journalName)}},`);
  if (input.volume) lines.push(`  volume = {${input.volume}},`);
  if (input.issue) lines.push(`  number = {${input.issue}},`);
  if (input.pageStart) {
    lines.push(`  pages = {${input.pageStart}--${input.pageEnd ?? input.pageStart}},`);
  }
  if (input.doi) lines.push(`  doi = {${escapeBibTex(input.doi)}}`);

  // Drop a trailing comma on the last field line, then close the entry.
  const last = lines[lines.length - 1];
  if (last.endsWith(",")) lines[lines.length - 1] = last.slice(0, -1);
  lines.push("}");

  return lines.join("\n");
}

function risLine(code: string, value: string): string {
  return `${code}  - ${stripControlChars(value)}`;
}

export function formatRis(input: CitationInput): string {
  const lines: string[] = [risLine("TY", "JOUR")];
  lines.push(risLine("TI", input.title));
  for (const name of input.authors) {
    const { surname, given } = splitName(name);
    lines.push(risLine("AU", given ? `${surname}, ${given}` : surname));
  }
  lines.push(risLine("PY", String(input.year)));
  lines.push(risLine("JO", input.journalName));
  if (input.volume) lines.push(risLine("VL", String(input.volume)));
  if (input.issue) lines.push(risLine("IS", String(input.issue)));
  if (input.pageStart) lines.push(risLine("SP", String(input.pageStart)));
  if (input.pageEnd) lines.push(risLine("EP", String(input.pageEnd)));
  if (input.doi) lines.push(risLine("DO", input.doi));
  lines.push("ER  - ");

  return lines.join("\r\n") + "\r\n";
}
