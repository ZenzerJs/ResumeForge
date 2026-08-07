import { test, expect } from "@playwright/test";

test.describe("Phase 4 BYOK AI Gateway Settings UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("renders settings page with generic custom provider label", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Bring-Your-Own-Key (BYOK) AI Configuration");

    const providerSelect = page.locator("#provider-select");
    await expect(providerSelect).toBeVisible();

    // Verify generic option label
    const customOptionText = await providerSelect.locator("option[value='custom']").textContent();
    expect(customOptionText).toContain("Custom OpenAI-compatible endpoint");
    expect(customOptionText).not.toMatch(/freellmapi|ollama|lm studio/i);
  });

  test("handles key entry and test connection interaction safely", async ({ page }) => {
    const fakeKey = "sk-proj-testkey1234567890abcdef";

    // Fill in API key
    await page.fill("#api-key-input", fakeKey);

    // Verify key input type is password
    await expect(page.locator("#api-key-input")).toHaveAttribute("type", "password");

    // Click test connection button
    await page.click("#test-connection-btn");

    // Wait for response banner to appear
    const banner = page.locator("#test-result-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });

    // Assert raw key is NEVER present in page text/DOM output
    const pageText = await page.innerText("body");
    expect(pageText).not.toContain(fakeKey);
  });
});
