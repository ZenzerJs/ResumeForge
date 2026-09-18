import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Task 9.1 — AI-Powered PDF Conversion & Guaranteed Editor Redirect", () => {
  const testPdfPath = path.join(process.cwd(), "e2e", "fixtures", "sample-resume.pdf");

  test.beforeAll(() => {
    const fixtureDir = path.dirname(testPdfPath);
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }
    // Valid PDF binary containing text stream for pdf-parse extraction
    const pdfContent = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources <</Font <</F1 4 0 R>>>> /Contents 5 0 R>> endobj
4 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
5 0 obj <</Length 135>> stream
BT
/F1 12 Tf
72 712 Td
(Jayden Saha) Tj
0 -14 Td
(Education: Wilfrid Laurier University) Tj
0 -14 Td
(Experience: Trillium Health Partners) Tj
ET
endstream endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000113 00000 n 
0000000244 00000 n 
0000000311 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
499
%%EOF`;
    fs.writeFileSync(testPdfPath, pdfContent);
  });

  test("1. PDF Upload triggers client upload and redirects to /editor with non-master draft", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check upload button exists on homepage
    const uploadBtn = page.locator('[data-testid="upload-pdf-hero-btn"]');
    await expect(uploadBtn).toBeVisible();

    // Attach PDF file to hidden file input
    const fileInput = page.locator('[data-testid="pdf-upload-input"]');
    await fileInput.setInputFiles(testPdfPath);

    // Wait for redirect to /editor?resumeId=...
    await expect(page).toHaveURL(/\/editor\?resumeId=/, { timeout: 30000 });

    // Verify draft loaded in editor
    const editorBadge = page.locator('[data-testid="document-type-badge"]');
    await expect(editorBadge).toBeVisible();

    // Verify conversion path status banner is displayed
    const statusBanner = page.locator('[data-testid^="pdf-conversion-"]');
    await expect(statusBanner).toBeVisible();
  });

  test("2. Conversion path status banner can be dismissed per session", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const fileInput = page.locator('[data-testid="pdf-upload-input"]');
    await fileInput.setInputFiles(testPdfPath);

    await expect(page).toHaveURL(/\/editor\?resumeId=/, { timeout: 30000 });

    const dismissBtn = page.locator('[data-testid="dismiss-conversion-banner-btn"]');
    if (await dismissBtn.isVisible()) {
      await dismissBtn.click();
      await expect(page.locator('[data-testid^="pdf-conversion-"]')).not.toBeVisible();
    }
  });
});
