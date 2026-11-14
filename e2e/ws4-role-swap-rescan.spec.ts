import { test, expect } from "@playwright/test";

test.describe("WS4 — Tailor Auto-Rescan & Target Role Profile Swap", () => {
  test("4.1 Header renders target role profile switcher and updates ATS evaluation", async ({
    page,
  }) => {
    await page.goto("/tailor");

    const profileSelect = page.getByTestId("tailor-role-profile-select");
    await expect(profileSelect).toBeVisible();

    // Select Frontend profile
    await profileSelect.selectOption("Frontend");
    await expect(profileSelect).toHaveValue("Frontend");

    // Select AI/LLM profile
    await profileSelect.selectOption("AI/LLM");
    await expect(profileSelect).toHaveValue("AI/LLM");

    // Check ATS score panel is visible
    const atsScorePanel = page.getByTestId("ats-score-panel");
    await expect(atsScorePanel).toBeVisible();

    // Switch to Full-stack profile via header selector and verify ATS panel updates
    await profileSelect.selectOption("Full-stack");
    await expect(profileSelect).toHaveValue("Full-stack");
    await expect(atsScorePanel).toContainText("Role-Relevant Evidence (Full-stack)");
  });
});
