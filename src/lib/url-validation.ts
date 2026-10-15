/**
 * Shared https-only URL check, reused anywhere a free-form external link
 * field needs validating (registration/slides/recording links, and so
 * on). Explicitly rejects javascript: and data: URLs by only ever
 * accepting the literal "https:" protocol - there is no allowlist to
 * bypass, since nothing else is ever accepted.
 */
export function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
