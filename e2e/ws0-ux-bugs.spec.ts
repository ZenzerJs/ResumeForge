import { test, expect } from "@playwright/test";

test.describe("WS0 — UX Bug Fixes & Staged AI Feedback", () => {
  test("0.1 Editor header is visible and not overlapped on 1280x800 and 1440x900", async ({
    page,
  }) => {
    // Test 1280x800
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/editor");

    const header = page.locator("header").first();
    await expect(header).toBeVisible();

    const logo = page.getByLabel("ResumeForge home");
    await expect(logo).toBeVisible();

    const editorLink = page.getByRole("link", { name: "Editor" }).first();
    await expect(editorLink).toBeVisible();

    // Verify header is at top and meets the 48px compact editor chrome budget
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.y).toBe(0);
    expect(headerBox!.height).toBe(48);

    // Test 1440x900 editor chrome budget (48px nav, 40px action row, <= 128px to first paper sheet)
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(header).toBeVisible();
    await expect(logo).toBeVisible();

    const docToolbar = page.getByTestId("workspace-toolbar");
    await expect(docToolbar).toBeVisible();
    const docToolbarBox = await docToolbar.boundingBox();
    expect(docToolbarBox).not.toBeNull();
    expect(docToolbarBox!.height).toBeLessThanOrEqual(42);

    const paperSheet = page
      .locator('[data-testid="panel-preview"] [data-testid="typst-paper-sheet"], [data-testid="panel-preview"] [data-page-slot="1"]')
      .first();
    await expect(paperSheet).toBeVisible({ timeout: 15000 });
    const paperBox = await paperSheet.boundingBox();
    expect(paperBox).not.toBeNull();
    expect(paperBox!.y).toBeLessThanOrEqual(128);

    // Ensure save button exists and check 768px + 390px viewports without clipping or overflow
    const saveBtn = page.getByTestId("save-as-master-btn");
    await expect(saveBtn).toBeVisible();

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(saveBtn).toBeVisible();
    const mdOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(mdOverflow).toBeLessThanOrEqual(1);

    // Test 390px mobile reflow has zero horizontal overflow
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBeLessThanOrEqual(1);
  });

  test("0.2 Visual editor chrome budget, dark Grade overlay, and 404 surface tokens", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/editor?mode=visual");

    await expect(page.getByTestId("save-as-master-btn")).toBeVisible({ timeout: 15000 });

    const header = page.locator("header").first();
    await expect(header).toBeVisible();
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.height).toBe(48);

    const docToolbar = page.getByTestId("workspace-toolbar");
    await expect(docToolbar).toBeVisible();
    const docToolbarBox = await docToolbar.boundingBox();
    expect(docToolbarBox).not.toBeNull();
    expect(docToolbarBox!.height).toBeLessThanOrEqual(42);

    const paperSheet = page
      .locator('[data-testid="panel-preview"] [data-testid="typst-paper-sheet"], [data-testid="panel-preview"] [data-page-slot="1"]')
      .first();
    await expect(paperSheet).toBeVisible({ timeout: 15000 });
    const paperBox = await paperSheet.boundingBox();
    expect(paperBox).not.toBeNull();
    expect(paperBox!.y).toBeLessThanOrEqual(128);

    const gradeToggle = page.getByTestId("grade-resume-btn");
    await expect(gradeToggle).toBeVisible();
    await gradeToggle.click();

    const gradePanel = page.getByTestId("editor-ats-score-overlay");
    await expect(gradePanel).toBeVisible();
    const gradeCard = gradePanel.getByTestId("ats-score-panel");
    await expect(gradeCard).toBeVisible({ timeout: 10000 });
    const gradeBg = await gradeCard.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(gradeBg).toBe("rgb(27, 23, 22)");

    await page.goto("/nonexistent-route-check");
    const notFoundHeading = page.getByRole("heading", { name: "Document Not Found" });
    await expect(notFoundHeading).toBeVisible();
    const notFoundBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(notFoundBg).toBe("rgb(18, 16, 16)");
    const cardBg = await page
      .locator(".bg-panel")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(cardBg).toBe("rgb(27, 23, 22)");
  });

  test("0.3 Landing capability strip is mounted calmly without scrolling marquee", async ({
    page,
  }) => {
    await page.goto("/");
    const marqueeContainer = page.getByTestId("capability-marquee-container");
    await expect(marqueeContainer).toBeVisible();
    await expect(marqueeContainer.locator(".animate-marquee")).toHaveCount(0);

    const marqueeTrack = page.getByTestId("capability-marquee-track");
    await expect(marqueeTrack).toBeVisible();

    // Verify presence of capability items inside static capability strip
    await expect(marqueeTrack.getByText("Typst WASM Engine").first()).toBeVisible();
    await expect(marqueeTrack.getByText("Verified Evidence Bank").first()).toBeVisible();
    await expect(marqueeTrack.getByText("100-Point ATS Rubric").first()).toBeVisible();
  });
});
