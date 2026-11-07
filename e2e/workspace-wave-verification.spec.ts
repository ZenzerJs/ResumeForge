import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const output = path.join("test-results", "workspace-wave-run", "screenshots");
const companies = ["Figma", "Databricks", "Unknown Widget", "Figma"];
const jobs = companies.map((companyName, i) => ({ id: `synthetic-${i}`, externalId: `e-${i}`, source: "GREENHOUSE", companyName, title: `Engineer ${i}`, location: "Toronto, ON", workplaceType: "REMOTE", isCanadianEligible: true, description: "Synthetic role", descriptionHtml: "", applyUrl: "https://example.com/jobs", postedAt: null, salaryMin: 100000, salaryMax: 140000, salaryCurrency: "CAD", createdAt: "2026-01-01T00:00:00.000Z", trackedJob: null, blendedScore: 74, scoreBreakdown: i === 3 ? undefined : { atsScore: 80, recencyScore: 50, locationScore: 90, salaryScore: 60, finalScore: 74 } }));
async function mock(page: Page) {
  const remoteImages: string[] = [];
  page.on("request", req => { if (req.resourceType() === "image" && !req.url().startsWith("http://127.0.0.1:3150/")) remoteImages.push(req.url()); });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); let data: unknown = { success: false, error: "Synthetic endpoint unavailable" };
    if (url.pathname === "/api/demo-config") data = { demoMode: true };
    if (url.pathname === "/api/auth/me") data = { data: null, guest: true };
    if (url.pathname === "/api/evidence") data = { success: true, data: [] };
    if (url.pathname === "/api/connectors/jobs") data = { success: true, data: jobs, meta: { total: 4, totalPages: 1 }, hasEvidence: true };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  return remoteImages;
}
async function shot(page: Page, name: string) { mkdirSync(output, { recursive: true }); await page.screenshot({ path: path.join(output, name), fullPage: false }); }

test("workspace themes, navigation reset, and real local logos", async ({ page }) => {
  const external = await mock(page); await page.goto("/tracker/feed");
  const card = page.getByTestId("job-card-synthetic-0"); await expect(card).toBeVisible();
  await expect(page.locator("[data-workspace-theme]")).toHaveCount(1);
  for (const index of [0, 1]) {
    const image = page.getByTestId(`job-card-synthetic-${index}`).locator("img");
    await expect(image).toHaveCount(1); await expect.poll(() => image.evaluate((e: HTMLImageElement) => e.complete && e.naturalWidth > 0)).toBe(true);
    expect(await image.getAttribute("src")).toMatch(/^\/company-logos\//);
  }
  await expect(page.getByTestId("job-card-synthetic-2").locator("span[aria-hidden=true]").first()).toHaveText("U");
  const colors = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    const canvas = style.getPropertyValue("--rf-bg").trim();
    const surface = style.getPropertyValue("--rf-surface").trim();
    const card = getComputedStyle(document.querySelector('[data-testid="job-card-synthetic-0"]')!).backgroundColor;
    const input = getComputedStyle(document.querySelector('[data-testid="discover-search-input"]')!).backgroundColor;
    return { canvas, surface, card, input };
  });
  expect(colors.canvas).toBe("#080e1c"); expect(colors.surface).toBe("#1c2940");
  expect(colors.card).toBe("rgb(28, 41, 64)"); expect(colors.card).not.toBe(colors.input);
  await shot(page, "jobs-desktop.png");
  expect(external).toEqual([]);
  for (const [route, name] of [["/library", "library"], ["/settings", "settings"], ["/editor", "editor"], ["/tailor", "tailor"]]) {
    await page.goto(route); await expect(page.locator("[data-workspace-theme]")).toHaveCount(1);
    if (name === "editor" || name === "tailor") await expect(page.getByTestId("workspace-wave")).toHaveCount(0);
    await shot(page, `${name}-desktop.png`);
  }
  await page.goto("/"); await expect(page.locator("[data-workspace-theme]")).toHaveCount(0); await expect(page.getByTestId("workspace-wave")).toHaveCount(0); await expect(page.locator(".tracker-wave-canvas")).toHaveCount(0);
  expect(await page.getByRole("banner").evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgba(11, 19, 38, 0.9)");
  const home = await page.evaluate(() => {
    const style = getComputedStyle(document.body);
    const colors = ["--rf-bg", "--rf-surface", "--rf-surface-elevated"].map(key => style.getPropertyValue(key).trim());
    const probes = ["bg-card", "bg-muted", "bg-rf-surface"].map(name => {
      const node = document.createElement("span"); node.className = name; document.body.appendChild(node);
      const color = getComputedStyle(node).backgroundColor; node.remove(); return color;
    });
    return { colors, probes };
  });
  expect(home.colors).toEqual(["#0b1326", "#171f33", "#222a3d"]);
  expect(home.probes).toEqual(["rgb(23, 31, 51)", "rgb(34, 42, 61)", "rgb(23, 31, 51)"]);
  await shot(page, "home.png");
});

