/**
 * Where a signed-in user may be sent back to after logging in. The return
 * address arrives in a URL anyone can craft, so it is accepted only if it is
 * a plain path on this site inside one of the areas that require sign-in.
 * Everything else (other hosts, protocol-relative addresses, backslashes,
 * control characters, paths outside these areas) is refused.
 */
const ALLOWED_PREFIXES = ["/admin", "/two-factor", "/journal/dashboard", "/journal/reviewer", "/journal/submit"];
const PLACEHOLDER_ORIGIN = "http://placeholder.invalid";

export function safeCallbackPath(value: unknown): string | null {
  if (typeof value !== "string" || value === "" || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;

  const path = url.pathname;
  const allowed = ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  return allowed ? path + url.search : null;
}
