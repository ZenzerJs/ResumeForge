import { test, expect } from "@playwright/test";
import JSZip from "jszip";
import crypto from "crypto";

test.describe("ZIP Export Application Package E2E Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test("exports valid Application Package .zip with manifest, pdf, docx, txt and verified SHA-256 hashes", async ({
    page,
  }) => {
    // Wait for editor and preview to initialize
    await page.waitForSelector('[data-testid="export-dropdown-btn"]', { timeout: 15000 });

    // Trigger export dropdown
    await page.click('[data-testid="export-dropdown-btn"]');
    await page.waitForSelector('[data-testid="export-zip-menu-item"]', { state: "visible" });

    // Listen for browser download event
    const downloadPromise = page.waitForEvent("download");
    await page.click('[data-testid="export-zip-menu-item"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain("Application_Package.zip");

    // Read download stream into Buffer
    const stream = await download.createReadStream();
    if (!stream) {
      throw new Error("Failed to read download stream");
    }

    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const zipBuffer = Buffer.concat(chunks);
    expect(zipBuffer.length).toBeGreaterThan(500);

    // Inspect ZIP package with JSZip
    const zip = await JSZip.loadAsync(zipBuffer);

    // 1. Verify required files exist
    expect(zip.file("manifest.json")).not.toBeNull();
    expect(zip.file("resume.pdf")).not.toBeNull();
    expect(zip.file("resume.docx")).not.toBeNull();
    expect(zip.file("resume.txt")).not.toBeNull();
    expect(zip.file("resume.typ")).not.toBeNull();
    expect(zip.file("application_summary.txt")).not.toBeNull();

    // 2. Validate PDF signature (%PDF-)
    const pdfBytes = await zip.file("resume.pdf")?.async("uint8array");
    expect(pdfBytes).toBeDefined();
    const pdfHeader = String.fromCharCode(...pdfBytes!.slice(0, 5));
    expect(pdfHeader).toBe("%PDF-");

    // 3. Validate DOCX is a valid zip package containing word/document.xml
    const docxBytes = await zip.file("resume.docx")?.async("uint8array");
    expect(docxBytes).toBeDefined();
    const docxZip = await JSZip.loadAsync(docxBytes!);
    expect(docxZip.file("word/document.xml")).not.toBeNull();

    // 4. Validate application summary and secret-pattern scanning
    const summaryText = (await zip.file("application_summary.txt")?.async("string")) || "";
    expect(summaryText).toContain("APPLICATION PACKAGE SUMMARY");

    const secretPatterns = [
      /sk-ant-[a-zA-Z0-9_-]+/,
      /sk-proj-[a-zA-Z0-9_-]+/,
      /AIza[0-9A-Za-z-_]{35}/,
      /Bearer\s+[a-zA-Z0-9._-]+/,
      /postgresql:\/\/[^\s]+/,
    ];

    secretPatterns.forEach((pat) => {
      expect(summaryText).not.toMatch(pat);
    });

    // 5. Validate manifest.json cryptographic integrity and mediaType metadata
    const manifestStr = (await zip.file("manifest.json")?.async("string")) || "";
    const manifest = JSON.parse(manifestStr);

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.generator).toBe("ResumeForge Multi-Format Exporter v1.0");
    expect(manifest.guardrailStatus).toBe("passed");
    expect(manifest.integrityNote).toContain("tamper-evident verification");
    expect(Array.isArray(manifest.artifacts)).toBe(true);
    expect(manifest.artifacts.length).toBeGreaterThanOrEqual(5);

    // Verify SHA-256 hash and mediaType match for each artifact in the zip
    for (const art of manifest.artifacts) {
      const fileInZip = zip.file(art.name);
      expect(fileInZip).not.toBeNull();
      const content = await fileInZip!.async("uint8array");
      const computedHash = crypto.createHash("sha256").update(content).digest("hex");
      expect(art.sha256).toBe(computedHash);
      expect(art.byteLength).toBe(content.length);
      expect(art.mediaType).toBeDefined();
    }
  });
});
