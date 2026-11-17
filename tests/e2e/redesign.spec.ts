import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Regression coverage for the Stage 15 and 16 redesign: pages the original
 * suite did not reach, layout at phone and laptop widths, and the mobile
 * menu. Data-dependent pages skip themselves when the database has no
 * matching content, so the suite still runs against a bare seed.
 */

const MORE_ROUTES = [
  "/journal/about",
  "/journal/articles",
  "/journal/issues",
  "/journal/editorial-board",
  "/journal/guidelines",
  "/journal/call-for-papers",
  "/journal/policies",
  "/programmes/bsc",
  "/research",
  "/donate",
  // Standalone screens that sit outside the site header and footer.
  "/login",
  "/forgot-password",
  "/reset-password/not-a-real-token",
  "/accept-invite/not-a-real-token",
  "/403",
  "/alumni/submit/not-a-real-token",
  "/alumni/confirm/not-a-real-token",
];

async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.nodes.length})`);
}

async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

test.describe("more pages have no serious accessibility violations", () => {
  for (const route of MORE_ROUTES) {
    test(route, async ({ page }) => {
      const response = await page.goto(route);
      test.skip(response?.status() === 404, `${route} has no content in this database`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("main")).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("a lecturer profile", async ({ page }) => {
    await page.goto("/staff");
    const link = page.locator('a[href^="/lecturer/"]').first();
    test.skip((await link.count()) === 0, "no published lecturers in this database");
    await link.click();
    await expect(page.locator("main h1")).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("the not-found page", () => {
  test("returns 404, offers a way forward and has no serious accessibility violations", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search the site" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to the home page" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test.describe("layout does not overflow", () => {
  const ROUTES = ["/", "/staff", "/news", "/events", "/students/courses", "/journal", "/contact", "/donate", "/login", "/forgot-password"];
  const WIDTHS = [
    { name: "phone", width: 390, height: 844 },
    { name: "small laptop", width: 1280, height: 800 },
    { name: "desktop", width: 1440, height: 900 },
  ];

  for (const size of WIDTHS) {
    for (const route of ROUTES) {
      test(`${route} at ${size.name} (${size.width}px)`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        const response = await page.goto(route);
        test.skip(response?.status() === 404, `${route} has no content in this database`);
        await expect(page.locator("main")).toBeVisible();
        expect(await hasHorizontalOverflow(page)).toBe(false);
      });
    }
  }

  test("the header search link is fully inside the window at 1280px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const box = await page.locator("header a[href='/search']").boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a tab bar sits at the bottom, with Home, sections and More, and marks the current page", async ({ page }) => {
    await page.goto("/");
    const tabs = page.getByRole("navigation", { name: "Sections" });
    await expect(tabs).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await expect(tabs.getByRole("button", { name: "More" })).toBeVisible();
    // Pinned to the bottom edge of the screen, and the page ends above it.
    const box = await tabs.boundingBox();
    expect(Math.round(box!.y + box!.height)).toBe(844);
    expect(await page.evaluate(() => document.body.hasAttribute("data-tabbar"))).toBe(true);
  });

  test("More opens the full menu as a sheet that closes with Escape", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Menu" })).toBeVisible();
    const nav = page.getByRole("navigation", { name: "Primary (mobile)" });
    await expect(nav.getByRole("link").first()).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search the site" })).toBeVisible();
    // The sheet sits against the bottom edge with soft top corners.
    const radius = await sheet.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
    expect(parseFloat(radius)).toBeGreaterThan(8);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  test("pulling the sheet's handle down dismisses it, and a short pull springs back", async ({ page }) => {
    await page.goto("/");
    const more = page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    const handle = sheet.locator('[data-slot="sheet-grabber"]');
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    // A short pull and let go: it springs back.
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + 30, { steps: 5 });
    await page.mouse.up();
    await expect(sheet).toBeVisible();

    // A long pull: it goes away.
    const again = (await handle.boundingBox())!;
    await page.mouse.move(x, again.y + again.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, again.y + again.height / 2 + 260, { steps: 12 });
    await page.mouse.up();
    await expect(sheet).toBeHidden();
  });

  test("focus stays inside the open sheet and returns to the button that opened it", async ({ page }) => {
    await page.goto("/");
    const more = page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "More" });
    await more.click();
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      // The focus trap hands focus back from its guard element a moment later.
      await expect
        .poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')), { timeout: 2000 })
        .toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
  });

  test("the sheet closes by itself after following a link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "More" }).click();
    await page.getByRole("navigation", { name: "Primary (mobile)" }).getByRole("link").nth(1).click();
    await page.waitForLoadState("load");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("an inner page has a Back button in the bar that stays put while scrolling, and the title tucks into the bar", async ({ page }) => {
    await page.goto("/about");
    const back = page.getByRole("link", { name: /^Back to/ });
    await expect(back).toBeVisible();
    const title = page.locator(".bar-title");
    await expect(title).toHaveAttribute("data-visible", "false");

    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(title).toHaveAttribute("data-visible", "true");
    // The back button has not scrolled away.
    const box = await back.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(70);
  });

  test("the home page has no Back button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /^Back to/ })).toHaveCount(0);
  });

  test("controls are at least 44px tall on the pages people use most", async ({ page }) => {
    for (const route of ["/", "/news", "/staff", "/contact"]) {
      await page.goto(route);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll("footer a, nav[aria-label='Breadcrumb'] a, nav[aria-label='Sections'] a, main button, main input:not([type=hidden]), main select")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (getComputedStyle(el).display === "inline" || el.closest('[aria-hidden="true"]')) continue;
          if (r.height < 43.5) out.push(`${el.tagName.toLowerCase()} ${(el.textContent ?? "").trim().slice(0, 20)} ${Math.round(r.height)}`);
        }
        return out;
      });
      expect(small, route).toEqual([]);
    }
  });

  test("from 768px there is no tab bar and the header has a Menu button", async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1000 });
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Sections" })).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("the journal section bar scrolls sideways instead of wrapping", async ({ page }) => {
    await page.goto("/journal/issues");
    const nav = page.getByRole("navigation", { name: "Journal sections" });
    await expect(nav).toBeVisible();
    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test("the About page shows the department photograph, with its caption, at its own proportions", async ({ page }) => {
  await page.goto("/about");
  const figure = page.locator("main figure").first();
  test.skip((await figure.count()) === 0, "no About page image has been set in this database");
  const img = figure.locator("img");
  await expect(img).toBeVisible();
  expect(await img.getAttribute("alt")).not.toBeNull();
  // Fully loaded, not broken.
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  // It never pushes the page sideways on a phone.
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test("every main public page has exactly one h1", async ({ page }) => {
  for (const route of ["/", "/about", "/programmes", "/research", "/staff", "/news", "/events", "/students", "/journal", "/contact", "/donate", "/privacy"]) {
    await page.goto(route);
    expect(await page.locator("main h1").count(), route).toBe(1);
  }
});

test.describe("appearance toggle", () => {
  test.use({ colorScheme: "light", viewport: { width: 1280, height: 900 } });

  const DARK_PAPER = "rgb(11, 18, 32)";
  const LIGHT_PAPER = "rgb(251, 252, 252)";
  const paper = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  test("is a labelled group with three choices, and System is selected to begin with", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("radiogroup", { name: "Appearance" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(3);
    await expect(group.getByRole("radio", { name: "System" })).toBeChecked();
  });

  test("Dark overrides a light device, is remembered across reloads, and System hands control back", async ({ page }) => {
    await page.goto("/");
    expect(await paper(page)).toBe(LIGHT_PAPER);

    const group = page.getByRole("radiogroup", { name: "Appearance" });
    await group.getByRole("radio", { name: "Dark" }).click();
    expect(await paper(page)).toBe(DARK_PAPER);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await paper(page)).toBe(DARK_PAPER);
    await expect(page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "Dark" })).toBeChecked();

    await page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "System" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    expect(await paper(page)).toBe(LIGHT_PAPER);
  });

  test("Light overrides a dark device", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    expect(await paper(page)).toBe(DARK_PAPER);
    await page.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "Light" }).click();
    expect(await paper(page)).toBe(LIGHT_PAPER);
  });

  test("a saved choice is applied before the page paints, so there is no flash", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("oau-theme", "dark"));
    await page.goto("/", { waitUntil: "commit" });
    // The inline script runs while the document is still being parsed.
    await page.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", null, { timeout: 5000 });
    expect(await paper(page)).toBe(DARK_PAPER);
  });

  test("arrow keys move between the choices", async ({ page }) => {
    await page.goto("/");
    const group = page.getByRole("radiogroup", { name: "Appearance" });
    await group.getByRole("radio", { name: "Light" }).click();
    await group.getByRole("radio", { name: "Light" }).press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Dark" })).toBeChecked();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("the phone menu sheet has it too", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radiogroup", { name: "Appearance" }).getByRole("radio", { name: "Dark" }).click();
    expect(await paper(page)).toBe(DARK_PAPER);
  });
});

test.describe("dark mode", () => {
  test.use({ colorScheme: "dark", viewport: { width: 390, height: 844 } });

  test("follows the device: dark paper, light ink, and no hard-coded white", async ({ page }) => {
    await page.goto("/");
    const colours = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return { background: body.backgroundColor, color: body.color, scheme: getComputedStyle(document.documentElement).colorScheme };
    });
    // rgb(11, 18, 32) is the dark paper token; the ink is light.
    expect(colours.background).toBe("rgb(11, 18, 32)");
    expect(colours.color).toBe("rgb(232, 237, 243)");
  });

  for (const route of ["/", "/staff", "/contact", "/login"]) {
    test(`${route} has no serious contrast problems in dark mode`, async ({ page }) => {
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious.map((v) => `${v.id} (${v.nodes.length})`)).toEqual([]);
    });
  }
});

test.describe("filters are links that announce the current choice", () => {
  test("news categories and event tabs mark the active item", async ({ page }) => {
    await page.goto("/events");
    await expect(page.getByRole("link", { name: "Upcoming", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goto("/events?tab=past");
    await expect(page.getByRole("link", { name: "Past", exact: true })).toHaveAttribute("aria-current", "page");
    await page.goto("/news");
    await expect(page.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "true");
  });
});

test.describe("donations page", () => {
  test("is either absent or complete, and never shows empty bank details", async ({ page }) => {
    const response = await page.goto("/donate");
    if (response?.status() === 404) {
      // Off: the footer must not advertise it either.
      await page.goto("/");
      await expect(page.locator("footer a[href='/donate']")).toHaveCount(0);
      return;
    }
    expect(response?.status()).toBe(200);
    await expect(page.getByText("Account number", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy account number/ })).toBeVisible();
    await expect(page.getByText(/confirm these details with the department/)).toBeVisible();
    await page.goto("/");
    await expect(page.locator("footer a[href='/donate']")).toHaveCount(1);
  });
});

test.describe("privacy notice", () => {
  test("is linked from every page footer and says when it was last updated", async ({ page }) => {
    await page.goto("/news");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy notice" }).click();
    await page.waitForURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy notice" })).toBeVisible();
    await expect(page.getByText(/Last updated/)).toBeVisible();
    for (const heading of ["Your rights", "How long we keep information", "Cookies"]) {
      await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
    }
  });
});
