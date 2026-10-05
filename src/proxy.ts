import { NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Coarse route protection only: is there a session at all. Real
 * authorisation (which role, which permission, ownership) happens in
 * the service layer on the server, never here — see src/lib/rbac.ts
 * and docs/AUTH.md.
 */
export default auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  runtime: "nodejs",
  matcher: ["/admin/:path*", "/journal/dashboard/:path*"],
};
