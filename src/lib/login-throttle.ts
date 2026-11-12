/**
 * The client address as seen by the proxy in front of the app. Nginx
 * overwrites X-Forwarded-For with the real connecting address (see
 * deploy/nginx), so the first entry cannot be chosen by the visitor there.
 */
export function clientIpFromHeaders(headers: Pick<Headers, "get"> | null | undefined): string {
  const forwardedFor = headers?.get("x-forwarded-for");
  return forwardedFor ? forwardedFor.split(",")[0].trim() || "unknown" : "unknown";
}
