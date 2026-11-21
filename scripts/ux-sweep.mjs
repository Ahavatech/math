// Runs an accessibility scan (axe) plus console and network checks over many
// pages, in light and dark, at phone width. Development aid, not part of the app.
//
//   node scripts/ux-sweep.mjs [baseUrl] [--admin email|password] [--only dark|light]
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const adminIdx = args.indexOf("--admin");
const admin = adminIdx >= 0 ? args[adminIdx + 1] : null;
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

const PUBLIC = [
  "/", "/about", "/programmes", "/research", "/staff", "/news", "/events", "/events?tab=past",
  "/alumni", "/students", "/students/courses", "/students/handbook", "/students/calendar",
  "/students/downloads", "/journal", "/journal/issues", "/contact", "/donate",
  "/privacy", "/search?q=maths", "/login", "/forgot-password", "/journal/register",
  "/no-such-page-here",
];
const ADMIN = [
  "/admin", "/admin/site", "/admin/news", "/admin/news/new", "/admin/events", "/admin/events/new",
  "/admin/lecturers", "/admin/staff", "/admin/alumni", "/admin/alumni/links", "/admin/users",
  "/admin/messages", "/admin/media", "/admin/courses", "/admin/handbook", "/admin/downloads",
  "/admin/calendar", "/admin/programmes", "/admin/research", "/admin/navigation", "/admin/pages",
  "/admin/journal/manuscripts", "/admin/journal/reviewers", "/admin/journal/issues",
  "/admin/journal/articles", "/admin/journal/board", "/admin/journal/pages", "/admin/journal/settings",
  "/admin/my-profile", "/admin/my-profile/security", "/two-factor",
];

// Detail pages (one news post, one lecturer, one course...) are found by following the
// first links on each list page, so the sweep covers them without hard-coding slugs.
const LIST_PAGES = ["/news", "/events", "/staff", "/students/courses", "/students/handbook", "/research", "/programmes", "/journal/articles", "/journal/issues", "/alumni"];
async function discoverDetailPages(page, base) {
  const found = new Set();
  for (const list of LIST_PAGES) {
    try {
      await page.goto(base + list, { waitUntil: "domcontentloaded", timeout: 20000 });
      const hrefs = await page.$$eval("main a[href^='/']", (as) => as.map((a) => a.getAttribute("href")));
      const section = list.split("/")[1];
      const deeper = hrefs.filter((h) => h && h.split("?")[0].split("/").filter(Boolean).length >= 2 && !h.includes("#") && (h.startsWith("/" + section) || (section === "staff" && h.startsWith("/lecturer"))));
      for (const h of [...new Set(deeper)].slice(0, 2)) found.add(h);
    } catch {}
  }
  return [...found];
}

const browser = await chromium.launch();
const schemes = only ? [only] : ["light", "dark"];
let findings = 0;
let pages = 0;

for (const scheme of schemes) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    colorScheme: scheme,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failed = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => consoleErrors.push("pageerror: " + String(e).slice(0, 160)));
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("/no-such-page-here")) failed.push(`${r.status()} ${r.url().replace(base, "")}`);
  });

  let routes = [...PUBLIC, ...(await discoverDetailPages(page, base))];
  if (admin) {
    const [email, password] = admin.split("|");
    await page.goto(base + "/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.waitForURL(/\/admin|\/journal|\/two-factor|\/$/, { timeout: 20000 });
    routes = [...routes, ...ADMIN];
  }

  for (const route of routes) {
    consoleErrors.length = 0;
    failed.length = 0;
    try {
      await page.goto(base + route, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(700);
      pages++;
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
        .analyze();
      const rows = results.violations.map((v) => `${v.impact}:${v.id}(${v.nodes.length})`);
      const noise = failed.filter((f) => !/\.(woff2?|map)$/.test(f));
      if (rows.length || consoleErrors.length || noise.length) {
        findings++;
        console.log(`[${scheme}] ${route}`);
        if (rows.length) console.log("   axe:", rows.join(", "));
        if (consoleErrors.length) console.log("   console:", [...new Set(consoleErrors)].join(" | "));
        if (noise.length) console.log("   network:", [...new Set(noise)].join(" | "));
      }
    } catch (error) {
      findings++;
      console.log(`[${scheme}] ${route} ERROR ${String(error).slice(0, 100)}`);
    }
  }
  await context.close();
}
console.log(`\n${pages} page scans, ${findings} with findings`);
await browser.close();
