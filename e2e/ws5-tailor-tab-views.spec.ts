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

    // Right column ATS Score Panel remains visible across both views
    const atsScorePanel = page.getByTestId("ats-score-panel");
    await expect(atsScorePanel).toBeVisible();
  });

  test("5.2 Supports ?tab=overview search param direct link", async ({ page }) => {
    await page.goto("/tailor?tab=overview");
    const overviewPanel = page.getByTestId("tailor-overview-panel");
    await expect(overviewPanel).toBeVisible();
  });
});
