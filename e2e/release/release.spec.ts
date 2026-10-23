import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

type Fixture = { email: string; password: string; userId: string; jobId: string; masterResumeId: string; foreignJobId: string; foreignEmail: string; sharedJobId: string; batch: { batch: { batchId: string; revisionToken: string; baseTypstSource: string; jobId: string; masterResumeId: string }; verified: Array<{ id: string; after: string }>; gaps: unknown[] } };
async function fixture(): Promise<Fixture> {
  const runDir = process.env.RELEASE_E2E_RUN_DIR;
  if (!runDir) throw new Error("Release runner did not provide fixture location.");
  return JSON.parse(await readFile(path.join(runDir, "persistent.json"), "utf8")) as Fixture;
}

async function login(page: import("@playwright/test").Page, credentials: { email: string; password: string }) {
  await page.goto("/");
  const result = await page.evaluate(async (input) => {
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    return { status: response.status, body: await response.json() };
  }, credentials);
  expect(result.status).toBe(200);
}

async function downloadAndRead(page: import("@playwright/test").Page, selector: string) {
  await page.locator('[data-testid="export-dropdown-btn"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator(`[data-testid="${selector}"]`).click();
  const download = await downloadPromise;
  const filePath = await download.path();
  expect(filePath).toBeTruthy();
  return { filename: download.suggestedFilename(), bytes: await readFile(filePath!) };
}

function normalizeExportText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

async function saveWalkthroughScreenshot(page: import("@playwright/test").Page, filename: string) {
  const directory = process.env.RELEASE_E2E_ARTIFACT_DIR || path.join(process.env.RELEASE_E2E_RUN_DIR || path.resolve("test-results"), "walkthrough");
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: path.join(directory, filename) });
}

