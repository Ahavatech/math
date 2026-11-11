/**
 * Measures first-load JavaScript per public page: the compressed bytes
 * actually transferred for script resources in a cold Chromium load.
 * Usage: npm run build && npm run start; then
 *   npx tsx scripts/measure-first-load-js.ts [baseUrl]
 */
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:3000";
const routes = [
  "/", "/about", "/programmes", "/research", "/staff", "/news", "/events", "/alumni",
  "/students", "/students/courses", "/students/handbook", "/students/downloads",
  "/students/calendar", "/journal", "/contact", "/privacy", "/search?q=algebra", "/login",
];

async function main() {
  const browser = await chromium.launch();
  const rows: { route: string; kb: number; scripts: number }[] = [];
  for (const route of routes) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    const jsIds = new Set<string>();
    const sizes = new Map<string, number>();
    cdp.on("Network.responseReceived", (e) => {
      if (e.type === "Script") jsIds.add(e.requestId);
    });
    cdp.on("Network.loadingFinished", (e) => sizes.set(e.requestId, e.encodedDataLength));
    await page.goto(base + route, { waitUntil: "load" });
    await page.waitForTimeout(2000);
    let total = 0;
    for (const id of jsIds) total += sizes.get(id) ?? 0;
    rows.push({ route, kb: Math.round((total / 1024) * 10) / 10, scripts: jsIds.size });
    await ctx.close();
  }
  await browser.close();
  console.log("| Route | First Load JS (kB, compressed) | Scripts |\n|---|---|---|");
  for (const r of rows) console.log(`| ${r.route} | ${r.kb} | ${r.scripts} |`);
}
main();
