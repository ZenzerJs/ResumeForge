import { test, expect } from "@playwright/test";

test.describe("WS5 — Tailor Information Architecture: Overview vs Job Info Views", () => {
  test("5.1 Tabbed segmented navigation toggles between Overview and Job Info views cleanly", async ({
    page,
  }) => {
    await page.goto("/tailor");

    const jobInfoTab = page.getByTestId("tailor-tab-job-info");
    const reviewEditsTab = page.getByTestId("tailor-tab-3-pane");
    const moreToolsTrigger = page.getByTestId("tailor-more-tools-trigger");

    await expect(jobInfoTab).toBeVisible();
    await expect(reviewEditsTab).toBeVisible();
    await expect(moreToolsTrigger).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Tailor views" }).locator('[role="tab"]')).toHaveCount(2);

    // Default initial visit is Job panel for editing/pasting JD
    const jobInfoPanel = page.getByTestId("tailor-job-info-panel");
    await expect(jobInfoPanel).toBeVisible();

    // Switch to Overview via More tools menu
    await moreToolsTrigger.click();
    await page.getByTestId("tailor-tool-overview").click();
    const overviewPanel = page.getByTestId("tailor-overview-panel");
    await expect(overviewPanel).toBeVisible();
    await expect(page.locator("#tailor-tool-heading-overview")).toHaveText("Overview");
    await expect(jobInfoPanel).not.toBeVisible();
    await expect(jobInfoTab).toHaveAttribute("aria-selected", "false");
    await expect(reviewEditsTab).toHaveAttribute("aria-selected", "false");

    // Click Edit job & requirements button in overview card
    const editBtn = page.getByTestId("edit-job-info-btn");
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    await expect(jobInfoPanel).toBeVisible();
    await expect(overviewPanel).not.toBeVisible();

    // Click Back to Overview button
    const backBtn = page.getByTestId("back-to-overview-btn");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toContainText("Back to Overview");
    await backBtn.click();

    await expect(overviewPanel).toBeVisible();
    await expect(jobInfoPanel).not.toBeVisible();

    // Overview shows summary and navigation links without duplicate ATS or Cover Letter sections
    await expect(overviewPanel).toContainText("Tailoring Overview");
    await expect(page.getByTestId("overview-open-workspace-btn")).toBeVisible();
    await expect(page.getByTestId("ats-score-panel")).toHaveCount(0);
    await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(0);

    // Review edits owns the single ATS Score Panel mount
    await reviewEditsTab.click();
    const atsScorePanel = page.getByTestId("ats-score-panel");
    await expect(atsScorePanel).toHaveCount(1);
    await expect(atsScorePanel).toBeVisible();
  });

  test("5.2 Supports ?tab=overview and ?tab=cover-letter search param direct links", async ({ page }) => {
    await page.goto("/tailor?tab=overview");
    const overviewPanel = page.getByTestId("tailor-overview-panel");
    await expect(overviewPanel).toBeVisible();
    await expect(page.locator("#tailor-tool-heading-overview")).toHaveText("Overview");
    await expect(page.getByTestId("tailor-tab-job-info")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("tailor-tab-3-pane")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("tailor-cover-letter-section")).toHaveCount(0);

    await page.goto("/tailor?tab=cover-letter");
    await expect(page.locator("#tailor-tool-heading-cover-letter")).toHaveText("Cover letter");
    await expect(page.locator('#tailor-view-panel[role="tabpanel"]')).toHaveAttribute(
      "aria-labelledby",
      "tailor-tool-heading-cover-letter"
    );
    await expect(page.getByTestId("tailor-tab-job-info")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("tailor-tab-3-pane")).toHaveAttribute("aria-selected", "false");
    await expect(page.getByTestId("tailor-cover-letter-section")).toBeVisible();
  });

  test("5.3 Fresh /tailor does not show back-to-overview-btn", async ({ page }) => {
    await page.goto("/tailor");
    await expect(page.getByTestId("tailor-job-info-panel")).toBeVisible();
    await expect(page.getByTestId("back-to-overview-btn")).not.toBeVisible();
  });
});