test.describe("@persistent browser-bound proposal flow", () => {
  test("accepts one proposal, rejects another, compiles the exact preview, and reloads citations", async ({ page }) => {
    test.setTimeout(120_000);
    const seeded = await fixture();
    await page.addInitScript(() => localStorage.setItem("resumeforge_ai_settings", JSON.stringify({ provider: "gemini", apiKey: "release-test-only-not-a-provider-key" })));
    let generatedPatchIds: string[] = [];
    await page.route("**/api/ai/generate-patches", async (route) => {
      const refreshed = execFileSync(process.execPath, [path.resolve("node_modules/tsx/dist/cli.mjs"), path.resolve("e2e/release/refresh-batch.ts")], {
        cwd: process.cwd(), encoding: "utf8", env: process.env,
      });
      const data = JSON.parse(refreshed) as typeof seeded.batch & { masterResumeId: string };
      generatedPatchIds = data.verified.map((patch) => patch.id);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { ...data, rejected: [] } }) });
    });
    await login(page, { email: seeded.email, password: seeded.password });
    await page.goto(`/tailor?jobId=${seeded.jobId}`);
    await expect(page.locator('[data-testid="generate-patches-btn"]')).toBeVisible();
    const tracker = await page.evaluate(async (foreignJobId) => {
      const response = await fetch("/api/jobs?q=Viewer%20Outcome%20Catalog%20Sentinel&limit=100");
      const body = await response.json();
      const jobs = (body.data || []) as Array<{ id: string; status: string }>;
      const foreignJob = jobs.find((job) => job.id === foreignJobId);
      return { status: response.status, foreignJob };
    }, seeded.foreignJobId);
    expect(tracker.status).toBe(200);
    expect(tracker.foreignJob).toMatchObject({ id: seeded.foreignJobId, status: "SAVED" });
    const safety = await page.evaluate(async (batch) => {
      const staleResponse = await fetch("/api/ai/apply-patches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId: batch.batch.batchId, revisionToken: "0".repeat(64), acceptedPatchIds: [batch.verified[0].id], acknowledgedSkills: [], variantTitle: "Stale attempt" }) });
      const forgedResponse = await fetch("/api/ai/apply-patches", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ batchId: batch.batch.batchId, revisionToken: batch.batch.revisionToken, acceptedPatchIds: [crypto.randomUUID()], acknowledgedSkills: [], variantTitle: "Forged attempt" }) });
      const overwriteResponse = await fetch("/api/resumes/save-master", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ typstSource: batch.batch.baseTypstSource }) });
      const overwrite = await overwriteResponse.json();
      return { stale: staleResponse.status, forged: forgedResponse.status, overwrite: overwriteResponse.status, overwriteError: overwrite.error };
    }, seeded.batch);
    expect(safety).toMatchObject({ stale: 409, forged: 409, overwrite: 400 });
    expect(safety.overwriteError).toMatch(/Confirmation required/i);
    const generateResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/ai/generate-patches") && response.request().method() === "POST");
    await page.locator('[data-testid="generate-patches-btn"]').click();
    const generateResponse = await generateResponsePromise;
    expect(generateResponse.status()).toBe(200);
    const generated = await generateResponse.json();
    expect(generated.data.verified.map((patch: { id: string }) => patch.id)).toEqual(generatedPatchIds);
    await page.getByRole("tab", { name: "3-Pane Workspace" }).click();
    await expect(page.locator('[data-testid="patch-diff-review"]')).toBeVisible();
    const first = generated.data.verified[0] as { id: string; after: string };
    const second = generated.data.verified[1] as { id: string; after: string };
    await expect(page.locator(`[data-testid="patch-card-${first.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="patch-card-${second.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="patch-card-${first.id}"]`)).toContainText(first.after);
    await page.locator(`[data-testid="accept-patch-${first.id}"]`).click();
    await page.locator(`[data-testid="reject-patch-${second.id}"]`).click();
    const applyResponse = page.waitForResponse((response) => response.url().includes("/api/ai/apply-patches") && response.request().method() === "POST");
    await page.locator('[data-testid="apply-patches-btn"]').click();
    const response = await applyResponse;
    const applyBody = await response.json();
    expect(response.status(), JSON.stringify(applyBody)).toBe(200);
    const saved = applyBody.data as { variantId: string; typstContent: string };
    expect(saved.typstContent).toContain(first.after);
    expect(saved.typstContent).not.toContain(second.after);
    await expect(page.locator('[data-testid="apply-success"]')).toBeVisible();
    const reloaded = await page.evaluate(async (variantId) => {
      const response = await fetch(`/api/variants/${variantId}`);
      return { status: response.status, body: await response.json() };
    }, saved.variantId);
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.data.typstContent).toBe(saved.typstContent);
    expect(reloaded.body.data.patches).toHaveLength(1);
    expect(reloaded.body.data.patches[0].citations.length).toBeGreaterThanOrEqual(2);
    await page.goto(`/editor?variantId=${saved.variantId}`);
    await expect(page.locator('[data-testid="document-type-badge"]')).toBeVisible();
    const savedEditorSource = page.getByTestId("panel-code").locator(".cm-content");
    await expect(savedEditorSource).toContainText(first.after);
    await expect(savedEditorSource).not.toContainText(second.after);
    await expect(page.locator('[data-testid="typst-preview-svg"]')).toBeVisible({ timeout: 30_000 });
    await saveWalkthroughScreenshot(page, "persistent_variant_reloaded.png");
    const pdf = await downloadAndRead(page, "export-pdf-menu-item");
    expect(pdf.filename.toLowerCase()).toContain(".pdf");
    expect(pdf.bytes.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    const pdfParser = new PDFParse({ data: pdf.bytes });
    try {
      const pdfText = normalizeExportText((await pdfParser.getText()).text);
      expect(pdfText).toContain(normalizeExportText(first.after));
      expect(pdfText).not.toContain(normalizeExportText(second.after));
    } finally {
      await pdfParser.destroy();
    }
    const docx = await downloadAndRead(page, "export-docx-menu-item");
    expect(docx.filename.toLowerCase()).toContain(".docx");
    const docxZip = await JSZip.loadAsync(docx.bytes);
    const docxXml = await docxZip.file("word/document.xml")!.async("text");
    const docxText = normalizeExportText(docxXml.replace(/<[^>]+>/g, ""));
    expect(docxText).toContain(normalizeExportText(first.after));
    expect(docxText).not.toContain(normalizeExportText(second.after));
    const bundle = await downloadAndRead(page, "export-zip-menu-item");
    expect(bundle.filename.toLowerCase()).toContain(".zip");
    const bundleZip = await JSZip.loadAsync(bundle.bytes);
    const bundleText = await bundleZip.file("resume.txt")!.async("text");
    expect(normalizeExportText(bundleText)).toContain(normalizeExportText(first.after));
    expect(normalizeExportText(bundleText)).not.toContain(normalizeExportText(second.after));
    const evidenceFlow = await page.evaluate(async (source) => {
      const create = await fetch("/api/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "experience", title: "Release Draft Evidence", organization: "Example Co", verifiedSummary: "Resolved customer questions.", status: "draft", bullets: [{ text: "Resolved customer questions.", verified: false }] }) });
      const created = await create.json();
      const evidenceId = created.data.id as string;
      const verify = await fetch(`/api/evidence/${evidenceId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "verified", bullets: [{ text: "Resolved customer questions.", verified: true }] }) });
      const verified = await verify.json();
      const freeze = await fetch("/api/resumes/save-master", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ typstSource: source, confirmOverwrite: true }) });
      const frozen = await freeze.json();
      return { create: create.status, verify: verify.status, freeze: freeze.status, status: verified.data.status, hasFact: frozen.data.factSnapshot.evidenceIds.includes(evidenceId) };
    }, seeded.batch.batch.baseTypstSource);
    expect(evidenceFlow).toEqual({ create: 201, verify: 200, freeze: 200, status: "verified", hasFact: true });
    const status = await page.evaluate(async (jobId) => {
      const update = await fetch(`/api/jobs/${jobId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "APPLIED" }) });
      const read = await fetch(`/api/jobs/${jobId}`);
      return { update: update.status, read: read.status, body: await read.json() };
    }, seeded.jobId);
    expect(status.update).toBe(200);
    expect(status.read).toBe(200);
    expect(status.body.data.status).toBe("APPLIED");
    const primaryShared = await page.evaluate(async (jobId) => {
      const response = await fetch(`/api/jobs/${jobId}`);
      return { status: response.status, body: await response.json() };
    }, seeded.sharedJobId);
    expect(primaryShared.body.data.status).toBe("APPLIED");
    const browser = page.context().browser();
    if (!browser) throw new Error("Release test requires a browser context.");
    const foreignContext = await browser.newContext({ baseURL: process.env.RELEASE_E2E_BASE_URL });
    const foreignPage = await foreignContext.newPage();
    await login(foreignPage, { email: seeded.foreignEmail, password: seeded.password });
    const isolatedOutcome = await foreignPage.evaluate(async (sharedJobId) => {
      const sharedResponse = await fetch(`/api/jobs/${sharedJobId}`);
      return await sharedResponse.json();
    }, seeded.sharedJobId);
    expect(isolatedOutcome.data.status).toBe("INTERVIEWING");
    await foreignContext.close();
  });
});

