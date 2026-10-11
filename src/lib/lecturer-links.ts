const ALLOWED_HOSTS = {
  scholar: ["scholar.google.com"],
  orcid: ["orcid.org"],
  researchGate: ["researchgate.net", "www.researchgate.net"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
} as const;

export type ProfileUrlField = keyof typeof ALLOWED_HOSTS;

/**
 * https only, and the hostname must exactly match (or be a listed "www."
 * variant of) one of the allowed hosts for that field - never a suffix
 * check, which "evil.example/scholar.google.com" or
 * "linkedin.com.evil.example" would otherwise slip through.
 */
export function isAllowedProfileUrl(value: string, field: ProfileUrlField): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return (ALLOWED_HOSTS[field] as readonly string[]).includes(url.hostname.toLowerCase());
}

/**
 * ORCID iDs are 16 digits (grouped 4-4-4-4, last character may be X for
 * check digit 10), validated with the ISO 7064 MOD 11-2 checksum ORCID
 * itself specifies. See https://support.orcid.org/hc/en-us/articles/360006897674
 */
export function isValidOrcid(value: string): boolean {
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(value)) return false;

  const digits = value.replace(/-/g, "");
  const base = digits.slice(0, 15);
  const checkChar = digits[15];

  let total = 0;
  for (const digit of base) {
    total = (total + Number(digit)) * 2;
  }
  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const expectedCheckChar = result === 10 ? "X" : String(result);

  return checkChar === expectedCheckChar;
}
