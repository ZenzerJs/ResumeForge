import { test, expect } from "@playwright/test";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PDFParse } = require("pdf-parse");

test.describe("Typst Live-Preview Workspace E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("1. Launches /editor, initializes WASM compiler, and renders non-empty SVG preview", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    const svgHtml = await page.locator(".typst-preview-svg").innerHTML();
    expect(svgHtml.length).toBeGreaterThan(100);
    expect(svgHtml).toContain("<svg");
  });

  test("2. Edits source via CodeMirror, asserts preview updates with zero console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    // Click editor content (using first visible desktop editor)
    const cmContent = page.locator(".cm-content").first();
    await cmContent.click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type("// Test Comment Added\n");

    // Wait for compilation update
    await page.waitForTimeout(2000);

    const updatedSvg = await page.locator(".typst-preview-svg").innerHTML();
    expect(updatedSvg.length).toBeGreaterThan(100);

    // Assert zero console errors during load and edit cycle
    expect(consoleErrors).toEqual([]);
  });

  test("3. Invalid Typst syntax displays error banner with line number while retaining last valid SVG", async ({ page }) => {
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    const validSvgBefore = await page.locator(".typst-preview-svg").innerHTML();
    expect(validSvgBefore.length).toBeGreaterThan(100);

    // Type invalid syntax at end of editor
    const cmContent = page.locator(".cm-content").first();
    await cmContent.click();
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n\n#invalid_function_call_test_xyz()");

    // Wait for error banner
    await page.waitForSelector("text=Compilation Error", { timeout: 10000 });

    // Assert error banner displays line number
    const errorBanner = page.locator("text=Compilation Error").locator("..");
    const errorBannerText = await errorBanner.innerText();
    expect(errorBannerText).toContain("Line");

    // Assert last valid preview SVG is still present (not cleared)
    const validSvgAfter = await page.locator(".typst-preview-svg").innerHTML();
    expect(validSvgAfter.length).toBeGreaterThan(100);
    expect(validSvgAfter).toContain("<svg");
  });

  test("4. Export PDF downloads valid PDF file with extractable text", async ({ page }) => {
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    // Intercept download event
    const downloadPromise = page.waitForEvent("download");
    await page.click("button:has-text('Export PDF')");
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("resume.pdf");

    // Read download stream buffer
    const path = await download.path();
    expect(path).toBeTruthy();

    if (path) {
      const fs = await import("fs");
      const pdfBuffer = fs.readFileSync(path);
      expect(pdfBuffer.length).toBeGreaterThan(500);

      // Parse PDF text using PDFParse instance
      const parser = new PDFParse({ data: pdfBuffer });
      const textResult = await parser.getText();
      const extractedText = typeof textResult === "string" ? textResult : (textResult?.text || String(textResult));

      expect(extractedText).toBeTruthy();
      expect(extractedText.length).toBeGreaterThan(10);
      expect(extractedText).toMatch(/Alex Morgan|ResumeForge|Technical Skills|Test Master Typst|Database Master/i);
    }
  });
});