test("score shows weighted factors and accessible popover", async ({ page }) => {
  await mock(page); await page.goto("/tracker/feed"); const card = page.getByTestId("job-card-synthetic-0"); await expect(card).toBeVisible();
  const dial = card.getByRole("button", { name: /Blended score: 74%/ }); await dial.focus(); await expect(dial).toBeFocused(); await page.keyboard.press("Enter");
  const popover = page.getByRole("dialog"); await expect(popover).toBeVisible();
  for (const text of ["Qualifications", "Recency", "Location", "Salary", "80%", "50%", "90%", "60%", "55%", "20%", "15%", "10%"]) await expect(popover.getByText(text, { exact: false }).first()).toBeVisible();
  for (const [label, value] of [["Qualifications", 80], ["Recency", 50], ["Location", 90], ["Salary", 60]] as const) {
    const bar = popover.getByRole("progressbar", { name: label });
    await expect(bar).toHaveAttribute("aria-valuenow", String(value));
    expect(await bar.locator("div").evaluate(e => (e as HTMLElement).style.width)).toBe(`${value}%`);
  }
  await expect(popover).not.toContainText(/undefined|NaN/);
  expect(await popover.evaluate(e => getComputedStyle(e).backgroundColor)).toBe("rgb(41, 59, 85)");
  await shot(page, "score-popover.png");
  const circle = dial.locator("circle").first(); expect(Number(await circle.getAttribute("stroke-width"))).toBeGreaterThanOrEqual(2.5); expect(Number(await circle.getAttribute("stroke-width"))).toBeLessThanOrEqual(4);
  await page.keyboard.press("Escape"); await expect(popover).not.toBeVisible();
  await page.getByTestId("job-card-synthetic-3").getByRole("button", { name: /Blended score: 74%/ }).click();
  const missing = page.getByRole("dialog"); await expect(missing.getByText("Unavailable")).toHaveCount(4);
  await expect(missing.getByRole("progressbar")).toHaveCount(0);
});


test("local logo failure falls back and mobile score opens by touch", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(); const external = await mock(page);
  await page.route("**/company-logos/**", route => route.abort());
  await page.goto("/tracker/feed");
  const card = page.getByTestId("job-card-synthetic-0"); await expect(card).toBeVisible();
  await expect(card.locator("img")).toHaveCount(0); await expect(card.locator("span[aria-hidden=true]").first()).toHaveText("F");
  await card.getByRole("button", { name: /Blended score: 74%/ }).tap(); await expect(page.getByRole("dialog")).toBeVisible();
  expect(external).toEqual([]); await shot(page, "score-mobile.png"); await context.close();
});




