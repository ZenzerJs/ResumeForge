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
  await page.addInitScript(() => {
    localStorage.setItem(
      "resumeforge_guest_evidence",
      JSON.stringify([
        {
          id: "evidence-1",
          type: "experience",
          title: "Product Engineer",
          organization: "Example Studio",
          dates: "2022–2024",
          verifiedSummary: "Built a TypeScript product backed by PostgreSQL.",
          tags: ["TypeScript", "PostgreSQL"],
          status: "verified",
          bullets: [
            {
              id: "b-1",
              text: "Built a TypeScript product backed by PostgreSQL.",
              technologies: ["TypeScript", "PostgreSQL"],
              roleAffinity: [],
              verified: true,
              orderIndex: 0,
            },
          ],
        },
      ])
    );
  });
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
  await expect(page.getByTestId("ats-score-panel")).toHaveCount(0);
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
  for (const id of ["job-subtab-structured", "job-subtab-original"]) {
    await page.getByTestId(id).click();
    await expect(page.getByTestId(id)).toBeVisible();
  }
  await page.getByTestId("job-extraction-diagnostics-summary").click();
  await expect(page.getByTestId("job-extraction-diagnostics-details")).toHaveAttribute("open", "");
  await expect(page.getByTestId("jd-textarea")).toHaveValue(description);
  await page.getByLabel("Role", { exact: true }).focus();
  await expect(page.getByLabel("Role", { exact: true })).toBeFocused();
  const profileRequest = page.waitForRequest(request => request.url().includes("/api/ats/evaluate") && request.postDataJSON()?.roleProfile === "Frontend");
  await page.getByTestId("tailor-role-profile-select").selectOption("Frontend");
  await expect(page.getByTestId("tailor-role-profile-select")).toHaveValue("Frontend");
  await page.getByTestId("tailor-tab-3-pane").click();
  await expect(page.getByTestId("ats-score-panel")).toHaveCount(1);
  await profileRequest;
  await expect(page.getByText("Role-Relevant Evidence (Frontend)")).toBeVisible();
  const primaryTablist = page.getByRole("tablist", { name: "Tailor views" });
  await expect(primaryTablist.locator('[role="tab"]')).toHaveCount(2);
  await page.getByTestId("tailor-tab-job-info").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByTestId("tailor-tab-3-pane")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByTestId("tailor-tab-job-info")).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByTestId("tailor-tab-3-pane")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByTestId("tailor-tab-job-info")).toBeFocused();
  for (const id of ["tailor-tab-job-info", "tailor-tab-3-pane"]) {
    const tab = page.getByTestId(id);
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(tab).toHaveAttribute("aria-selected", "true");
    await expect(primaryTablist.locator('[role="tab"][aria-selected="true"]')).toHaveCount(1);
    await expect(primaryTablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    const panelId = await tab.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    await expect(page.locator(`[role="tabpanel"]#${panelId}`)).toHaveAttribute("aria-labelledby", await tab.getAttribute("id") || "");
    if (id === "tailor-tab-3-pane") {
      await expect(page.getByTestId("ats-score-panel")).toHaveCount(1);
    } else {
      await expect(page.getByTestId("ats-score-panel")).toHaveCount(0);
    }
    await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(0);
  }
  for (const tool of [
    { itemTestId: "tailor-tool-overview", headingId: "tailor-tool-heading-overview", headingText: "Overview" },
    { itemTestId: "tailor-tool-cover-letter", headingId: "tailor-tool-heading-cover-letter", headingText: "Cover letter" },
    { itemTestId: "tailor-tool-diagnostic", headingId: "tailor-tool-heading-diagnostic", headingText: "Diagnostics" },
  ]) {
    await page.getByTestId("tailor-more-tools-trigger").click();
    await page.getByTestId(tool.itemTestId).click();
    await expect(primaryTablist.locator('[role="tab"][aria-selected="true"]')).toHaveCount(0);
    await expect(primaryTablist.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await expect(page.locator(`#${tool.headingId}`)).toHaveText(tool.headingText);
    await expect(page.locator('#tailor-view-panel[role="tabpanel"]')).toHaveAttribute("aria-labelledby", tool.headingId);
    await expect(page.getByTestId("tool-back-to-job-btn")).toBeVisible();
    await expect(page.getByTestId("tool-back-to-review-btn")).toBeVisible();
    await expect(page.getByTestId("ats-score-panel")).toHaveCount(0);
    if (tool.itemTestId === "tailor-tool-cover-letter") {
      await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(1);
    } else {
      await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(0);
    }
  }
  await expect(page.getByTestId("tailor-role-profile-select")).toHaveValue("Frontend");
  await page.getByTestId("tailor-tab-job-info").click();
  const readiness = page.getByTestId("tailor-readiness");
  await expect(readiness).toContainText("Saved in this browser");
  await expect(readiness).toContainText("1 verified item");
  await expect(readiness).toContainText("Extracted");
  await expect(page.getByRole("button", { name: "Configure in Settings" })).toBeVisible();
  await page.getByTestId("generate-patches-btn").click();
  await expect(page.getByText(/No AI provider configured/i).first()).toBeVisible();
  await page.addInitScript(() => {
    localStorage.setItem("resumeforge_ai_settings", JSON.stringify({ provider: "gemini", apiKey: "synthetic-test-key" }));
  });
  await page.reload();
  await page.getByTestId("jd-textarea").fill("Join our team.");
  await expect(readiness).toContainText("Extraction needed");
  await page.getByRole("button", { name: "Extract requirements", exact: true }).click();
  await expect(readiness).toContainText("Extracted");
  await expect(readiness).toContainText("Configured");
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
    await page.getByTestId("tailor-more-tools-trigger").click();
    await page.getByTestId("tailor-tool-overview").click();
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

test("guest sequential typing in Tailor stays intact across auto-save and auto-rescan", async ({ page }) => {
  await page.setViewportSize({ width: 1350, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname === "/api/demo-config") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ demoMode: false }) });
      return;
    }
    if (pathname === "/api/auth/me") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ guest: true, data: null }) });
      return;
    }
    if (pathname === "/api/resumes") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, guest: true, data: [] }) });
      return;
    }
    if (pathname === "/api/evidence") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, guest: true, data: [] }) });
      return;
    }
    if (pathname === "/api/jobs/match") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, guest: true, data: [] }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, guest: true, data: [] }),
    });
  });

  await page.goto("/tailor?new=1");
  const jdTextarea = page.getByTestId("jd-textarea");
  await expect(jdTextarea).toBeVisible();
  await expect(jdTextarea).toHaveValue("");

  const firstChunk =
    "We are hiring a Software Engineer to build TypeScript and PostgreSQL services across distributed systems. ";
  const secondChunk =
    "Required: Python, Docker, React, and Vitest for automated quality pipelines.";
  const fullDescription = `${firstChunk}${secondChunk}`;

  await jdTextarea.click();
  await jdTextarea.pressSequentially(firstChunk, { delay: 20 });
  await page.waitForTimeout(1000);
  await jdTextarea.pressSequentially(secondChunk, { delay: 20 });
  await expect(jdTextarea).toHaveValue(fullDescription);

  const roleInput = page.locator("#tailor-role");
  const customRole = "Staff Infrastructure Architect";
  await roleInput.click();
  await roleInput.pressSequentially(customRole, { delay: 25 });
  await page.waitForTimeout(1300);
  await expect(roleInput).toBeFocused();
  await expect(roleInput).toHaveValue(customRole);

  const companyInput = page.locator("#tailor-company");
  const customCompany = "Northwind Systems";
  await companyInput.click();
  await companyInput.pressSequentially(customCompany, { delay: 25 });
  await expect(companyInput).toHaveValue(customCompany);

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const raw = localStorage.getItem("resumeforge_guest_jobs");
          if (!raw) return null;
          const parsed = JSON.parse(raw) as Array<{
            company?: string;
            roleTitle?: string;
            rawDescription?: string;
          }>;
          return parsed[0] ?? null;
        }),
      { timeout: 5000 }
    )
    .toMatchObject({
      company: customCompany,
      roleTitle: customRole,
      rawDescription: fullDescription,
    });

  await expect(jdTextarea).toHaveValue(fullDescription);
  expect(errors).toEqual([]);
});
