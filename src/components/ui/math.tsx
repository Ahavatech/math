import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Server-renders LaTeX to HTML via KaTeX's renderToString. `trust:
 * false` (the default, set explicitly here) disables \href, \includegraphics
 * and similar commands that could otherwise embed a javascript: URL or
 * external resource from untrusted input — see docs/DECISIONS.md. The
 * resulting HTML is KaTeX's own structured markup (spans/MathML), which
 * is the documented safe way to use KaTeX server-side; it is not raw
 * passthrough of the input string.
 */
export function Math({
  children,
  display = false,
}: {
  children: string;
  display?: boolean;
}) {
  const html = katex.renderToString(children, {
    displayMode: display,
    throwOnError: false,
    trust: false,
    strict: "warn",
  });

  return (
    <span
      className={display ? "my-4 block overflow-x-auto" : "inline"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
