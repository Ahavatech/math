/**
 * A small, hand-written Markdown-to-HTML converter for the handbook
 * importer (scripts/handbook-import.ts), not a general-purpose
 * CommonMark implementation: the handbook's own content is plain
 * structured text (headings, paragraphs, lists, bold/italic, links,
 * inline/display math), so a full parser is more surface area than
 * the job needs - same reasoning DECISIONS.md #43 gives for writing
 * ICS/RSS by hand instead of pulling in a dependency.
 *
 * Security: every character of the input is HTML-escaped before any
 * markdown rule is applied, so a literal `<script>` in the source can
 * never become a real tag - the escaped text is what every regex
 * below operates on. A link's target is additionally checked against
 * an explicit scheme allowlist (https, http, mailto, or a relative
 * path); anything else (javascript:, data:, ...) is dropped to plain
 * text instead of becoming a clickable href. The output still passes
 * through src/lib/sanitize-html.ts's sanitizeRichText before being
 * stored, as a second, independent layer - this converter does not
 * replace that, it feeds it.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isSafeLinkTarget(url: string): boolean {
  if (url.startsWith("/") || url.startsWith("#")) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "mailto:";
  } catch {
    return false;
  }
}

function extractMathSpans(text: string): { text: string; spans: string[] } {
  const spans: string[] = [];
  const placeholder = (i: number) => `\u0000MATH${i}\u0000`;

  // Display math ($$...$$) is extracted before inline math ($...$) so a
  // display block's own $ delimiters are never mistaken for inline math.
  let working = text.replace(/\$\$([\s\S]+?)\$\$/g, (_match, latex: string) => {
    const index = spans.length;
    spans.push(`<span data-latex="${escapeHtml(latex.trim())}" data-display="true"></span>`);
    return placeholder(index);
  });

  working = working.replace(/\$([^$\n]+?)\$/g, (_match, latex: string) => {
    const index = spans.length;
    spans.push(`<span data-latex="${escapeHtml(latex.trim())}" data-display="false"></span>`);
    return placeholder(index);
  });

  return { text: working, spans };
}

function restoreMathSpans(html: string, spans: string[]): string {
  return html.replace(/\u0000MATH(\d+)\u0000/g, (_match, index: string) => spans[Number(index)] ?? "");
}

function applyInlineMarkdown(line: string): string {
  let result = line
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/(?<!_)_([^_]+)_(?!_)/g, "<em>$1</em>");

  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label: string, url: string) => {
    const decodedUrl = url.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
    if (!isSafeLinkTarget(decodedUrl)) return label;
    return `<a href="${url}">${label}</a>`;
  });

  return result;
}

export function markdownToHtml(markdown: string): string {
  const { text: withPlaceholders, spans } = extractMathSpans(escapeHtml(markdown));
  const lines = withPlaceholders.split("\n");

  const blocks: string[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      blocks.push(`<p>${applyInlineMarkdown(paragraphBuffer.join(" "))}</p>`);
      paragraphBuffer = [];
    }
  }

  function flushList() {
    if (listBuffer) {
      const items = listBuffer.items.map((item) => `<li>${applyInlineMarkdown(item)}</li>`).join("");
      blocks.push(`<${listBuffer.type}>${items}</${listBuffer.type}>`);
      listBuffer = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const h3 = line.match(/^###\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const ulItem = line.match(/^[-*]\s+(.*)$/);
    const olItem = line.match(/^\d+\.\s+(.*)$/);

    if (h3) {
      flushParagraph();
      flushList();
      blocks.push(`<h3>${applyInlineMarkdown(h3[1])}</h3>`);
    } else if (h2) {
      flushParagraph();
      flushList();
      blocks.push(`<h2>${applyInlineMarkdown(h2[1])}</h2>`);
    } else if (ulItem) {
      flushParagraph();
      if (listBuffer?.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(ulItem[1]);
    } else if (olItem) {
      flushParagraph();
      if (listBuffer?.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(olItem[1]);
    } else {
      flushList();
      paragraphBuffer.push(line);
    }
  }
  flushParagraph();
  flushList();

  return restoreMathSpans(blocks.join(""), spans);
}
