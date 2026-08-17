import { test, expect } from "@playwright/test";

test.describe("WS2 — Discover Page Filters, Geocoding & Blended Sorting", () => {
  test("2.1 Discover feed renders interactive filters and blended sorting options", async ({
    page,
  }) => {
    await page.goto("/tracker/feed");

    const searchInput = page.getByTestId("discover-search-input");
    await expect(searchInput).toBeVisible();

    const citySelect = page.getByTestId("discover-city-select");
    await expect(citySelect).toBeVisible();

    // Default city is ALL, so radius select is not mounted yet
    await expect(page.getByTestId("discover-radius-select")).not.toBeVisible();

    // Select Toronto
    await citySelect.selectOption("toronto");

    // Radius select appears
    const radiusSelect = page.getByTestId("discover-radius-select");
    await expect(radiusSelect).toBeVisible();
    await radiusSelect.selectOption("50");

    // Check Salary Select
    const salarySelect = page.getByTestId("discover-salary-select");
    await expect(salarySelect).toBeVisible();

    // Check Sort Select
    const sortSelect = page.getByTestId("discover-sort-select");
    await expect(sortSelect).toBeVisible();
    await sortSelect.selectOption("blended");

    // Check Canada Only toggle
    const canadaToggle = page.getByTestId("discover-canadian-toggle");
    await expect(canadaToggle).toBeVisible();
  });
});
