import { createHash } from "node:crypto";

/**
 * Has this password appeared in a known data breach? Uses the "Pwned
 * Passwords" range service (haveibeenpwned.com) in the way it is designed to
 * be used privately (k-anonymity): only the first five characters of the
 * password's SHA-1 hash are sent, the service replies with every hash that
 * starts the same way, and the comparison happens here. The password, and
 * its full hash, never leave this server.
 *
 * It fails open. If the service is slow, down or unreachable the answer is
 * `null` (unknown) and the password is accepted, so a third party's outage can
 * never stop anyone changing a password.
 */
export const BREACH_SERVICE_URL = "https://api.pwnedpasswords.com/range/";

export type BreachResult = { breached: boolean; count: number } | null;

export async function checkBreachedPassword(
  password: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<BreachResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 2500);
  try {
    const response = await fetchImpl(`${BREACH_SERVICE_URL}${prefix}`, {
      headers: {
        // Asks the service to pad its answer with decoys, so the size of the
        // reply does not hint at which range was asked for.
        "Add-Padding": "true",
        "User-Agent": "oau-maths-site-password-check",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = await response.text();
    for (const line of body.split(/\r?\n/)) {
      const [hash, count] = line.trim().split(":");
      if (hash === suffix) {
        const n = Number(count);
        // Padding entries are reported with a count of 0 and do not count.
        return n > 0 ? { breached: true, count: n } : { breached: false, count: 0 };
      }
    }
    return { breached: false, count: 0 };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