test("wave is slow, compositor-only, pausable, and does not block navigation", async ({ page }) => {
  await mock(page); await page.goto("/tracker/feed"); await expect(page.getByTestId("job-card-synthetic-0")).toBeVisible();
  const wave = page.getByTestId("workspace-wave"); const texture = wave.locator(".workspace-wave-texture");
  const canvas = page.locator(".tracker-wave-canvas");
  const canvasStyle = await canvas.evaluate(e => ({ image: getComputedStyle(e).backgroundImage, animation: getComputedStyle(e).animationName }));
  expect(canvasStyle.image).toContain("workspace-wave.svg"); expect(canvasStyle.animation).toBe("none");
  expect((await wave.boundingBox())!.height).toBeLessThanOrEqual(144);
  await expect(wave).toHaveAttribute("aria-hidden", "true");
  const animation = await texture.evaluate(e => {
    const style = getComputedStyle(e); const animations = e.getAnimations();
    const effect = animations[0]?.effect as KeyframeEffect | undefined;
    return { duration: style.animationDuration, playState: style.animationPlayState, frames: effect?.getKeyframes(), pointer: getComputedStyle(e.parentElement!).pointerEvents };
  });
  expect(animation.duration).toBe("72s"); expect(animation.playState).toBe("running"); expect(animation.pointer).toBe("none");
  expect(animation.frames?.length).toBeGreaterThan(0);
  for (const frame of animation.frames || []) for (const key of Object.keys(frame)) expect(["offset", "easing", "composite", "computedOffset", "transform"]).toContain(key);
  const pause = page.getByTestId("workspace-motion-toggle"); await expect(pause).toHaveAccessibleName("Pause background motion");
  await pause.focus(); await expect(pause).toBeFocused(); await page.keyboard.press("Enter");
  await expect(texture).toHaveAttribute("data-paused", "true"); await expect(pause).toHaveAccessibleName("Resume background motion");
  await expect.poll(() => texture.evaluate(e => getComputedStyle(e).animationPlayState)).toBe("paused");
  await pause.click(); await expect(texture).toHaveAttribute("data-paused", "false"); await expect(pause).toHaveAccessibleName("Pause background motion");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(texture).toHaveAttribute("data-paused", "true");
  await page.evaluate(() => { Reflect.deleteProperty(document, "hidden"); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(texture).toHaveAttribute("data-paused", "false");
  await page.getByTestId("tracker-tab-all").click(); await expect(page).toHaveURL(/\/tracker$/); await expect(page.getByTestId("tracker-job-list")).toBeVisible();
  await page.getByTestId("tracker-tab-feed").click(); await expect(page.getByTestId("job-card-synthetic-0")).toBeVisible();
  await shot(page, "wave-desktop.png");
});

test("reduced motion renders static wave and mobile controls remain usable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  const page = await context.newPage(); await mock(page); await page.goto("/tracker/feed"); await expect(page.getByTestId("job-card-synthetic-0")).toBeVisible();
  const texture = page.getByTestId("workspace-wave").locator(".workspace-wave-texture");
  expect(await texture.evaluate(e => getComputedStyle(e).animationName)).toBe("none");
  await expect(page.getByTestId("workspace-motion-toggle")).not.toBeVisible();
  await page.getByTestId("discover-search-input").tap(); await expect(page.getByTestId("discover-search-input")).toBeFocused();
  await shot(page, "wave-mobile-reduced.png"); await context.close();
});


test("curated logo atlas loads all local assets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 }); await mock(page); await page.goto("/tracker/feed"); await expect(page.getByTestId("job-card-synthetic-0")).toBeVisible();
  const manifest = JSON.parse(readFileSync("public/company-logos/SOURCES.json", "utf8")) as Record<string, { path: string }>;
  const files = Object.entries(manifest).map(([name, item]) => ({ name, src: `/${item.path.replace(/^public\//, "")}` }));
  await page.evaluate((entries) => {
    const atlas = document.createElement("div"); atlas.id = "test-logo-atlas";
    atlas.style.cssText = "position:absolute;inset:0 auto auto 0;width:1440px;z-index:9999;background:#101827;display:grid;grid-template-columns:repeat(8,1fr);gap:10px;padding:24px;color:white";
    for (const entry of entries) { const item = document.createElement("div"); item.style.height = "100px"; const img = document.createElement("img"); img.src = entry.src; img.style.cssText = "display:block;width:64px;height:64px;object-fit:contain;background:white"; item.append(img, document.createTextNode(entry.name)); atlas.append(item); }
    document.body.append(atlas);
  }, files);
  const images = page.locator("#test-logo-atlas img"); await expect(images).toHaveCount(files.length);
  await expect.poll(() => images.evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
  mkdirSync(output, { recursive: true }); await page.locator("#test-logo-atlas").screenshot({ path: path.join(output, "logo-atlas.png") });
});
