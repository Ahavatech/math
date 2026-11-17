// Sweeps pages at phone width and reports horizontal overflow, small tap
// targets and tiny text. Development aid, not part of the app.
//
//   node scripts/mobile-audit.mjs [baseUrl] [--admin email|password] [--width 375] [--dark]
//
// Needs the app running (npm run start). Admin pages are included only when
// credentials are given, as "email|password" after --admin.
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const adminIdx = args.indexOf("--admin");
const admin = adminIdx >= 0 ? args[adminIdx + 1] : null;
const widthIdx = args.indexOf("--width");
const width = widthIdx >= 0 ? Number(args[widthIdx + 1]) : 375;
const dark = args.includes("--dark");

const PUBLIC = [
  "/", "/about", "/programmes", "/research", "/staff", "/news", "/events", "/events?tab=past",
  "/alumni", "/students", "/students/courses", "/students/handbook", "/students/calendar",
  "/students/downloads", "/journal", "/contact", "/donate", "/privacy", "/search?q=maths", "/login",
  "/forgot-password",
];
const ADMIN = [
  "/admin", "/admin/site", "/admin/news", "/admin/news/new", "/admin/events", "/admin/events/new",
  "/admin/lecturers", "/admin/staff", "/admin/alumni", "/admin/users", "/admin/messages",
  "/admin/media", "/admin/courses", "/admin/handbook", "/admin/downloads", "/admin/calendar",
  "/admin/programmes", "/admin/research", "/admin/navigation", "/admin/pages",
  "/admin/journal/manuscripts", "/admin/journal/issues", "/admin/my-profile/security", "/two-factor",
];

function audit() {
  const vw = document.documentElement.clientWidth;
  const out = { overflow: [], small: [], tiny: 0 };
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.visibility === "hidden") continue;
    if (el.closest("[data-tabbar-nav], [role=dialog]")) continue;
    if (r.right > vw + 1) {
      let p = el.parentElement;
      let scrolls = false;
      while (p) {
        const o = getComputedStyle(p).overflowX;
        if (o === "auto" || o === "scroll" || o === "hidden" || o === "clip") { scrolls = true; break; }
        p = p.parentElement;
      }
      if (!scrolls) out.overflow.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 36)} right=${Math.round(r.right)}`);
    }
  }
  out.overflow = [...new Set(out.overflow)].slice(0, 5);
  for (const el of document.querySelectorAll("a, button, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, summary, [role=button]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || el.closest(".sr-only") || el.closest("[hidden]")) continue;
    if (cs.display === "inline" && el.tagName === "A") continue; // links inside running text
    if (r.height < 43.5 || r.width < 32) {
      out.small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 22)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
  }
  out.small = [...new Set(out.small)].slice(0, 6);
  for (const el of document.querySelectorAll("p, li, span, td, a, label, dd, dt")) {
    if (el.children.length === 0 && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 13) out.tiny++;
  }
  out.scrollW = document.documentElement.scrollWidth;
  out.vw = vw;
  return out;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: dark ? "dark" : "light",
});
const page = await context.newPage();

let routes = [...PUBLIC];
if (admin) {
  const [email, password] = admin.split("|");
  await page.goto(base + "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/admin|\/journal|\/two-factor|\/$/, { timeout: 20000 });
  routes = [...routes, ...ADMIN];
}

let problems = 0;
for (const route of routes) {
  try {
    const response = await page.goto(base + route, { waitUntil: "networkidle", timeout: 30000 });
    const status = response?.status() ?? 0;
    const r = await page.evaluate(audit);
    const bad = r.scrollW > r.vw + 1 || r.overflow.length || r.small.length || r.tiny;
    if (bad || status >= 400) {
      problems++;
      console.log(`${route}  [${status}] scrollW=${r.scrollW}/${r.vw} tiny=${r.tiny}`);
      if (r.overflow.length) console.log("   overflow:", r.overflow.join(" | "));
      if (r.small.length) console.log("   small:", r.small.join(" | "));
    }
  } catch (error) {
    problems++;
    console.log(`${route}  ERROR ${String(error).slice(0, 100)}`);
  }
}
console.log(`\n${routes.length} pages, ${problems} with findings (width ${width}${dark ? ", dark" : ""})`);
await browser.close();
