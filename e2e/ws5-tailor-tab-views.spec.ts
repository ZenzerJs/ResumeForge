import { test, expect } from "@playwright/test";

test.describe("WS5 — Tailor Information Architecture: Overview vs Job Info Views", () => {
  test("5.1 Tabbed segmented navigation toggles between Overview and Job Info views cleanly", async ({
    page,
  }) => {
    await page.goto("/tailor");

    const overviewTab = page.getByTestId("tailor-tab-overview");
    const jobInfoTab = page.getByTestId("tailor-tab-job-info");

    await expect(overviewTab).toBeVisible();
    await expect(jobInfoTab).toBeVisible();

    // Default initial visit is Job Info panel for editing/pasting JD
    const jobInfoPanel = page.getByTestId("tailor-job-info-panel");
    await expect(jobInfoPanel).toBeVisible();

    // Switch to Overview tab
    await overviewTab.click();
    const overviewPanel = page.getByTestId("tailor-overview-panel");
    await expect(overviewPanel).toBeVisible();
    await expect(jobInfoPanel).not.toBeVisible();

    // Click Edit Job & Reqs button in overview card
    const editBtn = page.getByTestId("edit-job-info-btn");
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    await expect(jobInfoPanel).toBeVisible();
    await expect(overviewPanel).not.toBeVisible();

    // Click Back to Overview button
    const backBtn = page.getByTestId("back-to-overview-btn");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    await expect(overviewPanel).toBeVisible();
    await expect(jobInfoPanel).not.toBeVisible();

    // Overview shows summary and navigation links without duplicate ATS or Cover Letter sections
    await expect(overviewPanel).toContainText("Tailoring Overview");
    await expect(page.getByTestId("overview-open-workspace-btn")).toBeVisible();
    await expect(page.getByTestId("ats-score-panel")).toHaveCount(0);
    await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(0);

    // Workspace (3-pane) owns the single ATS Score Panel mount
    await page.getByTestId("tailor-tab-3-pane").click();
    const atsScorePanel = page.getByTestId("ats-score-panel");
    await expect(atsScorePanel).toHaveCount(1);
    await expect(atsScorePanel).toBeVisible();
  });

  test("5.2 Supports ?tab=overview and ?tab=cover-letter search param direct links", async ({ page }) => {
    await page.goto("/tailor?tab=overview");
    const overviewPanel = page.getByTestId("tailor-overview-panel");
    await expect(overviewPanel).toBeVisible();
    await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(0);

    await page.goto("/tailor?tab=cover-letter");
    await expect(page.getByTestId("tailor-tab-cover-letter")).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("tailor-cover-letter-section")).toBeVisible();
  });
});
