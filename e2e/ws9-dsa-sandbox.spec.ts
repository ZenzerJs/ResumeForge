import { test, expect } from "@playwright/test";

test.describe("WS9 In-Browser DSA Execution Sandbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/interview/dsa");
  });

  test("1. renders default problem Two Sum, constraints, and starter code", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Two Sum");

    const problemSelect = page.locator('[data-testid="dsa-problem-select"]');
    await expect(problemSelect).toBeVisible();
    await expect(problemSelect).toHaveValue("two-sum");

    // Constraints & description
    await expect(page.locator("text=Constraints")).toBeVisible();
    await expect(page.locator("body")).toContainText("Only one valid answer exists");

    // Starter code editor
    const editor = page.locator('[data-testid="dsa-code-editor"]');
    await expect(editor).toBeVisible();
    const code = await editor.inputValue();
    expect(code).toContain("function twoSum");
  });

  test("2. ranks and displays recommended problems with match reasons from JD", async ({ page }) => {
    const jdInput = page.locator('[data-testid="dsa-jd-filter-input"]');
    await expect(jdInput).toBeVisible();

    await jdInput.fill(
      "Senior Distributed Systems Engineer with expertise in graph traversal, scheduling algorithms, and database key-value caching."
    );

    await page.click('[data-testid="dsa-jd-recommend-btn"]');

    const matchReasons = page.locator('[data-testid="dsa-match-reason"]');
    await expect(matchReasons.first()).toBeVisible({ timeout: 5000 });

    const reasonCount = await matchReasons.count();
    expect(reasonCount).toBeGreaterThanOrEqual(1);

    const firstReasonText = await matchReasons.first().textContent();
    expect(firstReasonText?.length).toBeGreaterThan(15);
  });

  test("3. reveals Tier 1 hint on clicking hint toggle", async ({ page }) => {
    const hintContent = page.locator('[data-testid="dsa-hint-content-0"]');
    await expect(hintContent).not.toBeVisible();

    const hintBtn = page.locator('[data-testid="dsa-hint-btn-0"]');
    await expect(hintBtn).toBeVisible();
    await hintBtn.click();

    await expect(hintContent).toBeVisible();
    await expect(hintContent).toContainText("complement");
  });

  test("4. executes valid solution for Two Sum and displays Accepted", async ({ page }) => {
    const validSolution = `function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) {
      return [map.get(diff), i];
    }
    map.set(nums[i], i);
  }
  return [];
}`;

    const editor = page.locator('[data-testid="dsa-code-editor"]');
    await editor.fill(validSolution);

    await page.click('[data-testid="dsa-run-btn"]');

    const statusBadge = page.locator('[data-testid="dsa-execution-status"]');
    await expect(statusBadge).toContainText("Accepted", { timeout: 10000 });
    await expect(statusBadge).toContainText("4 / 4 Passed");
  });

  test("5. captures console.log stdout and displays Wrong Answer on incorrect output", async ({ page }) => {
    const wrongSolutionWithLog = `function twoSum(nums, target) {
  console.log("debug trace target is", target);
  return [0, 0];
}`;

    const editor = page.locator('[data-testid="dsa-code-editor"]');
    await editor.fill(wrongSolutionWithLog);

    await page.click('[data-testid="dsa-run-btn"]');

    const statusBadge = page.locator('[data-testid="dsa-execution-status"]');
    await expect(statusBadge).toContainText("Wrong Answer", { timeout: 10000 });

    const stdoutOutput = page.locator('[data-testid="dsa-stdout-output"]');
    await expect(stdoutOutput).toBeVisible();
    await expect(stdoutOutput).toContainText("debug trace target is 9");

    const actualOutput = page.locator('[data-testid="dsa-test-actual"]');
    await expect(actualOutput).toContainText("[0,0]");
  });
});
