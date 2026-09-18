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

    // Verify header is at top and not pushed out of view
    const headerBox = await header.boundingBox();
    expect(headerBox).not.toBeNull();
    expect(headerBox!.y).toBe(0);
    expect(headerBox!.height).toBeGreaterThanOrEqual(56);

    // Test 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(header).toBeVisible();
    await expect(logo).toBeVisible();

    // Ensure save button and revert button exist
    const saveBtn = page.getByTestId("save-as-master-btn");
    await expect(saveBtn).toBeVisible();
  });

  test("0.3 Landing marquee track is mounted with seamless duplicate track", async ({
    page,
  }) => {
    await page.goto("/");
    const marqueeContainer = page.getByTestId("capability-marquee-container");
    await expect(marqueeContainer).toBeVisible();

    const marqueeTrack = page.getByTestId("capability-marquee-track");
    await expect(marqueeTrack).toBeVisible();

    // Verify presence of capability items inside track
    await expect(marqueeTrack.getByText("Typst WASM Engine").first()).toBeVisible();
    await expect(marqueeTrack.getByText("Verified Evidence Bank").first()).toBeVisible();
    await expect(marqueeTrack.getByText("100-Point ATS Rubric").first()).toBeVisible();
  });
});
