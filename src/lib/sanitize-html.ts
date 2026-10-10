import sanitizeHtml from "sanitize-html";

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
