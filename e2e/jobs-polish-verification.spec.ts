import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const artifacts = path.join("test-results", "jobs-polish-run", "screenshots");
const jobs = Array.from({ length: 60 }, (_, i) => ({
  id: `job-${i + 1}`, externalId: `external-${i + 1}`, source: "GREENHOUSE",
  companyName: i % 2 === 0 ? "Stripe" : "Example Studio", title: `Synthetic Engineer ${i + 1}`,
  location: "Toronto, ON", workplaceType: "REMOTE", isCanadianEligible: true,
  description: "Build reliable products using TypeScript.", descriptionHtml: "", applyUrl: "https://example.com/jobs",
  postedAt: null, salaryMin: 100000, salaryMax: 140000, salaryCurrency: "CAD", createdAt: "2026-01-01T00:00:00.000Z", trackedJob: null,
}));
const trackerJobs = Array.from({ length: 20 }, (_, i) => ({ id: `tracked-${i}`, company: "Example Studio", roleTitle: `Tracked Engineer ${i}`, source: "pasted", status: "SAVED", createdAt: "2026-01-01T00:00:00.000Z", notes: "", rawDescription: "Synthetic description", extractedRequirements: { requiredSkills: [], preferredSkills: [], domainTerms: [] }, variants: [], coverLetters: [] }));
async function mocks(page: Page) {
  const requests: string[] = [];
  await page.addInitScript((list) => { localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(list)); }, trackerJobs);
  await page.route("**/api/**", async route => {
    const req = route.request(); const url = new URL(req.url());
    requests.push(`${req.method()} ${url.pathname}${url.search}`);
    let data: unknown = { success: false, error: "Synthetic endpoint unavailable" };
    if (url.pathname === "/api/evidence") data = { success: true, data: [] };
    if (url.pathname === "/api/demo-config") data = { demoMode: true };
    if (url.pathname === "/api/auth/me") data = { data: null, guest: true };
    if (url.pathname === "/api/connectors/jobs") {
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const matching = jobs.filter(j => `${j.companyName} ${j.title} ${j.description}`.toLowerCase().includes(search));
      const index = Number(url.searchParams.get("page") || "1");
      data = { success: true, data: matching.slice((index - 1) * 30, index * 30), meta: { total: matching.length, totalPages: Math.max(1, Math.ceil(matching.length / 30)) }, hasEvidence: false };
    }
    if (url.pathname === "/api/stats/outcomes") data = { success: true, guest: false, data: {
      funnel: { SAVED: 2, APPLIED: 20, INTERVIEWING: 4, OFFER: 1, REJECTED: 3 }, interviewRate: 0.2, medianResponseDays: 5,
      variants: Array.from({ length: 50 }, (_, i) => ({ variantId: `variant-${i}`, variantTitle: `Synthetic variant ${i}`, company: "Example Studio", roleTitle: "Engineer", applications: 2, interviews: 1, offers: 0, interviewRate: 0.5 })),
    } };
    if (url.pathname === "/api/connectors/promote") data = { success: true, data: { job: { id: "synthetic-saved" } } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  return requests;
}
async function noOverflow(page: Page) {
  const dims = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dims.scroll).toBeLessThanOrEqual(dims.width + 1);
}
async function screenshot(page: Page, name: string) { mkdirSync(artifacts, { recursive: true }); await page.screenshot({ path: path.join(artifacts, name) }); }

for (const size of [{ name: "desktop", width: 1440, height: 900 }, { name: "tablet", width: 768, height: 900 }, { name: "mobile", width: 375, height: 812 }]) {
  test(`${size.name} feed scroll and responsive layout`, async ({ page }) => {
    await page.setViewportSize(size); await mocks(page); await page.goto("/tracker/feed");
    await expect(page.getByTestId("job-card-job-1")).toBeVisible();
    await noOverflow(page);
    const heading = page.getByRole("heading", { name: /Discovered Jobs/i });
    await expect(heading).toBeVisible(); await expect(page.getByRole("banner")).toBeVisible(); await expect(page.getByTestId("tracker-tab-feed")).toBeVisible();
    const bounds = await page.evaluate(() => ({ header: document.querySelector("header")!.getBoundingClientRect().bottom, heading: Array.from(document.querySelectorAll("h1,h2")).find(e => e.textContent?.includes("Discovered Jobs"))!.getBoundingClientRect().top }));
    expect(bounds.heading).toBeGreaterThanOrEqual(bounds.header);
    await screenshot(page, `${size.name}-top.png`);
    const before = await page.getByTestId("job-card-job-1").evaluate(e => e.getBoundingClientRect().top);
    await page.mouse.move(size.width / 2, size.height * 0.7); await page.mouse.wheel(0, 700);
    await expect.poll(async () => page.getByTestId("job-card-job-1").evaluate(e => e.getBoundingClientRect().top)).toBeLessThan(before - 50);
    await page.getByTestId("job-card-job-30").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("job-card-job-30")).toBeInViewport();
    await page.getByTestId("discover-page-next").scrollIntoViewIfNeeded();
    await expect(page.getByTestId("discover-page-next")).toBeInViewport();
    await screenshot(page, `${size.name}-bottom.png`);
    await noOverflow(page);
  });
}

