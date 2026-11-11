import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Content-Security-Policy (Stage 14)
//
// Sources needed:
//   self               - app's own origin
//   res.cloudinary.com - images and public PDFs (Decision #4, #26)
//   cdn.jsdelivr.net   - KaTeX fonts loaded by katex.min.css
//   'unsafe-inline'    - Next.js injects inline styles; Tailwind emits
//                        inline style attributes. Rich-text HTML rendered via
//                        dangerouslySetInnerHTML is sanitised (sanitize-html)
//                        and never contains <script> or event handlers
//                        (Decision #29), so allowing inline styles is the
//                        accepted trade-off until Next.js adds nonce for RSC.
//   data:              - KaTeX uses data: URIs for some font fallbacks
//   blob:              - next/image may use blob: for optimised images
//
// script-src needs 'unsafe-inline' because Next.js emits inline hydration
// scripts and public pages are static (a per-request nonce would force
// every page dynamic, against the static-first rule). Nonce-based CSP is a
// possible later hardening. No 'unsafe-eval' anywhere. No external script
// sources; object-src is 'none'.
// ---------------------------------------------------------------------------
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' https://res.cloudinary.com data: blob:",
  "font-src 'self' https://cdn.jsdelivr.net data:",
  "connect-src 'self' https://res.cloudinary.com https://api.cloudinary.com",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: cspDirectives },
];

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Confirm page is a one-time-use link; send the strictest referrer and
        // an X-Robots-Tag so crawlers that bypass the meta tag also see noindex.
        source: "/alumni/confirm/:token*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
