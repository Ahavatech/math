import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Coarse route protection only: is there a valid, unexpired session cookie.
 * Real authorisation (which role, which permission, ownership, whether the
 * account is still active) happens in the service layer on the server, never
 * here. See src/lib/rbac.ts and docs/AUTH.md.
 *
 * This deliberately reads the cookie with getToken() instead of wrapping the
 * proxy in Auth.js's auth(). The wrapper re-issues the session cookie on
 * every request it sees, which let a request that was still in flight when
 * someone pressed Sign out put the cookie straight back, so the person stayed
 * signed in. Reading without re-issuing means only signing in ever sets the
 * session cookie, and signing out cannot be undone by a late request.
 */
export default async function proxy(req: NextRequest) {
  const secureCookie = (process.env.AUTH_URL ?? "").startsWith("https://");
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/journal/dashboard/:path*"],
};