test("keyboard, search, filter, pagination, and mocked save", async ({ page }) => {
  const requests = await mocks(page); await page.goto("/tracker/feed"); await expect(page.getByTestId("job-card-job-1")).toBeVisible();
  await page.locator("body").click({ position: { x: 5, y: 400 } }); const y = await page.evaluate(() => scrollY);
  await page.keyboard.press("PageDown"); await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(y);
  await page.getByTestId("discover-page-next").focus(); await expect(page.getByTestId("discover-page-next")).toBeFocused(); await page.keyboard.press("Enter");
  await expect(page.getByTestId("discover-page-indicator")).toContainText("Page 2 of 2"); await expect(page.getByTestId("job-card-job-31")).toBeAttached();
  await page.getByTestId("discover-search-input").fill("Stripe"); await expect(page.getByTestId("discover-page-indicator")).toContainText("Page 1 of 1");
  await expect(page.getByTestId("job-card-job-1")).toBeAttached(); await expect(page.getByTestId("job-card-job-2")).toHaveCount(0);
  await page.getByTestId("promote-btn-job-1").click(); await expect(page.getByTestId("in-tracker-btn-job-1")).toBeVisible();
  await page.getByTestId("curated-chip-all").click(); await page.getByTestId("discover-city-select").selectOption("toronto"); await expect(page.getByTestId("discover-radius-select")).toBeVisible();
  await expect.poll(() => requests.some(request => request.includes("city=toronto"))).toBe(true);
  expect(requests.some(request => request.startsWith("POST /api/connectors/promote"))).toBe(true);
});

test("touch scroll moves feed content", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); await mocks(page); await page.goto("/tracker/feed"); await expect(page.getByTestId("job-card-job-1")).toBeVisible();
  const before = await page.evaluate(() => scrollY); const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 340, y: 700 }] });
  for (let y = 650; y >= 200; y -= 50) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 340, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 30); await context.close();
});

test("tracker pane and editor stay bounded", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await mocks(page); await page.goto("/tracker");
  const list = page.getByTestId("tracker-job-list"); await expect(list).toBeVisible(); await expect(page.getByTestId("tracker-job-detail")).toBeVisible();
  await list.hover(); await page.mouse.wheel(0, 500); await expect.poll(() => list.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => scrollY)).toBe(0);
  await page.goto("/editor"); await expect(page.getByTestId("panel-code")).toBeVisible(); await expect(page.getByTestId("panel-preview")).toBeVisible();
  const dims = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, viewport: innerHeight })); expect(dims.height).toBeLessThanOrEqual(dims.viewport + 1);
});

test("brand fonts resolve to loaded local faces", async ({ page }) => {
  await mocks(page); await page.goto("/tracker/feed"); await expect(page.getByTestId("job-card-job-1")).toBeVisible();
  const result = await page.evaluate(async () => {
    await document.fonts.ready;
    const root = getComputedStyle(document.documentElement);
    const sans = root.getPropertyValue("--font-hanken").trim().split(",")[0].trim();
    const mono = root.getPropertyValue("--font-mono").trim().split(",")[0].trim();
    const sansFamily = getComputedStyle(document.body).fontFamily;
    const monoFamily = getComputedStyle(document.querySelector(".font-mono")!).fontFamily;
    return { sans, mono, sansFamily, monoFamily, sansLoaded: document.fonts.check(`16px ${sans}`), monoLoaded: document.fonts.check(`16px ${mono}`) };
  });
  expect(result.sansFamily).toContain(result.sans.replaceAll('"', "")); expect(result.monoFamily).toContain(result.mono.replaceAll('"', ""));
  expect(result.sansLoaded).toBe(true); expect(result.monoLoaded).toBe(true);
});


test("outcomes page scrolls to the final variant", async ({ page }) => {
  await mocks(page); await page.goto("/tracker/outcomes");
  await expect(page.getByTestId("outcome-variants")).toBeVisible();
  await page.mouse.move(600, 650); await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(50);
  await page.getByText("Synthetic variant 49", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Synthetic variant 49", { exact: true })).toBeInViewport();
});
