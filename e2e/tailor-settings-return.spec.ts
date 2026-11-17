import { test, expect, type Page, type Route } from "@playwright/test";

const jobId = "settings-return-job";
const editedDescription = "Build reliable TypeScript services backed by PostgreSQL and collaborate with product engineers.";
const initialJob = {
  id: jobId,
  company: "Original Company",
  roleTitle: "Original Role",
  rawDescription: "Maintain reliable backend services with TypeScript and PostgreSQL for customers.",
};

async function mockWorkspace(page: Page, save: (route: Route) => Promise<void>) {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if ((path === "/api/jobs" && method === "POST") ||
        (path === `/api/jobs/${jobId}` && method === "PATCH")) {
      await save(route);
      return;
    }
    let data: unknown = { success: true, data: [] };
    if (path === "/api/demo-config") data = { demoMode: false };
    if (path === "/api/auth/me") {
      data = { data: { id: "settings-return-user", email: "settings-return@example.test", username: "settings-return" } };
    }
    if (path === `/api/jobs/${jobId}`) data = { success: true, data: initialJob };
    if (path === "/api/jobs/extract") {
      data = { success: true, data: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] } };
    }
    await route.fulfill({ json: data });
  });
}

async function pauseAutosave(page: Page) {
  await page.clock.install({ time: new Date("2026-11-17T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-11-17T12:00:01Z"));
}

test("saves immediate edits before Settings navigation and restores the job and tab", async ({ page }) => {
  let releaseSave!: () => void;
  const saveGate = new Promise<void>((resolve) => { releaseSave = resolve; });
  let savedJob = initialJob;
  await mockWorkspace(page, async (route) => {
    savedJob = { ...initialJob, ...route.request().postDataJSON() };
    await saveGate;
    await route.fulfill({ json: { success: true, data: { id: jobId } } });
  });
  await page.route(`**/api/jobs/${jobId}`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: { success: true, data: savedJob } });
  });
  await page.goto("/tailor?tab=job-info");
  await expect(page.getByTestId("jd-textarea")).toBeVisible();
  await pauseAutosave(page);
  await page.getByLabel("Company", { exact: true }).fill("Updated Company");
  await page.getByLabel("Role", { exact: true }).fill("Updated Role");
  await page.getByTestId("jd-textarea").fill(editedDescription);
  await page.getByTestId("tailor-more-tools-trigger").click();
  await page.getByTestId("tailor-tool-overview").click();

  const saveRequest = page.waitForRequest((request) =>
    new URL(request.url()).pathname === "/api/jobs" && request.method() === "POST"
  );
  await page.getByRole("button", { name: "Configure in Settings" }).click();
  await saveRequest;
  await expect(page).toHaveURL(/\/tailor\?tab=overview$/);
  await expect(page.getByRole("button", { name: /Saving/ })).toBeDisabled();
  expect(savedJob).toMatchObject({ company: "Updated Company", roleTitle: "Updated Role", rawDescription: editedDescription });

  releaseSave();
  await page.clock.resume();
  await expect(page).toHaveURL(/\/settings\?/);
  const settingsUrl = new URL(page.url());
  expect(settingsUrl.searchParams.get("jobId")).toBe(jobId);
  expect(settingsUrl.searchParams.get("tab")).toBe("overview");
  await page.getByRole("link", { name: "Back to Tailor" }).click();
  await expect(page.getByTestId("tailor-overview-panel")).toBeVisible();
  await expect(page.locator("#tailor-tool-heading-overview")).toHaveText("Overview");
  await expect(page.getByTestId("tailor-tab-job-info")).toHaveAttribute("aria-selected", "false");
  await expect(page.getByTestId("tailor-tab-3-pane")).toHaveAttribute("aria-selected", "false");
  await page.getByTestId("tailor-tab-job-info").click();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue("Updated Company");
  await expect(page.getByLabel("Role", { exact: true })).toHaveValue("Updated Role");
  await expect(page.getByTestId("jd-textarea")).toHaveValue(editedDescription);
});

test("keeps edits on Tailor when saving an existing job fails", async ({ page }) => {
  await mockWorkspace(page, async (route) => {
    await route.fulfill({ status: 500, json: { success: false, error: "Cannot save this draft right now." } });
  });
  await page.goto(`/tailor?jobId=${jobId}&tab=job-info`);
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(initialJob.company);
  await pauseAutosave(page);
  await page.getByTestId("jd-textarea").fill(editedDescription);
  await page.getByRole("button", { name: "Configure in Settings" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Could not save your job draft" })).toBeVisible();
  await expect(page).toHaveURL((url) =>
    url.pathname === "/tailor" && url.searchParams.get("jobId") === jobId && url.searchParams.get("tab") === "job-info"
  );
  await expect(page.getByTestId("jd-textarea")).toHaveValue(editedDescription);
  await expect(page.getByRole("button", { name: "Configure in Settings" })).toBeEnabled();
});
