import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const output = process.env.TAILOR_POLISH_ARTIFACTS || path.join(process.cwd(), "test-results", "tailor-polish");
mkdirSync(output, { recursive: true });
const longRole = "Senior Platform Engineer, Distributed Systems and Product Infrastructure";
const description = "Senior Platform Engineer\n\nBuild accessible products with TypeScript and PostgreSQL. Collaborate with product teams to improve reliable systems and customer outcomes.";
const requirements = { requiredSkills: ["TypeScript", "PostgreSQL"], preferredSkills: ["AWS"], domainTerms: ["product analytics"], roleTitle: longRole, company: "Example Studio" };
const score = (profile: string) => ({
  overallScore: 82, selectedProfile: profile,
  baseHealth: { score: 24, maxScore: 30, percentage: 80, findings: ["Clear resume structure"] },
  requiredMatch: { score: 34, maxScore: 40, percentage: 85, findings: ["TypeScript experience verified"] },
  preferredMatch: { score: 12, maxScore: 15, percentage: 80, findings: ["Cloud experience listed"] },
  roleEvidence: { score: 12, maxScore: 15, percentage: 80, findings: ["Relevant evidence available"] },
  skillEvaluations: [{ skill: "TypeScript", category: "required", status: "DEMONSTRATED_IN_EXPERIENCE", matchedContext: "Built a TypeScript product." }],
  gaps: ["Add verified cloud experience if available."],
});

async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let data: unknown;
    if (path === "/api/demo-config") data = { demoMode: true };
    else if (path === "/api/jobs/extract") data = { success: true, data: requirements };
    else if (path === "/api/jobs/match") data = { success: true, data: [{ id: "evidence-1", title: "Product Engineer", organization: "Example Studio", dates: "2022–2024", isDraft: false, matchPercentage: 85, verifiedSummary: "Built a TypeScript product backed by PostgreSQL.", matchedRequirements: ["TypeScript", "PostgreSQL"], matchedBullets: [] }] };
    else if (path === "/api/ats/evaluate") data = { success: true, data: score(route.request().postDataJSON().roleProfile) };
    else if (path === "/api/jobs" || path.startsWith("/api/jobs/")) data = { success: true, data: { id: "synthetic-job" } };
    else data = { success: false, error: "Synthetic test endpoint unavailable" };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/tailor");
  await expect(page.getByTestId("jd-textarea")).toBeVisible();
  await page.getByLabel("Company", { exact: true }).fill("Example Studio");
  await page.getByLabel("Role", { exact: true }).fill(longRole);
  await page.getByTestId("jd-textarea").fill(description);
  await page.getByTestId("extract-reqs-btn").click();
  await expect(page.getByTestId("req-skill-TypeScript")).toBeVisible();
  await expect(page.getByText("Product Engineer", { exact: true })).toBeVisible();
  await expect(page.getByTestId("overall-score-badge")).toBeVisible();
  return errors;
}

async function noOverflow(page: Page) {
  const widths = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
  expect(widths.document).toBeLessThanOrEqual(widths.viewport + 1);
}

async function resetScroll(page: Page) {
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const main = document.getElementById("main-content");
    if (main) main.scrollTo({ top: 0, left: 0, behavior: "instant" });
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  });
}

test("desktop workflow, tabs, and profile evaluation", async ({ page }) => {
  await page.setViewportSize({ width: 1350, height: 900 });
  const errors = await setup(page);
  await resetScroll(page);
  await page.screenshot({ path: `${output}/desktop-job-info.png`, fullPage: true });
  for (const id of ["job-subtab-structured", "job-subtab-details", "job-subtab-original"]) {
    await page.getByTestId(id).click();
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await expect(page.getByTestId("jd-textarea")).toHaveValue(description);
  await page.getByLabel("Role", { exact: true }).focus();
  await expect(page.getByLabel("Role", { exact: true })).toBeFocused();
  const profileRequest = page.waitForRequest(request => request.url().includes("/api/ats/evaluate") && request.postDataJSON()?.roleProfile === "Frontend");
  await page.getByTestId("tailor-role-profile-select").selectOption("Frontend");
  await profileRequest;
  await expect(page.getByText("Role-Relevant Evidence (Frontend)")).toBeVisible();
  await page.getByTestId("tailor-tab-overview").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("tailor-tab-3-pane")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByTestId("tailor-tab-diagnostic")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("tailor-tab-overview")).toBeFocused();
  for (const id of ["tailor-tab-overview", "tailor-tab-3-pane", "tailor-tab-job-info", "tailor-tab-cover-letter", "tailor-tab-diagnostic"]) {
    const tab = page.getByTestId(id);
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    const panelId = await tab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    await expect(page.locator(`[role="tabpanel"]#${panelId}`)).toHaveAttribute("aria-labelledby", await tab.getAttribute("id") || "");
  }
  await page.getByTestId("tailor-tab-job-info").click();
  await page.getByTestId("generate-patches-btn").click();
  await expect(page.getByText(/No AI provider configured/i).first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem("resumeforge_ai_settings", JSON.stringify({ provider: "ollama" })));
  let release: () => void = () => {};
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/demo/generate-patches", async route => {
    await pending;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: false, error: "Synthetic generation failure" }) });
  });
  await page.getByTestId("generate-patches-btn").click();
  await expect(page.getByTestId("generate-patches-btn")).toBeDisabled();
  release();
  await expect(page.getByText("Synthetic generation failure")).toBeVisible();
  await expect(page.getByTestId("generate-patches-btn")).toBeEnabled();
  expect(errors).toEqual([]);
});

test("reduced motion and 200 percent zoom equivalent reflow", async ({ page }) => {
  await page.setViewportSize({ width: 675, height: 450 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await setup(page);
  await expect(page.getByTestId("jd-textarea")).toBeVisible();
  await noOverflow(page);
  await resetScroll(page);
  await page.screenshot({ path: `${output}/viewport-200-percent-equivalent.png`, fullPage: true });
  expect(errors).toEqual([]);
});

for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "phone", width: 375, height: 812 }, { name: "landscape", width: 812, height: 375 }]) {
  test(`${viewport.name} responsive layouts`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors = await setup(page);
    await noOverflow(page);
    await resetScroll(page);
    await page.screenshot({ path: `${output}/${viewport.name}-viewport.png` });
    await page.screenshot({ path: `${output}/${viewport.name}-job-info.png`, fullPage: true });
    await page.getByTestId("tailor-tab-overview").click();
    await expect(page.getByTestId("tailor-overview-panel")).toBeVisible();
    await expect(page.getByText("Loading Cover Letter Panel...")).toHaveCount(0);
    await noOverflow(page);
    await resetScroll(page);
    await page.screenshot({ path: `${output}/${viewport.name}-overview.png`, fullPage: true });
    await page.getByTestId("tailor-tab-3-pane").click();
    await expect(page.getByTestId("tailor-3pane-container")).toBeVisible();
    await noOverflow(page);
    await resetScroll(page);
    await page.screenshot({ path: `${output}/${viewport.name}-three-pane.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
