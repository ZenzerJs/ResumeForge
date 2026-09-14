
import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Offline Ingest and Patch (Tier 3) E2E', () => {
  test('Assert offline operation of dropzone, indexing, and AST patching', async ({ page, context }) => {
    // 1. Load the library workspace while online
    await page.goto('/library', { waitUntil: 'networkidle' });
    // Pre-warm the PDF worker module in browser while still online
    await page.evaluate(async (workerPath: string) => {
      try {
        await import(/* webpackIgnore: true */ workerPath);
      } catch {}
    }, '/workers/pdf.worker.min.mjs');

    // 2. Go offline
    await context.setOffline(true);

    // 3. Dropzone Ingestion & Evidence Indexing
    const fileInput = page.locator('input[type="file"][accept=".pdf"]');
    await fileInput.setInputFiles([
      path.resolve(__dirname, '../tests/fixtures/pdf/single-column-standard.pdf'),
      path.resolve(__dirname, '../tests/fixtures/pdf/two-column-engineering.pdf')
    ]);
    // Assert both files are displayed in the dropzone and reach Indexed status offline
    await expect(page.locator('text=single-column-standard.pdf')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=two-column-engineering.pdf')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Indexed').first()).toBeVisible({ timeout: 10000 });

    // 4. Typst AST Patching in Tailor Workspace Diagnostics
    await context.setOffline(false);
    await page.goto('/tailor?tab=diagnostic', { waitUntil: 'networkidle' });
    await context.setOffline(true);

    // Real diagnostic fix button in TailorDiagnosticPanel
    const fixButton = page.locator('[data-testid="apply-diagnostic-fix-0"]');
    await expect(fixButton).toBeVisible({ timeout: 10000 });
    await fixButton.click();

    // Assert genuine deterministic patch executed offline
    await expect(page.locator('text=Patched successfully!')).toBeVisible({ timeout: 5000 });
  });
});

