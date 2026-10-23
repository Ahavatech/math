/**
 * Short-lived HMAC-SHA256 confirmation tokens for the alumni post-submission
 * confirmation page. The token is never stored in the database; validity is
 * verified by recomputing the HMAC.
 *
 * Format (base64url): <32-byte nonce>.<entryId>.<expiresAt>.<hmac>
 * All segments except the HMAC are base64url-encoded; the HMAC covers the
 * joined payload string.
 */

const TTL_MS = 60 * 60 * 1000; // 1 hour

function b64u(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function fromB64u(s: string): Buffer {
  return Buffer.from(s, "base64url");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64u(new Uint8Array(sig));
}

async function verifyHmac(secret: string, data: string, sig: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  try {
    const sigBuf = fromB64u(sig);
    const dataBuf = new TextEncoder().encode(data);
    const sigAb = sigBuf.buffer as ArrayBuffer;
    return await crypto.subtle.verify("HMAC", key, sigAb.slice(sigBuf.byteOffset, sigBuf.byteOffset + sigBuf.byteLength), dataBuf);
  } catch {
    return false;
  }
}

export async function createConfirmToken(entryId: string, secret: string): Promise<string> {
  const nonce = b64u(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = String(Date.now() + TTL_MS);
  const payload = `${nonce}.${b64u(new TextEncoder().encode(entryId))}.${expiresAt}`;
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}

export async function verifyConfirmToken(
  token: string,
  secret: string,
): Promise<{ entryId: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [nonce, entryIdB64, expiresAtStr, sig] = parts;
    void nonce; // present to prevent timing shortcut
    const payload = `${nonce}.${entryIdB64}.${expiresAtStr}`;
    const valid = await verifyHmac(secret, payload, sig);
    if (!valid) return null;
    if (Date.now() > Number(expiresAtStr)) return null;
    const entryId = fromB64u(entryIdB64).toString("utf8");
    return { entryId };
  } catch {
    return null;
  }
}
