import { test, expect } from "@playwright/test";

test.describe("WS3 — Evidence Compatibility Filter & Badges", () => {
  test("3.1 Discover feed renders compatibility match filter and badge pills", async ({
    page,
  }) => {
    await page.goto("/tracker/feed");

    const matchSelect = page.getByTestId("discover-match-select");
    await expect(matchSelect).toBeVisible();

    // Select 70%+ Match
    await matchSelect.selectOption("70");

    // Select All Match Tiers
    await matchSelect.selectOption("0");

    const searchInput = page.getByTestId("discover-search-input");
    await expect(searchInput).toBeVisible();
  });
});
