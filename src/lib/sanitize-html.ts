import sanitizeHtml from "sanitize-html";
import katex from "katex";

/**
 * Strict allowlist for admin-authored rich text (page bodies, HOD
 * welcome address, news/article content). Applied on save AND on
 * render (CLAUDE.md: "Sanitise rich text before rendering") so a
 * historical row written before a rule tightened, or a direct DB edit,
 * can never reach a visitor unsanitised either.
 */
const ALLOWED_TAGS = [
  "h2",
  "h3",
  "p",
  "strong",
  "em",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "a",
  "blockquote",
  "img",
  "span",
  "br",
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  // data-latex/data-display carry the Math node's source for the Math
  // component to render server-side; see docs/DECISIONS.md.
  span: ["data-latex", "data-display"],
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
    },
  });
}

const MATH_SPAN = /<span data-latex="([^"]*)"(?: data-display="(true|false)")?>[^<]*<\/span>/g;

function unescapeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Replaces every `<span data-latex="...">` written by the rich text
 * editor's math node with KaTeX's own rendered markup, so a visitor
 * sees typeset math instead of raw LaTeX source. Matches only the
 * span shape sanitizeRichText itself produces (double-quoted
 * attributes, no nested tags), so this must run after sanitizeRichText,
 * never before.
 */
function renderMathSpans(html: string): string {
  return html.replace(MATH_SPAN, (match, latex: string, display: string | undefined) => {
    const source = unescapeHtmlEntities(latex);
    try {
      return katex.renderToString(source, {
        displayMode: display === "true",
        throwOnError: false,
        trust: false,
        strict: "warn",
      });
    } catch {
      return match;
    }
  });
}

/** Sanitizes stored rich text and renders its math spans, for any public render path. */
export function renderRichText(html: string): string {
  return renderMathSpans(sanitizeRichText(html));
}
