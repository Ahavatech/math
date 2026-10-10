import { readFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";

/**
 * Fails the build if an admin-only heavy dependency (rich text editor,
 * KaTeX math preview, image crop tool) ends up in a public page's
 * shipped script chunks. These are meant to load only when an admin
 * page dynamically imports them with `ssr: false`; this script reads
 * each public page's prerendered HTML, resolves every <script> chunk
 * it actually references, and checks none of them embed a forbidden
 * library. A chunk that is merely lazy-loadable but never referenced
 * by a public page's HTML is not a leak.
 */

const FORBIDDEN_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "Tiptap / ProseMirror", pattern: /\bProseMirror\b|@tiptap\//i },
  { name: "KaTeX", pattern: /\bkatex\b/i },
  { name: "react-easy-crop", pattern: /react-easy-crop/i },
  { name: "browser-image-compression", pattern: /browser-image-compression/i },
];

const EXCLUDED_PATH_SEGMENTS = ["/admin", "/_global-error", "/_not-found"];

function isPublicHtmlFile(relativePath: string): boolean {
  const normalized = `/${relativePath.replace(/\\/g, "/")}`;
  return !EXCLUDED_PATH_SEGMENTS.some((segment) => normalized.includes(segment));
}

function main() {
  const appDir = path.join(process.cwd(), ".next", "server", "app");
  const staticDir = path.join(process.cwd(), ".next", "static");

  if (!existsSync(appDir)) {
    console.error("No .next/server/app directory found. Run `next build` first.");
    process.exit(1);
  }

  const htmlFiles = globSync("**/*.html", { cwd: appDir }).filter(isPublicHtmlFile);
  const leaks: { page: string; chunk: string; library: string }[] = [];
  const chunkCache = new Map<string, string>();

  for (const relativeHtml of htmlFiles) {
    const html = readFileSync(path.join(appDir, relativeHtml), "utf8");
    const chunkUrls = [...html.matchAll(/\/_next\/static\/chunks\/[^"'\s]+\.js/g)].map((m) => m[0]);

    for (const chunkUrl of new Set(chunkUrls)) {
      const chunkRelativePath = chunkUrl.replace("/_next/static/", "");
      const chunkFullPath = path.join(staticDir, chunkRelativePath);
      if (!existsSync(chunkFullPath)) continue;

      let content = chunkCache.get(chunkFullPath);
      if (content === undefined) {
        content = readFileSync(chunkFullPath, "utf8");
        chunkCache.set(chunkFullPath, content);
      }

      for (const { name, pattern } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          leaks.push({ page: relativeHtml, chunk: chunkUrl, library: name });
        }
      }
    }
  }

  if (leaks.length > 0) {
    console.error("Bundle leak check failed: admin-only dependencies found in public page bundles.\n");
    for (const leak of leaks) {
      console.error(`  ${leak.page}\n    -> ${leak.chunk} contains ${leak.library}`);
    }
    process.exit(1);
  }

  console.log(`Bundle leak check passed (${htmlFiles.length} public pages scanned).`);
}

main();
