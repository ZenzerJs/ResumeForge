import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { test, expect } from "@playwright/test";

test.describe("Cross-Page Multi-Workspace E2E Journey Tests (Task B2)", () => {
  test("Complete journey: Editor Master Save -> Tailor JD -> Create Variant -> Open Variant in Editor -> Verify Library", async ({
    page,
    request,
  }) => {
    // Seed a verified evidence item before Step 1 so the saved Master Resume factSnapshot includes it
    const evidenceRes = await request.post("/api/evidence", {
      data: {
        type: "experience",
        title: "E2E Cross-Page Verified Impact",
        verifiedSummary: "Verified engineering work for cross-page patch grounding.",
        status: "verified",
        bullets: [{ text: "Engineered distributed workflows cleanly.", verified: true }],
      },
    });
    expect(evidenceRes.ok()).toBeTruthy();
    const evidenceJson = await evidenceRes.json();
    const evidenceId = evidenceJson.data.id as string;

    // Step 1: Open /editor, verify canonical master/fallback document loading, save master resume
    await page.goto("/editor");
    await page.waitForSelector("[data-testid='document-type-badge']", { timeout: 10000 });
    // Wait for document initialization and SVG preview rendering to complete
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    const savePromise = page.waitForResponse(
      (resp) => (resp.url().includes("/api/resumes/save-master") || resp.url().includes("/api/resumes")) && resp.request().method() === "POST" && resp.ok()
    );
    await page.click("button:has-text('Save as Master Resume')");
    await page.click("[data-testid='confirm-save-master-btn']");
    await savePromise;
    await page.waitForSelector("text=Saved as Master!", { timeout: 15000 });
    await expect(page.locator("[data-testid='doc-badge-master']")).toBeVisible();

    // Step 2: Navigate to /tailor, extract requirements and save job
    await page.goto("/tailor");
    await page.waitForSelector("[data-testid='jd-textarea']", { timeout: 10000 });

    await page.click("[data-testid='sample-backend-btn']");
    await page.click("[data-testid='extract-reqs-btn']");
    await page.waitForSelector("[data-testid='req-skill-PostgreSQL']", { timeout: 5000 });

    await page.click("[data-testid='save-job-btn']");
    await page.waitForSelector("text=Job posting saved successfully!", { timeout: 10000 });
    await page.click("[data-testid='tailor-tab-3-pane']");
    await page.waitForSelector("[data-testid='ats-score-panel']", { timeout: 5000 });
    const activeJobId = await page.evaluate(() => sessionStorage.getItem("resumeforge_active_job_id"));

    // Step 3: Create a verified PatchProposalBatch and apply it via strict POST /api/ai/apply-patches
    const resumesRes = await request.get("/api/resumes");
    const resumesJson = await resumesRes.json();
    const master = resumesJson.data.find((r: { isMaster: boolean }) => r.isMaster) || resumesJson.data[0];

    const job = activeJobId
      ? (await (await request.get(`/api/jobs/${activeJobId}`)).json()).data
      : (await (await request.get("/api/jobs")).json()).data[0];

    const typstLines = String(master.typstSource).split(/\r?\n/);
    const targetLine =
      typstLines.find((line) => line.trim().startsWith("- ") && master.typstSource.split(line).length === 2) ??
      typstLines.find((line) => {
        const trimmed = line.trim();
        return trimmed.length > 10 && !trimmed.startsWith("//") && !trimmed.startsWith("#") && master.typstSource.split(line).length === 2;
      });
    expect(targetLine).toBeTruthy();

    const afterLine = targetLine!.trimEnd().endsWith(".")
      ? targetLine!.replace(/\.(\s*)$/, " cleanly.$1")
      : `${targetLine} cleanly`;

    if (!process.env.DATABASE_URL) {
      try {
        process.loadEnvFile?.(".env");
      } catch {
        // Fallback below when .env is absent
      }
      process.env.DATABASE_URL ||= "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge";
    }
    const batchInput = JSON.stringify({
      userId: master.userId,
      masterResumeId: master.id,
      jobId: job.id,
      proposals: [
        {
          id: randomUUID(),
          operation: "MODIFY_BULLET",
          targetSection: "Experience",
          before: targetLine!,
          after: afterLine,
          evidenceIds: [evidenceId],
          rationale: "Verified phrasing adjustment for cross-page E2E journey.",
          confidence: 0.9,
        },
      ],
      gaps: [],
    });
    const batchStdout = execFileSync(
      process.execPath,
      [
        path.resolve("node_modules/tsx/dist/cli.mjs"),
        "-e",
        [
          'import fs from "node:fs";',
          'import { createProposalBatch } from "./src/lib/ai/patch-batches";',
          'import { prisma } from "./src/lib/prisma";',
          '(async () => {',
          '  const input = JSON.parse(fs.readFileSync(0, "utf8"));',
          '  const res = await createProposalBatch(input);',
          '  console.log(JSON.stringify(res));',
          '  await prisma.$disconnect();',
          '})().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });',
        ].join(" "),
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        input: batchInput,
      },
    );
    const proposalBatch = JSON.parse(batchStdout);
    expect(proposalBatch.verified).toHaveLength(1);

    const applyRes = await request.post("/api/ai/apply-patches", {
      data: {
        batchId: proposalBatch.batch.batchId,
        revisionToken: proposalBatch.batch.revisionToken,
        acceptedPatchIds: [proposalBatch.verified[0].id],
        variantTitle: "E2E Cross-Page Tailored Variant",
      },
    });

    const applyJson = await applyRes.json();
    expect(applyRes.status()).toBe(200);
    expect(applyJson.success).toBe(true);
    const createdVariantId = applyJson.data.variantId;

    // Step 4: Direct navigation to /editor with ?variantId= parameter
    await page.goto(`/editor?variantId=${createdVariantId}`);
    await page.waitForSelector("[data-testid='document-type-badge']", { timeout: 10000 });

    // Step 5: Verify /editor loads variant content, displays variant document badge, and compiles preview
    await expect(page.locator("[data-testid='doc-badge-variant']")).toBeVisible();
    const badgeText = await page.locator("[data-testid='doc-badge-variant']").textContent();
    expect(badgeText).toContain("Tailored Variant");

    // Verify preview compiled without error
    await page.waitForSelector(".typst-preview-svg svg", { timeout: 15000 });

    // Step 6: Navigate to /library, verify Evidence Bank workspace loads cleanly
    await page.goto("/library");
    await page.waitForSelector("button:has-text('Add Evidence Item')", { timeout: 10000 });
  });

  test("Invalid variant ID in /editor URL shows recoverable error state", async ({ page }) => {
    await page.goto("/editor?variantId=invalid-variant-uuid-9999");
    await page.waitForSelector("[data-testid='editor-error-state']", { timeout: 10000 });

    const errorText = await page.locator("[data-testid='editor-error-state']").textContent();
    expect(errorText).toContain("ResumeVariant not found");
  });
});