test.describe("@persistent release import and exports", () => {
  test("imports the synthetic PDF fixture and redirects to a draft editor", async ({ page }) => {
    const seeded = await fixture();
    await login(page, { email: seeded.email, password: seeded.password });
    await expect(page.locator('[data-testid="upload-pdf-hero-btn"]')).toBeVisible();
    await page.locator('[data-testid="pdf-upload-input"]').setInputFiles(path.resolve("e2e/fixtures/sample-resume.pdf"));
    await expect(page).toHaveURL(/\/editor\?resumeId=/, { timeout: 30_000 });
    await expect(page.locator('[data-testid="document-type-badge"]')).toBeVisible();
    const resumeId = new URL(page.url()).searchParams.get("resumeId");
    const imported = await page.evaluate(async (id) => {
      const response = await fetch(`/api/resumes/${id}`);
      return { status: response.status, body: await response.json() };
    }, resumeId);
    expect(imported.status).toBe(200);
    expect(imported.body.data.title).toBe("sample-resume");
    expect(imported.body.data.typstSource).toContain("Alex Rivera");
    expect(imported.body.data.typstSource).toContain("Northwind Health Systems");
  });
});test.describe("@demo visitor boundaries", () => {
  test("reports local BYOK mode and refuses signup plus persistent writes even with a signed cookie", async ({ page }) => {
    const demoFixture = await fixture();
    await page.goto("/");
    const config = await page.request.get("/api/demo-config");
    expect(config.ok()).toBeTruthy();
    expect(await config.json()).toMatchObject({ demoMode: true, signupEnabled: false, persistence: "browser-local", ai: "visitor-byok" });
    const signup = await page.evaluate(async () => {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "visitor@resumeforge.test", username: "visitor_demo", password: "NotARealAccount123!" }) });
      return { status: response.status, body: await response.json() };
    });
    expect(signup.status).toBe(403);
    expect(signup.body).toMatchObject({ code: "DEMO_SIGNUP_DISABLED" });
    const login = await page.evaluate(async (credentials) => {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(credentials) });
      return { status: response.status, body: await response.json() };
    }, { email: demoFixture.email, password: demoFixture.password });
    expect(login.status).toBe(200);
    const write = await page.evaluate(async () => {
      const response = await fetch("/api/evidence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "experience", title: "Visitor", verifiedSummary: "Local only", status: "verified" }) });
      return { status: response.status, body: await response.json() };
    });
    expect(write.status).toBe(401);
    expect(write.body).toMatchObject({ code: "GUEST_READ_ONLY" });
    await page.goto("/tailor?jobId=demo-sample-job");
    await page.locator('[data-testid="generate-patches-btn"]').click();
    await expect(page.getByText(/No AI provider configured\. Please configure your API key in Settings\./)).toBeVisible();
    const seededLocal = await page.evaluate(() => ({
      source: localStorage.getItem("resumeforge_typst_source"),
      evidence: JSON.parse(localStorage.getItem("resumeforge_guest_evidence") || "[]"),
      jobs: JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]"),
      facts: localStorage.getItem("resumeforge_demo_master_facts"),
    }));
    expect(seededLocal.source).toContain("Synthetic sample.");
    expect(seededLocal.evidence.length).toBeGreaterThan(0);
    expect(seededLocal.jobs).toHaveLength(1);
    expect(seededLocal.facts).toBeTruthy();
    await page.reload();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("Synthetic sample.");
    await page.goto("/tracker");
    const sampleStatus = page.getByTestId("job-status-select-demo-sample-job");
    await expect(sampleStatus).toBeVisible();
    await sampleStatus.selectOption("APPLIED");
    await expect.poll(async () => page.evaluate(() => {
      const jobs = JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]");
      return jobs.find((job: { id: string }) => job.id === "demo-sample-job")?.status;
    })).toBe("APPLIED");
    await page.reload();
    await expect(page.getByTestId("job-status-select-demo-sample-job")).toHaveValue("APPLIED");
    await page.goto("/editor");
    const sourceEditor = page.getByTestId("panel-code").locator(".cm-content");
    await expect(sourceEditor).toBeVisible();
    await sourceEditor.fill("= Personal Resume\n\n== Experience\n- My own draft content.");
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("My own draft content.");
    const personalState = await page.evaluate(() => ({
      source: localStorage.getItem("resumeforge_typst_source"),
      evidence: JSON.parse(localStorage.getItem("resumeforge_guest_evidence") || "[]"),
      jobs: JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]"),
      facts: localStorage.getItem("resumeforge_demo_master_facts"),
    }));
    expect(personalState.source).toContain("My own draft content.");
    expect(personalState.evidence).toHaveLength(0);
    expect(personalState.jobs).toHaveLength(0);
    expect(personalState.facts).toBeNull();
    await page.reload();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("My own draft content.");
    const browser = page.context().browser();
    if (!browser) throw new Error("Release test requires a browser context.");
    const importContext = await browser.newContext({ baseURL: process.env.RELEASE_E2E_BASE_URL });
    const importPage = await importContext.newPage();
    await importPage.goto("/tailor");
    await expect.poll(async () => importPage.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("Synthetic sample.");
    await importPage.goto("/");
    await expect(importPage.locator('[data-testid="upload-pdf-hero-btn"]')).toBeVisible();
    const demoImportResponse = importPage.waitForResponse((response) => response.url().endsWith("/api/resumes/upload-pdf") && response.request().method() === "POST");
    await importPage.locator('[data-testid="pdf-upload-input"]').setInputFiles(path.resolve("e2e/fixtures/sample-resume.pdf"));
    const demoImport = await demoImportResponse;
    expect(demoImport.status()).toBe(200);
    const demoImportBody = await demoImport.json();
    expect(demoImportBody).toMatchObject({ success: true, persistence: "browser-local" });
    expect(demoImportBody.data).not.toHaveProperty("id");
    expect(demoImportBody.data.typstSource).toContain("Alex Rivera");
    await expect.poll(async () => importPage.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("Alex Rivera");
    const importedLocal = await importPage.evaluate(() => ({
      source: localStorage.getItem("resumeforge_typst_source"),
      evidence: JSON.parse(localStorage.getItem("resumeforge_guest_evidence") || "[]"),
      jobs: JSON.parse(localStorage.getItem("resumeforge_guest_jobs") || "[]"),
      facts: localStorage.getItem("resumeforge_demo_master_facts"),
    }));
    expect(importedLocal.source).toContain("Northwind Health Systems");
    expect(importedLocal.evidence).toHaveLength(0);
    expect(importedLocal.jobs).toHaveLength(0);
    expect(importedLocal.facts).toBeNull();
    await importPage.reload();
    await expect.poll(async () => importPage.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("Northwind Health Systems");
    await importContext.close();
  });

  test("applies a deterministic verified proposal to browser-local sample state", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("resumeforge_ai_settings", JSON.stringify({ provider: "gemini", apiKey: "release-test-only-not-a-provider-key" })));
    await page.goto("/editor");
    await expect(page.locator('[data-testid="typst-preview-svg"]')).toBeVisible({ timeout: 30_000 });
    await saveWalkthroughScreenshot(page, "demo_sample_preview.png");
    let applyApiCalls = 0;
    await page.route("**/api/ai/apply-patches", async (route) => {
      if (route.request().method() === "POST") applyApiCalls += 1;
      await route.continue();
    });
    let generationCount = 0;
    let secondGenerationSource: string | undefined;
    await page.route("**/api/demo/generate-patches", async (route) => {
      generationCount += 1;
      if (generationCount === 2) {
        const requestBody = route.request().postDataJSON() as { masterTypst?: string };
        secondGenerationSource = requestBody.masterTypst;
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { verified: [], rejected: [], gaps: [{ requirement: "Second-generation check", severity: "MINOR", recommendation: "The updated local draft remains the source for the next proposal." }], masterResumeId: null, demo: true, sampleData: true } }) });
        return;
      }
      const proposal = {
        id: "release-demo-proposal",
        operation: "MODIFY_BULLET",
        targetSection: "projects",
        before: "Built a fictional task board as a sample project using TypeScript.",
        after: "Built a fictional task board with TypeScript.",
        evidenceIds: ["demo-sample-evidence-project", "demo-sample-bullet-project"],
        rationale: "Condenses the existing fictional sample project bullet.",
        confidence: 1,
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { verified: [proposal], rejected: [], gaps: [], masterResumeId: null, demo: true, sampleData: true } }) });
    });
    await page.goto("/tailor?jobId=demo-sample-job");
    await expect(page.locator('[data-testid="generate-patches-btn"]')).toBeVisible();
    const generationResponse = page.waitForResponse((response) => response.url().endsWith("/api/demo/generate-patches") && response.request().method() === "POST");
    await page.locator('[data-testid="generate-patches-btn"]').click();
    expect((await generationResponse).status()).toBe(200);
    await page.getByRole("tab", { name: "3-Pane Workspace" }).click();
    await expect(page.locator('[data-testid="patch-diff-review"]')).toBeVisible();
    await page.locator('[data-testid="accept-patch-release-demo-proposal"]').click();
    await page.locator('[data-testid="apply-patches-btn"]').click();
    const localSuccess = page.locator('[data-testid="apply-success"]');
    await expect(localSuccess).toBeVisible();
    await expect(localSuccess).toContainText("saved in this browser");
    await expect(localSuccess).not.toContainText("saved to the database");
    await saveWalkthroughScreenshot(page, "demo_patch_applied_locally.png");
    const applied = await page.evaluate(() => localStorage.getItem("resumeforge_typst_source"));
    expect(applied).toContain("Built a fictional task board with TypeScript.");
    expect(applied).not.toContain("Built a fictional task board as a sample project using TypeScript.");
    expect(applyApiCalls).toBe(0);
    await page.reload();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem("resumeforge_typst_source"))).toContain("Built a fictional task board with TypeScript.");
    expect(applyApiCalls).toBe(0);
    const secondGenerationResponse = page.waitForResponse((response) => response.url().endsWith("/api/demo/generate-patches") && response.request().method() === "POST");
    await page.locator('[data-testid="generate-patches-btn"]').click();
    expect((await secondGenerationResponse).status()).toBe(200);
    expect(secondGenerationSource).toContain("Built a fictional task board with TypeScript.");
    expect(secondGenerationSource).not.toContain("Built a fictional task board as a sample project using TypeScript.");
    expect(applyApiCalls).toBe(0);
  });
});
