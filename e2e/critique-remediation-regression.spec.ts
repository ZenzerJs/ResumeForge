import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test, expect, type Browser, type Locator, type Page } from "@playwright/test";
import {
  buildResumeDocument,
  renderResumeDocument,
  type ResumeAssignment,
} from "../src/lib/typst/resume-document";

const ARTIFACT_DIR = path.join(process.cwd(), "test-results", "critique-remediation");
const DISTINCTIVE_PHRASE = "Orchestrated deterministic telemetry pipelines across twelve clusters";

const SYNTHETIC_MASTER_SOURCE = `// ResumeForge Canonical Resume Template (Typst)
#set page(paper: "us-letter", margin: (x: 1.25cm, y: 1.1cm))
#set text(font: "Libertinus Serif", size: 9.5pt, fill: rgb("#111827"))

= Morgan Example
Boston, MA | #link("mailto:morgan@example.test")[morgan\\@example.test] | (555) 010-2000

== Experience
*Northwind Labs* — Software Engineer (2023 - Present)
- Built distributed backend workflows using TypeScript and PostgreSQL.
- Maintained automated integration test suites for core services.

== Skills
- Languages: TypeScript, SQL
`;

function buildManagedResumeSource(options?: { twoPages?: boolean }): string {
  const rows: Array<[ResumeAssignment["kind"], string]> = [
    ["name", "Morgan Example"],
    ["contact", "Boston, MA"],
    ["contact", "morgan@example.test"],
    ["contact", "(555) 010-2000"],
    ["contact", "github.com/morgan-example"],
    ["contact", "linkedin.com/in/morgan-example"],
    ["section", "Experience"],
    ["entry-title", "Northwind Labs"],
    ["entry-role", "Senior Platform Engineer"],
    ["entry-location", "Boston, MA"],
    ["entry-date", "2023 - Present"],
    ["bullet", "- Built distributed TypeScript services backed by PostgreSQL across regional clusters."],
    ["bullet", "- Reduced tail p99 query latency by 42% through batched connection pooling."],
  ];

  if (options?.twoPages) {
    for (let entry = 1; entry <= 7; entry++) {
      rows.push(["entry-title", `Synthetic Org ${entry}`]);
      rows.push(["entry-role", `Platform Engineer ${entry}`]);
      rows.push(["entry-location", "Toronto, ON"]);
      rows.push(["entry-date", `20${15 + entry} - 20${16 + entry}`]);
      for (let b = 1; b <= 5; b++) {
        rows.push([
          "bullet",
          `- Engineered resilient microservice component ${entry}.${b} with automated observability, schema verification, and deterministic rollout controls across distributed worker pools.`,
        ]);
      }
    }
  } else {
    rows.push(["entry-title", "Contoso Systems"]);
    rows.push(["entry-role", "Software Engineer"]);
    rows.push(["entry-location", "Remote"]);
    rows.push(["entry-date", "2021 - 2023"]);
    rows.push(["bullet", "- Authored TypeScript build tooling and CI checks for monorepo services."]);
  }

  rows.push(["section", "Skills"]);
  rows.push(["skill", "Languages: TypeScript, SQL, Go"]);

  const raw = rows.map((r) => r[1]).join("\n");
  let offset = 0;
  const assignments: ResumeAssignment[] = rows.map(([kind, text]) => {
    const start = offset;
    offset += text.length + 1;
    return { kind, span: { start, end: start + text.length } };
  });
  const doc = buildResumeDocument(raw, assignments);
  return renderResumeDocument(doc, "balanced");
}

function buildFittableTwoPageManagedSource(): string {
  const rows: Array<[ResumeAssignment["kind"], string]> = [
    ["name", "Morgan Example"],
    ["contact", "Boston, MA"],
    ["contact", "morgan@example.test"],
    ["contact", "(555) 010-2000"],
    ["section", "Experience"],
    ["entry-title", "Northwind Labs"],
    ["entry-role", "Senior Platform Engineer"],
    ["entry-location", "Boston, MA"],
    ["entry-date", "2023 - Present"],
    ["bullet", "- Built distributed TypeScript services backed by PostgreSQL across regional clusters."],
    ["bullet", "- Reduced tail p99 query latency by 42% through batched connection pooling."],
    ["bullet", "- Standardized observability tracing across worker pools with deterministic schemas."],
    ["bullet", "- Hardened automated rollout checks across multi-region deployment pipelines."],
  ];

  for (let entry = 1; entry <= 4; entry++) {
    rows.push(["entry-title", `Synthetic Org ${entry}`]);
    rows.push(["entry-role", `Platform Engineer ${entry}`]);
    rows.push(["entry-location", "Toronto, ON"]);
    rows.push(["entry-date", `20${17 + entry} - 20${18 + entry}`]);
    for (let b = 1; b <= 4; b++) {
      rows.push([
        "bullet",
        `- Engineered resilient microservice component ${entry}.${b} with automated observability, schema verification, and deterministic rollout controls across distributed worker pools.`,
      ]);
    }
  }

  rows.push(["section", "Skills"]);
  rows.push(["skill", "Languages: TypeScript, SQL, Go"]);

  const raw = rows.map((r) => r[1]).join("\n");
  let offset = 0;
  const assignments: ResumeAssignment[] = rows.map(([kind, text]) => {
    const start = offset;
    offset += text.length + 1;
    return { kind, span: { start, end: start + text.length } };
  });
  const doc = buildResumeDocument(raw, assignments);
  const comfortableSource = renderResumeDocument(doc, "comfortable");
  const hash = createHash("sha256").update(comfortableSource).digest("hex");
  return `// @layout-two-pages-approved: ${hash}\n${comfortableSource}`;
}

function buildSyntheticPdfBuffer(lines: string[]): Buffer {
  const ops = ["BT", "/F1 11 Tf", "72 720 Td", "16 TL"];
  for (const line of lines) {
    ops.push(`(${line.replace(/[()\\]/g, "\\$&")}) Tj T*`);
  }
  ops.push("ET");
  const stream = ops.join("\n");
  const objs = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function inspectPdf(pdfPath: string): { numPages: number; text: string } {
  const script = `
    import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
    import { readFile } from "node:fs/promises";
    const task = pdfjs.getDocument({ data: new Uint8Array(await readFile(process.argv[1])), disableFontFace: true });
    const doc = await task.promise;
    const chunks = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      chunks.push(content.items.filter((item) => item.str).map((item) => item.str).join(" "));
    }
    const numPages = doc.numPages;
    await task.destroy();
    process.stdout.write(JSON.stringify({ numPages, text: chunks.join("\\n") }));
  `;
  return JSON.parse(
    execFileSync(process.execPath, ["--input-type=module", "-e", script, pdfPath], {
      encoding: "utf8",
    })
  ) as { numPages: number; text: string };
}

async function expectHitTestable(locator: Locator, label: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, `${label}: visible`).toBeVisible();
  const hit = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return target !== null && (el === target || el.contains(target));
  });
  expect(hit, `${label}: hit-testable via elementFromPoint`).toBe(true);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const dims = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    vw: document.documentElement.clientWidth,
  }));
  expect(dims.sw, `${label}: scrollWidth <= clientWidth`).toBeLessThanOrEqual(dims.vw + 1);
}

async function createIsolatedUserContext(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `e2e-reg-${suffix}@resumeforge.test`;
  const username = `e2ereg_${suffix}`;
  const password = "playwright-test-secret";
  const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
    data: { email, username, password },
  });
  expect(signup.ok()).toBeTruthy();
  return { context, page, email, username };
}

test.describe("Critique Remediation E2E Regression Suite", () => {
  test("1. Application continuity: Jobs Role A -> Evidence/Editor/Settings returns, global nav detour, save failure/retry, reload, explicit Role B, and Home new job", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await createIsolatedUserContext(browser, baseURL);
    try {
      await mkdir(ARTIFACT_DIR, { recursive: true });
      const roleARes = await page.request.post(`${baseURL}/api/jobs`, {
        data: {
          company: "Synthetic Alpha Corp",
          roleTitle: "Principal Platform Engineer",
          rawDescription: "Build distributed TypeScript services backed by PostgreSQL and Kubernetes.",
          source: "pasted",
          personal: true,
        },
      });
      expect(roleARes.ok()).toBeTruthy();
      const roleA = (await roleARes.json()).data as { id: string; roleTitle: string; company: string };

      const roleBRes = await page.request.post(`${baseURL}/api/jobs`, {
        data: {
          company: "Synthetic Beta Labs",
          roleTitle: "Frontend Systems Engineer",
          rawDescription: "Build accessible React and TypeScript interfaces for design tools.",
          source: "pasted",
          personal: true,
        },
      });
      expect(roleBRes.ok()).toBeTruthy();
      const roleB = (await roleBRes.json()).data as { id: string; roleTitle: string; company: string };

      // Start from Jobs (/tracker) and open Role A in Tailor
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/tracker");
      await expect(page.getByTestId(`tailor-resume-btn-${roleA.id}`)).toBeVisible({ timeout: 15000 });
      await page.getByTestId(`tailor-resume-btn-${roleA.id}`).click();
      await expect(page).toHaveURL(new RegExp(`/tailor\\?jobId=${roleA.id}`));
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Principal Platform Engineer");
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Synthetic Alpha Corp");

      // Edit JD, force one save failure before navigating to Settings, verify retry succeeds
      const updatedDesc = "Build distributed TypeScript services backed by PostgreSQL, Kubernetes, and observability pipelines.";
      await page.getByTestId("jd-textarea").fill(updatedDesc);
      let failOnce = true;
      await page.route(`**/api/jobs/${roleA.id}`, async (route) => {
        if (route.request().method() === "PATCH" && failOnce) {
          failOnce = false;
          await route.fulfill({ status: 500, json: { success: false, error: "Synthetic save failure" } });
          return;
        }
        await route.continue();
      });

      await page.getByRole("button", { name: "Configure in Settings" }).first().click();
      const retryBtn = page.getByRole("button", { name: /Retry save & continue/i });
      await expect(retryBtn).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("jd-textarea")).toHaveValue(updatedDesc);

      await retryBtn.click();
      await expect(page).toHaveURL(new RegExp(`/settings\\?.*jobId=${roleA.id}`));
      await page.getByTestId("settings-back-to-tailor-link").click();
      await expect(page).toHaveURL(new RegExp(`/tailor\\?.*jobId=${roleA.id}`));
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Principal Platform Engineer");
      await expect(page.getByTestId("jd-textarea")).toHaveValue(updatedDesc);

      // Detour to Evidence Bank via visible Tailor control and return
      const libraryAction = page
        .locator('[data-testid="tailor-readiness"] button:has-text("Open Evidence Bank"), button:has-text("Verify evidence")')
        .first();
      await expect(libraryAction).toBeVisible();
      await libraryAction.click();
      await expect(page).toHaveURL(new RegExp(`/library\\?.*jobId=${roleA.id}`));
      await expect(page.getByTestId("library-back-to-tailor-link")).toBeVisible();
      await page.getByTestId("library-back-to-tailor-link").click();
      await expect(page).toHaveURL(new RegExp(`/tailor\\?.*jobId=${roleA.id}`));
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Principal Platform Engineer");

      // Detour to Editor via visible Tailor control and return
      const editorAction = page
        .locator('button:has-text("Save a master"), button:has-text("Save in Editor"), button:has-text("Open resume draft")')
        .first();
      await expect(editorAction).toBeVisible();
      await editorAction.click();
      await expect(page).toHaveURL(new RegExp(`/editor\\?.*jobId=${roleA.id}`));
      await expect(page.getByTestId("editor-back-to-tailor-link")).toContainText("Back to Tailor");
      await page.getByTestId("editor-back-to-tailor-link").click();
      await expect(page).toHaveURL(new RegExp(`/tailor\\?.*jobId=${roleA.id}`));
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Principal Platform Engineer");

      // Global nav detour (Practice -> Tailor) preserves Role A without reselection
      await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Practice" }).click();
      await expect(page).toHaveURL(/\/practice/);
      await page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Tailor" }).click();
      await expect(page).toHaveURL(new RegExp(`/tailor\\?.*jobId=${roleA.id}`));
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Principal Platform Engineer");

      // Reload preserves Role A
      await page.reload();
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Principal Platform Engineer");

      // Explicit link to Role B from Jobs replaces stored Role A
      await page.goto("/tracker");
      await expect(page.getByTestId(`tailor-resume-btn-${roleB.id}`)).toBeVisible({ timeout: 15000 });
      await page.getByTestId(`tailor-resume-btn-${roleB.id}`).click();
      await expect(page).toHaveURL(new RegExp(`/tailor\\?jobId=${roleB.id}`));
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Frontend Systems Engineer");

      // Fresh start from Home empty entry (?new=1) clears active Role B
      await page.goto("/");
      await page.getByTestId("hero-start-tailoring-btn").click();
      await expect(page).toHaveURL(/\/tailor\?new=1/);
      await expect(page.getByTestId("jd-textarea")).toHaveValue("");
      await expect(page.getByTestId("active-job-header-banner")).toContainText("Untitled role");
    } finally {
      await context.close();
    }
  });

  test("2. Truthful deliverable: review synthetic cited change, inspect source, accept, apply, open variant in Editor, export PDF with accepted phrase & unchanged master", async ({
    browser,
    baseURL,
  }) => {
    const { context, page } = await createIsolatedUserContext(browser, baseURL);
    try {
      await mkdir(ARTIFACT_DIR, { recursive: true });
      const evRes = await page.request.post(`${baseURL}/api/evidence`, {
        data: {
          type: "experience",
          title: "Synthetic Telemetry Cluster Lead",
          organization: "Northwind Labs",
          dates: "2023 - Present",
          verifiedSummary: DISTINCTIVE_PHRASE,
          status: "verified",
          bullets: [{ text: DISTINCTIVE_PHRASE, verified: true }],
        },
      });
      expect(evRes.ok()).toBeTruthy();
      const evidenceId = (await evRes.json()).data.id as string;

      const masterRes = await page.request.post(`${baseURL}/api/resumes/save-master`, {
        data: {
          title: "Synthetic Master Resume",
          typstSource: SYNTHETIC_MASTER_SOURCE,
          confirmOverwrite: true,
        },
      });
      expect(masterRes.ok()).toBeTruthy();
      const master = (await masterRes.json()).data as { id: string; userId: string; typstSource: string };

      const jobRes = await page.request.post(`${baseURL}/api/jobs`, {
        data: {
          company: "Synthetic Alpha Corp",
          roleTitle: "Principal Platform Engineer",
          rawDescription: "TypeScript, PostgreSQL, telemetry pipelines, and distributed backend systems.",
          source: "pasted",
          personal: true,
        },
      });
      expect(jobRes.ok()).toBeTruthy();
      const job = (await jobRes.json()).data as { id: string };

      const beforeLine = "- Built distributed backend workflows using TypeScript and PostgreSQL.";
      const afterLine = `- ${DISTINCTIVE_PHRASE}.`;
      const patchId = randomUUID();

      // Create a real DB-backed PatchProposalBatch so POST /api/ai/apply-patches validates and persists against Postgres
      const batchInput = JSON.stringify({
        userId: master.userId,
        masterResumeId: master.id,
        jobId: job.id,
        proposals: [
          {
            id: patchId,
            operation: "MODIFY_BULLET",
            targetSection: "Experience",
            before: beforeLine,
            after: afterLine,
            evidenceIds: [evidenceId],
            rationale: "Grounds telemetry impact using verified evidence.",
            confidence: 0.94,
          },
        ],
        gaps: [{ requirement: "Rust", severity: "MODERATE", recommendation: "Add verified Rust evidence if applicable." }],
      });

      let verifiedPatchId = "";
      await page.route("**/api/ai/generate-patches", async (route) => {
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
          { cwd: process.cwd(), encoding: "utf8", input: batchInput }
        );
        const proposalBatch = JSON.parse(batchStdout) as {
          verified: Array<{ id: string }>;
          rejected: unknown[];
          gaps: unknown[];
          batch: { batchId: string; revisionToken: string; baseTypstSource: string; jobId: string; evidenceRevision?: string };
        };
        expect(proposalBatch.verified).toHaveLength(1);
        verifiedPatchId = proposalBatch.verified[0].id;
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            data: {
              ...proposalBatch,
              masterResumeId: master.id,
            },
          },
        });
      });

      await page.addInitScript(() => {
        localStorage.setItem("resumeforge_ai_settings", JSON.stringify({ provider: "gemini", apiKey: "synthetic-e2e-key" }));
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(`/tailor?jobId=${job.id}`);
      await expect(page.getByTestId("generate-patches-btn")).toBeVisible({ timeout: 15000 });
      await page.getByTestId("generate-patches-btn").click();
      await page.getByTestId("tailor-tab-3-pane").click();

      // Inspect source citation details before accepting
      await expect.poll(() => verifiedPatchId, { timeout: 15000 }).not.toBe("");
      const patchCard = page.getByTestId(`patch-card-${verifiedPatchId}`);
      await expect(patchCard).toBeVisible({ timeout: 15000 });
      await expect(patchCard).toContainText("evidence match");
      const citationDetails = page.getByTestId(`citation-details-${verifiedPatchId}`);
      await citationDetails.locator("summary").click();
      await expect(citationDetails).toHaveAttribute("open", "");
      await expect(citationDetails).toContainText("Synthetic Telemetry Cluster Lead");
      await expect(citationDetails).toContainText(evidenceId);

      // Accept and apply via real POST /api/ai/apply-patches
      await page.getByTestId(`accept-patch-${verifiedPatchId}`).click();
      const applyBtn = page.getByTestId("apply-patches-btn");
      await expect(applyBtn).toBeEnabled();
      await applyBtn.click();
      await expect(page.getByTestId("apply-success")).toBeVisible({ timeout: 15000 });

      // Open resulting variant through UI
      const openVariantBtn = page.getByTestId("open-variant-in-editor-btn");
      await expect(openVariantBtn).toBeVisible();
      await openVariantBtn.click();
      await expect(page).toHaveURL(/\/editor\?.*variantId=/);
      await expect(page.getByTestId("doc-badge-variant")).toBeVisible({ timeout: 15000 });
      await expect(page.locator(".typst-preview-svg svg").first()).toBeVisible({ timeout: 25000 });

      // Export PDF and verify accepted phrase & page count
      const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await page.getByTestId("export-dropdown-btn").first().click();
      await page.getByTestId("export-pdf-menu-item").click();
      const download = await downloadPromise;
      const pdfPath = path.join(ARTIFACT_DIR, "tailored-variant.pdf");
      await download.saveAs(pdfPath);
      const parsed = inspectPdf(pdfPath);
      expect(parsed.numPages).toBe(1);
      expect(parsed.text).toContain(DISTINCTIVE_PHRASE);

      // Verify master resume remains unchanged
      await page.goto("/editor");
      await expect(page.getByTestId("doc-badge-master")).toBeVisible({ timeout: 15000 });
      const masterResAfter = await page.request.get(`${baseURL}/api/resumes`);
      const masterAfter = (await masterResAfter.json()).data.find((r: { isMaster: boolean }) => r.isMaster);
      expect(masterAfter.typstSource).not.toContain(DISTINCTIVE_PHRASE);
      expect(masterAfter.typstSource).toContain(beforeLine);
    } finally {
      await context.close();
    }
  });

  test("3. Editor breakpoints (390x844, 768x1024, 1440x900, 200% zoom), Fit/Export hit targets, 1-page + 2-page approval, accessible fields, and legacy smoke test", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const twoPageManaged = buildManagedResumeSource({ twoPages: true });
    const onePageManaged = buildManagedResumeSource({ twoPages: false });

    // Isolate managed V2 source in localStorage + GET /api/resumes mock so master DB stays clean
    await page.route("**/api/resumes", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: { success: true, data: [] } });
      } else {
        await route.continue();
      }
    });
    await page.addInitScript((src) => {
      localStorage.setItem("resumeforge_typst_source", src);
    }, twoPageManaged);

    // 1440x900 with Tailor return context: 32px toolbar and white-sheet top <= 128px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/editor?from=tailor&tab=overview&jobId=synthetic-role-a");
    await expect(page.getByTestId("layout-page-preview").locator("img[data-page-rendered='true']").first()).toBeVisible({ timeout: 30000 });
    const desktopMetrics = await page.evaluate(() => {
      const toolbar = document.querySelector("[data-testid='preview-pane-toolbar']")!;
      const sheet = document.querySelector("[data-testid='layout-page-preview'] [data-page-slot='1'], [data-testid='layout-page-preview'] img")!;
      return {
        toolbarH: Math.round(toolbar.getBoundingClientRect().height),
        sheetTopY: Math.round(sheet.getBoundingClientRect().top),
      };
    });
    expect(desktopMetrics.toolbarH).toBe(32);
    expect(desktopMetrics.sheetTopY).toBeLessThanOrEqual(128);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "editor-1440-v2.png") });

    // 390x844 and 768x1024 multipage managed resume: Fit to one page vs Export non-overlap, hit areas, focus, 2-page approval
    for (const vp of [
      { name: "390x844", width: 390, height: 844 },
      { name: "768x1024", width: 768, height: 1024 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await expect(page.getByTestId("document-type-badge")).toBeVisible();
      if (vp.width === 390) {
        await page.getByTestId("editor-tab-editor").click();
        await page.getByTestId("editor-mode-code").first().click();
        await expect(page.getByTestId("mobile-editor-orientation-bar")).toBeVisible();
        await expect(page.getByTestId("mobile-orientation-visual-btn")).toBeVisible();
        await page.getByTestId("mobile-orientation-preview-btn").click();
      } else {
        await page.getByTestId("editor-tab-preview").click();
      }
      await expect(page.getByTestId("layout-page-status")).toContainText("2 pages measured", { timeout: 30000 });

      const fitToOneBtn = page.getByRole("button", { name: "Fit to one page" }).first();
      const exportBtn = page.getByTestId("export-dropdown-btn").first();
      await expectHitTestable(fitToOneBtn, `Fit to one page@${vp.name}`);
      await expectHitTestable(exportBtn, `Export@${vp.name}`);

      const overlap = await page.evaluate(() => {
        const fit = Array.from(document.querySelectorAll("button")).find((b) =>
          b.textContent?.includes("Fit to one page")
        )?.getBoundingClientRect();
        const exp = document.querySelector("[data-testid='export-dropdown-btn']")?.getBoundingClientRect();
        if (!fit || !exp) return null;
        return fit.left < exp.right && exp.left < fit.right && fit.top < exp.bottom && exp.top < fit.bottom;
      });
      expect(overlap, `Fit to one page must not overlap Export at ${vp.name}`).toBe(false);

      await fitToOneBtn.focus();
      await expect(fitToOneBtn).toBeFocused();
      await exportBtn.focus();
      await expect(exportBtn).toBeFocused();
      await assertNoHorizontalOverflow(page, `/editor@${vp.name}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, `editor-${vp.name}-v2.png`) });
    }

    // 200% zoom equivalent (640x450)
    await page.setViewportSize({ width: 640, height: 450 });
    await assertNoHorizontalOverflow(page, "/editor@200%-zoom");

    // 2-page export approval flow at 390x844
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("export-dropdown-btn").first().click();
    await page.getByTestId("export-pdf-menu-item").click();
    await expect(page.getByTestId("export-error-recovery-banner")).toContainText("Use two pages");
    await page.getByRole("button", { name: "Use two pages" }).first().click();
    await expect(page.getByTestId("layout-page-status")).toContainText("✓", { timeout: 30000 });
    const twoPageDl = page.waitForEvent("download", { timeout: 30000 });
    await page.getByTestId("export-dropdown-btn").first().click();
    await page.getByTestId("export-pdf-menu-item").click();
    const twoPageFile = path.join(ARTIFACT_DIR, "managed-two-page.pdf");
    await (await twoPageDl).saveAs(twoPageFile);
    expect(inspectPdf(twoPageFile).numPages).toBe(2);

    // Visual Form accessible labels, invalid blank blur persistence, removal, and save/reload
    const visualPage = await page.context().newPage();
    await visualPage.route("**/api/resumes", async (route) => {
      if (route.request().method() === "GET") await route.fulfill({ json: { success: true, data: [] } });
      else await route.continue();
    });
    await visualPage.setViewportSize({ width: 1280, height: 800 });
    await visualPage.goto("/editor");
    await visualPage.evaluate((src) => {
      localStorage.setItem("resumeforge_typst_source", src);
      localStorage.setItem("resumeforge_migration_dismissed", "true");
    }, onePageManaged);
    await visualPage.goto("/editor?mode=visual");
    await expect(visualPage.getByTestId("managed-resume-form")).toBeVisible({ timeout: 15000 });
    await expect(visualPage.getByRole("textbox", { name: "Full name", exact: true })).toHaveValue("Morgan Example");
    await expect(visualPage.getByRole("textbox", { name: "Email", exact: true })).toHaveValue("morgan@example.test");
    await expect(visualPage.getByRole("textbox", { name: "Phone", exact: true })).toHaveValue("(555) 010-2000");
    await expect(visualPage.getByRole("textbox", { name: "Location", exact: true })).toHaveValue("Boston, MA");

    // Clearing required Full name keeps blank value visible + role="alert" on blur
    const fullName = visualPage.getByRole("textbox", { name: "Full name", exact: true });
    await fullName.fill("");
    await fullName.blur();
    await expect(fullName).toHaveValue("");
    await expect(visualPage.locator("[data-testid='managed-resume-form'] [role='alert']").first()).toContainText("Full name is required");
    await fullName.fill("Morgan Example");
    await fullName.blur();

    // Explicit removal of optional Phone field + valid edit to Location persisted across reload
    await visualPage.getByRole("button", { name: "Remove Phone", exact: true }).click();
    await expect(visualPage.getByRole("textbox", { name: "Phone", exact: true })).toHaveCount(0);
    await visualPage.getByRole("textbox", { name: "Location", exact: true }).fill("Montreal, QC");
    await visualPage.getByRole("textbox", { name: "Location", exact: true }).blur();
    await expect.poll(() => visualPage.evaluate(() => localStorage.getItem("resumeforge_typst_source") || "")).toContain("Montreal, QC");

    // Reload and verify removal + Location edit survive
    await visualPage.reload();
    await expect(visualPage.getByTestId("managed-resume-form")).toBeVisible({ timeout: 15000 });
    await expect(visualPage.getByRole("textbox", { name: "Phone", exact: true })).toHaveCount(0);
    await expect(visualPage.getByRole("textbox", { name: "Location", exact: true })).toHaveValue("Montreal, QC");

    // Verify 1-page eligible managed export
    await expect(visualPage.getByTestId("layout-page-status")).toContainText("1 page measured", { timeout: 30000 });
    const onePageDl = visualPage.waitForEvent("download", { timeout: 30000 });
    await visualPage.getByTestId("export-dropdown-btn").first().click();
    await visualPage.getByTestId("export-pdf-menu-item").click();
    const onePageFile = path.join(ARTIFACT_DIR, "managed-one-page.pdf");
    await (await onePageDl).saveAs(onePageFile);
    expect(inspectPdf(onePageFile).numPages).toBe(1);
    expect(inspectPdf(onePageFile).text).toContain("Montreal, QC");

    // Legacy free-form editor smoke test
    await visualPage.evaluate((src) => {
      localStorage.setItem("resumeforge_typst_source", src);
    }, SYNTHETIC_MASTER_SOURCE);
    await visualPage.goto("/editor");
    await expect(visualPage.locator(".cm-content").first()).toBeVisible({ timeout: 15000 });
    await expect(visualPage.locator(".typst-preview-svg svg").first()).toBeVisible({ timeout: 25000 });
    const legacyDl = visualPage.waitForEvent("download", { timeout: 30000 });
    await visualPage.getByTestId("export-dropdown-btn").first().click();
    await visualPage.getByTestId("export-pdf-menu-item").click();
    const legacyPdf = path.join(ARTIFACT_DIR, "legacy-freeform.pdf");
    await (await legacyDl).saveAs(legacyPdf);
    expect((await readFile(legacyPdf)).subarray(0, 5).toString()).toBe("%PDF-");
    await visualPage.close();
  });

  test("4. Navigation, titles across 10 routes, provider-unavailable Settings, Library/Tracker mobile, Kanban REJECTED stage, and duplicate vs distinct postings", async ({
    browser,
  }) => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    try {
      // Simulate AI status unavailable + guest
      await page.route("**/api/ai/status", (route) => route.fulfill({ status: 500, json: { error: "Unavailable" } }));
      await page.route("**/api/auth/me", (route) => route.fulfill({ json: { data: null, guest: true } }));
      await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: false } }));

      const routes = [
        "/",
        "/editor",
        "/library",
        "/tracker",
        "/tailor",
        "/settings",
        "/practice",
        "/tracker/feed",
        "/tracker/saved",
        "/tracker/applied",
        "/tracker/outcomes",
      ];
      await page.setViewportSize({ width: 1280, height: 800 });
      for (const r of routes) {
        await page.goto(r, { waitUntil: "domcontentloaded" });
        const title = await page.title();
        const matches = title.match(/ResumeForge/g) ?? [];
        expect(matches.length, `Route ${r} title "${title}" has duplicate brand suffix`).toBeLessThanOrEqual(1);
        await expect(page.getByTestId("nav-settings-link")).toBeVisible();
      }
      await page.getByTestId("nav-settings-link").focus();
      await expect(page.getByTestId("nav-settings-link")).toBeFocused();

      // Mobile nav exposes named Settings + Library PageHeader/select ergonomics at 390x844
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/library", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Open menu" }).click();
      await expect(page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Settings" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expectHitTestable(page.getByRole("button", { name: /Add Evidence Item/i }), "Library Add Evidence@390");
      await expectHitTestable(page.getByTestId("evidence-status-filter"), "Library Status Filter@390");
      await assertNoHorizontalOverflow(page, "/library@390x844");

      // Tracker duplicate source collapse + 2 distinct same-title postings
      const duplicateJobsPayload = [
        {
          id: "job-dup-1",
          company: "Acme Corp",
          roleTitle: "Platform Engineer",
          source: "greenhouse",
          status: "SAVED",
          createdAt: "2026-11-17T00:00:00.000Z",
          notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/101",
          rawDescription: "Role 101",
          extractedRequirements: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] },
        },
        {
          id: "job-dup-2",
          company: "Acme Corp",
          roleTitle: "Platform Engineer",
          source: "greenhouse",
          status: "SAVED",
          createdAt: "2026-11-16T00:00:00.000Z",
          notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/101?gh_src=feed",
          rawDescription: "Role 101 duplicate",
          extractedRequirements: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] },
        },
        {
          id: "job-distinct-b",
          company: "Acme Corp",
          roleTitle: "Platform Engineer",
          source: "greenhouse",
          status: "REJECTED",
          createdAt: "2026-11-15T00:00:00.000Z",
          notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/202",
          rawDescription: "Role 202 distinct",
          extractedRequirements: { requiredSkills: ["Go"], preferredSkills: [], domainTerms: [] },
        },
      ];
      await page.route("**/api/jobs", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { success: true, guest: true, data: duplicateJobsPayload } });
        } else {
          await route.continue();
        }
      });

      // Wait: also check Tracker mobile filters & sub-nav discoverability at 390x844
      await page.goto("/tracker", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("tracker-job-list")).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId("tracker-location-filter")).toHaveAttribute("placeholder", "City (Toronto)");
      const filterHeights = await page.evaluate(() =>
        [
          document.querySelector("[data-testid='tracker-posted-select']"),
          document.querySelector("[data-testid='tracker-workplace-filter']"),
          document.querySelector("[data-testid='tracker-status-filter']"),
        ].map((el) => Math.round(el!.getBoundingClientRect().height))
      );
      expect(filterHeights).toEqual([44, 44, 44]);
      await assertNoHorizontalOverflow(page, "/tracker@390x844");

      // Sub-nav tabs & scroll-fade discoverability on mobile 390x844
      for (const subRoute of ["/tracker/feed", "/tracker/saved", "/tracker/applied", "/tracker/outcomes"]) {
        await page.goto(subRoute, { waitUntil: "domcontentloaded" });
        await assertNoHorizontalOverflow(page, `${subRoute}@390x844`);
        await page.getByTestId("tracker-tab-outcomes").scrollIntoViewIfNeeded();
        await expect(page.getByTestId("tracker-tab-outcomes")).toBeInViewport();
      }

      // Verify Kanban REJECTED column at 1280x800, 1440x900, and mobile scroll
      await page.goto("/tracker", { waitUntil: "domcontentloaded" });
      await page.getByTestId("tracker-view-kanban").click();
      await expect(page.getByTestId("tracker-kanban-board")).toBeVisible();
      await page.getByTestId("kanban-col-REJECTED").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("kanban-col-REJECTED")).toBeInViewport();
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "tracker-kanban-390.png") });

      for (const vp of [
        { name: "1280x800", width: 1280, height: 800 },
        { name: "1440x900", width: 1440, height: 900 },
      ]) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const rejectedBounds = await page.evaluate(() => {
          const col = document.querySelector("[data-testid='kanban-col-REJECTED']")!;
          const r = col.getBoundingClientRect();
          return { vw: document.documentElement.clientWidth, right: Math.round(r.right), left: Math.round(r.left) };
        });
        expect(rejectedBounds.right, `REJECTED column must fit at ${vp.name}`).toBeLessThanOrEqual(rejectedBounds.vw + 1);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, `tracker-kanban-${vp.name}.png`) });
      }
    } finally {
      await context.close();
    }
  });

  test("4b. Duplicate source posting collapse & distinct same-title disambiguation in Tracker", async ({ page }) => {
    // Test against real /api/jobs response shape via signed-in or mocked feed with identical posting identity vs distinct req
    const jobsPayload = [
      {
        id: "dup-1",
        company: "Acme Corp",
        roleTitle: "Platform Engineer",
        source: "greenhouse",
        status: "SAVED",
        createdAt: "2026-11-17T00:00:00.000Z",
        notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/101",
        rawDescription: "Role 101",
        extractedRequirements: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] },
      },
      {
        id: "dup-2",
        company: "Acme Corp",
        roleTitle: "Platform Engineer",
        source: "greenhouse",
        status: "SAVED",
        createdAt: "2026-11-16T00:00:00.000Z",
        notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/101?utm_source=feed",
        rawDescription: "Role 101 dup",
        extractedRequirements: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] },
      },
      {
        id: "distinct-2",
        company: "Acme Corp",
        roleTitle: "Platform Engineer",
        source: "greenhouse",
        status: "SAVED",
        createdAt: "2026-11-15T00:00:00.000Z",
        notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/202",
        rawDescription: "Role 202",
        extractedRequirements: { requiredSkills: ["Go"], preferredSkills: [], domainTerms: [] },
      },
    ];
    await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: true } }));
    await page.addInitScript((list) => {
      localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(list));
    }, jobsPayload);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tracker");
    await expect(page.getByTestId("tracker-job-card-dup-1")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("tracker-job-card-dup-2")).toHaveCount(0);
    await expect(page.getByTestId("tracker-job-card-distinct-2")).toBeVisible();
    await expect(page.getByTestId("job-disambiguator-dup-1")).toContainText("Req #101");
    await expect(page.getByTestId("job-disambiguator-distinct-2")).toContainText("Req #202");
    await expect(page.getByTestId("tailor-resume-btn-distinct-2")).toHaveAttribute("href", "/tailor?jobId=distinct-2");
  });

  test("5. Permissions & recovery: 0 guest Tracker hydrations, Settings guest/auth success & error, logout & missing/foreign jobId isolation", async ({
    browser,
    baseURL,
  }) => {
    // 5a. Self-hosted guest (empty storage): 0 hydration requests, Settings shows Sign in to test connection
    const selfGuestCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const sgPage = await selfGuestCtx.newPage();
    try {
      let sgHydrate = 0;
      sgPage.on("request", (req) => {
        if (new URL(req.url()).pathname === "/api/jobs/hydrate") sgHydrate += 1;
      });
      await sgPage.goto("/tracker", { waitUntil: "networkidle" });
      await sgPage.waitForTimeout(500);
      expect(sgHydrate).toBe(0);

      await sgPage.goto("/settings", { waitUntil: "networkidle" });
      await expect(sgPage.locator("#test-connection-btn")).toBeEnabled();
      await sgPage.selectOption("#provider-select", "ollama");
      await expect(sgPage.getByTestId("settings-signin-to-test-link")).toBeVisible();
      await expect(sgPage.locator("#test-connection-btn")).toHaveCount(0);
    } finally {
      await selfGuestCtx.close();
    }

    // 5b. Public-demo guest (empty storage): 0 hydration requests, #test-connection-btn enabled
    const demoGuestCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const dgPage = await demoGuestCtx.newPage();
    try {
      let dgHydrate = 0;
      dgPage.on("request", (req) => {
        if (new URL(req.url()).pathname === "/api/jobs/hydrate") dgHydrate += 1;
      });
      await dgPage.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: true } }));
      await dgPage.goto("/tracker", { waitUntil: "networkidle" });
      await dgPage.waitForTimeout(500);
      expect(dgHydrate).toBe(0);

      await dgPage.goto("/settings", { waitUntil: "networkidle" });
      await expect(dgPage.locator("#test-connection-btn")).toBeEnabled();
    } finally {
      await demoGuestCtx.close();
    }

    // 5c. Signed-in fixture: Settings connection test success + recoverable failure, plus logout & foreign/missing jobId isolation
    const { context: userACtx, page: userAPage } = await createIsolatedUserContext(browser, baseURL);
    let userAJobId = "";
    try {
      const jobRes = await userAPage.request.post(`${baseURL}/api/jobs`, {
        data: {
          company: "User A Private Corp",
          roleTitle: "User A Confidential Role",
          rawDescription: "Confidential job description for User A.",
          source: "pasted",
          personal: true,
        },
      });
      expect(jobRes.ok()).toBeTruthy();
      userAJobId = (await jobRes.json()).data.id as string;

      // Visit Tailor to store User A active job context
      await userAPage.goto(`/tailor?jobId=${userAJobId}`);
      await expect(userAPage.getByTestId("active-job-header-banner")).toContainText("User A Confidential Role");

      // Settings test connection: whitespace-nowrap single line, 1 success, 1 recoverable failure
      await userAPage.goto("/settings", { waitUntil: "networkidle" });
      const testBtn = userAPage.locator("#test-connection-btn");
      await expect(testBtn).toBeEnabled();
      const btnHeight = await testBtn.evaluate((el) => Math.round(el.getBoundingClientRect().height));
      expect(btnHeight).toBeLessThanOrEqual(48);

      await userAPage.selectOption("#provider-select", "openai");
      await userAPage.fill("#api-key-input", "sk-synthetic-e2e-only-key");

      let nextFail = false;
      await userAPage.route("**/api/ai/test-connection", async (route) => {
        if (nextFail) {
          await route.fulfill({ status: 200, json: { success: false, error: "Synthetic provider auth failed" } });
        } else {
          await route.fulfill({ status: 200, json: { success: true, message: "Connected", latencyMs: 14 } });
        }
      });

      await testBtn.click();
      await expect(userAPage.locator("#test-result-banner")).toContainText("Connection Verified");
      nextFail = true;
      await testBtn.click();
      await expect(userAPage.locator("#test-result-banner")).toContainText("Connection Failed");
      await expect(userAPage.locator("#api-key-input")).toHaveAttribute("aria-invalid", "true");

      // Logout clears User A active application context
      await userAPage.getByTestId("account-settings").getByRole("button", { name: "Sign Out" }).click();
      await expect(userAPage.getByRole("link", { name: "Sign In" }).first()).toBeVisible({ timeout: 10000 });
      await userAPage.goto("/tailor");
      await expect(userAPage.getByTestId("active-job-header-banner")).not.toContainText("User A Confidential Role");

      // Missing job ID recovery
      await userAPage.goto("/tailor?jobId=missing-nonexistent-job-999");
      await expect(userAPage.getByTestId("job-load-error-banner")).toBeVisible({ timeout: 10000 });
      await expect(userAPage.getByTestId("job-load-error-back-to-jobs")).toBeVisible();
    } finally {
      await userACtx.close();
    }

    // Foreign job ID visited by User B never restores User A's job
    const { context: userBCtx, page: userBPage } = await createIsolatedUserContext(browser, baseURL);
    try {
      await userBPage.goto(`/tailor?jobId=${userAJobId}`);
      await expect(userBPage.getByTestId("job-load-error-banner")).toBeVisible({ timeout: 10000 });
      await expect(userBPage.getByTestId("active-job-header-banner")).not.toContainText("User A Confidential Role");
    } finally {
      await userBCtx.close();
    }
  });

  test("6. Remediation verification: PDF consent gate, Jobs->Practice exact role handoff, phone Editor 2-to-1 Fit, Tracker/Outcomes recovery, blank Tailor gate & Escape focus restoration", async ({
    browser,
    baseURL,
  }) => {
    test.setTimeout(90_000);
    await mkdir(ARTIFACT_DIR, { recursive: true });

    // 6a. Authenticated Evidence Bank PDF consent gate + Add Evidence Escape focus restoration
    const { context: authCtx, page: authPage } = await createIsolatedUserContext(browser, baseURL);
    try {
      let evidencePostCount = 0;
      authPage.on("request", (req) => {
        if (new URL(req.url()).pathname === "/api/evidence" && req.method() === "POST") {
          evidencePostCount += 1;
        }
      });

      await authPage.setViewportSize({ width: 1280, height: 800 });
      await authPage.goto("/library", { waitUntil: "networkidle" });

      const pdfBuffer = buildSyntheticPdfBuffer([
        "EXPERIENCE",
        "Northwind Labs | Backend Engineer | 2023 - Present",
        "- Kept deterministic PostgreSQL telemetry pipelines.",
        "- Cut tail p99 query latency by 42%.",
        "- Excluded legacy XML adapter for deprecation.",
      ]);
      const fileInput = authPage.locator('[data-testid="bulk-pdf-dropzone"] input[type="file"]');
      await fileInput.setInputFiles({
        name: "synthetic-consent.pdf",
        mimeType: "application/pdf",
        buffer: pdfBuffer,
      });

      await expect(authPage.getByTestId("pdf-extracted-preview")).toBeVisible({ timeout: 15000 });
      await expect(authPage.getByText("Excluded legacy XML adapter for deprecation.")).toBeVisible();
      // Zero server writes before confirmation
      expect(evidencePostCount).toBe(0);

      // Uncheck the third bullet (index 3 in experience section, after header line 0)
      const excludeCheckbox = authPage.getByTestId("pdf-bullet-checkbox-0-3");
      await expect(excludeCheckbox).toBeChecked();
      await excludeCheckbox.uncheck();
      await expect(excludeCheckbox).not.toBeChecked();

      await authPage.getByTestId("pdf-commit-selected-btn-0").click();
      await expect(authPage.getByTestId("evidence-notification")).toBeVisible({ timeout: 15000 });
      expect(evidencePostCount).toBeGreaterThan(0);

      await authPage.reload({ waitUntil: "networkidle" });
      await expect(authPage.getByText("Kept deterministic PostgreSQL telemetry pipelines.").first()).toBeVisible({ timeout: 10000 });
      await expect(authPage.getByText("Excluded legacy XML adapter for deprecation.")).toHaveCount(0);

      // Escape closes Add Evidence Item and returns focus to the invoking button
      const addBtn = authPage.getByTestId("add-evidence-item-btn");
      await addBtn.focus();
      await addBtn.click();
      const addDialog = authPage.getByRole("dialog");
      await expect(addDialog).toBeVisible();
      await authPage.keyboard.press("Escape");
      await expect(addDialog).toHaveCount(0);
      await expect(addBtn).toBeFocused();
    } finally {
      await authCtx.close();
    }

    // 6b. Phone Editor (390x844): visible badge, mobile orientation bar, 2-to-1 Fit conversion, and Master Dialog Escape focus return
    const editorCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const edPage = await editorCtx.newPage();
    try {
      const fittableTwoPage = buildFittableTwoPageManagedSource();
      await edPage.route("**/api/resumes", async (route) => {
        if (route.request().method() === "GET") await route.fulfill({ json: { success: true, data: [] } });
        else await route.continue();
      });
      await edPage.addInitScript((src) => {
        localStorage.setItem("resumeforge_typst_source", src);
        localStorage.setItem("resumeforge_migration_dismissed", "true");
      }, fittableTwoPage);

      await edPage.setViewportSize({ width: 390, height: 844 });
      await edPage.goto("/editor");
      await expect(edPage.getByTestId("document-type-badge")).toBeVisible({ timeout: 15000 });
      await edPage.getByTestId("editor-mode-code").first().click();
      await expect(edPage.getByTestId("mobile-editor-orientation-bar")).toBeVisible();
      await assertNoHorizontalOverflow(edPage, "/editor-orientation@390x844");

      // Escape closes Confirm & Freeze Master and restores focus to Save as Master Resume
      const saveMasterBtn = edPage.getByTestId("save-as-master-btn");
      await saveMasterBtn.focus();
      await saveMasterBtn.click();
      const masterDialog = edPage.getByTestId("save-master-confirm-modal");
      await expect(masterDialog).toBeVisible();
      await edPage.keyboard.press("Escape");
      await expect(masterDialog).toHaveCount(0);
      await expect(saveMasterBtn).toBeFocused();

      // Switch to Preview via mobile orientation bar and convert 2 pages -> 1 page
      await edPage.getByTestId("mobile-orientation-preview-btn").click();
      await expect(edPage.getByTestId("layout-page-status")).toContainText("2 pages measured", { timeout: 30000 });
      await edPage.getByRole("button", { name: "Fit to one page" }).first().click();
      await expect(edPage.getByTestId("layout-page-status")).toContainText("1 page measured", { timeout: 30000 });

      const fittedDl = edPage.waitForEvent("download", { timeout: 30000 });
      await edPage.getByTestId("export-dropdown-btn").first().click();
      await edPage.getByTestId("export-pdf-menu-item").click();
      const fittedPdfPath = path.join(ARTIFACT_DIR, "fitted-two-to-one.pdf");
      await (await fittedDl).saveAs(fittedPdfPath);
      expect(inspectPdf(fittedPdfPath).numPages).toBe(1);
    } finally {
      await editorCtx.close();
    }

    // 6c. Jobs -> Practice exact role handoff, disambiguated picker, scope notice, Tracker filter clear, Demo Outcomes, and blank Tailor banner gate
    const demoCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const demoPage = await demoCtx.newPage();
    try {
      const demoJobs = [
        {
          id: "frl-frontend",
          company: "Fictional Review Lab",
          roleTitle: "Frontend Engineering Intern",
          source: "pasted",
          status: "SAVED",
          createdAt: "2026-11-17T00:00:00.000Z",
          notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/frl/jobs/101",
          rawDescription: "Frontend React and TypeScript role.",
          extractedRequirements: { requiredSkills: ["React", "TypeScript"], preferredSkills: [], domainTerms: [] },
        },
        {
          id: "frl-backend",
          company: "Fictional Review Lab",
          roleTitle: "Backend Engineering Intern",
          source: "pasted",
          status: "APPLIED",
          createdAt: "2026-11-16T00:00:00.000Z",
          notes: "Location: Waterloo, ON | Apply Link: https://boards.greenhouse.io/frl/jobs/202",
          rawDescription: "Backend Go and PostgreSQL role.",
          extractedRequirements: { requiredSkills: ["Go", "PostgreSQL"], preferredSkills: [], domainTerms: [] },
        },
        {
          id: "stripe-intern-1",
          company: "Stripe",
          roleTitle: "Software Engineer Intern",
          source: "greenhouse",
          status: "SAVED",
          createdAt: "2026-11-15T00:00:00.000Z",
          notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/stripe/jobs/1111",
          rawDescription: "Distributed payments infrastructure.",
          extractedRequirements: { requiredSkills: ["Go"], preferredSkills: [], domainTerms: [] },
        },
        {
          id: "stripe-intern-2",
          company: "Stripe",
          roleTitle: "Software Engineer Intern",
          source: "greenhouse",
          status: "SAVED",
          createdAt: "2026-11-14T00:00:00.000Z",
          notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/stripe/jobs/2222",
          rawDescription: "Billing engine reliability.",
          extractedRequirements: { requiredSkills: ["TypeScript"], preferredSkills: [], domainTerms: [] },
        },
      ];
      await demoPage.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: true } }));
      await demoPage.route("**/api/auth/me", (route) => route.fulfill({ json: { data: null, guest: true } }));
      await demoPage.route("**/api/stats/outcomes", (route) =>
        route.fulfill({
          json: {
            success: true,
            guest: true,
            data: { funnel: { SAVED: 0, APPLIED: 0, INTERVIEWING: 0, OFFER: 0, REJECTED: 0 }, interviewRate: 0, medianResponseDays: null, variants: [] },
          },
        })
      );
      await demoPage.addInitScript((list) => {
        localStorage.setItem("resumeforge_guest_jobs", JSON.stringify(list));
      }, demoJobs);

      await demoPage.setViewportSize({ width: 1280, height: 800 });
      await demoPage.goto("/tracker");
      await expect(demoPage.getByTestId("tracker-job-card-frl-backend")).toBeVisible({ timeout: 10000 });

      // Empty filter recovery offers Clear filters and restores list
      await demoPage.getByTestId("tracker-job-search").fill("nonexistent-xyz-999");
      await expect(demoPage.getByTestId("tracker-clear-filters-btn")).toBeVisible({ timeout: 10000 });
      await expect(demoPage.getByRole("link", { name: "Add Your First Job" })).toHaveCount(0);
      await demoPage.getByTestId("tracker-clear-filters-btn").click();
      await expect(demoPage.getByTestId("tracker-job-card-frl-backend")).toBeVisible({ timeout: 10000 });

      // Click Backend role, then click Practice in Interactive Workspace -> selects exact Backend role
      await demoPage.getByTestId("tracker-job-card-frl-backend").click();
      await demoPage.getByTestId("job-detail-practice-link").click();
      await expect(demoPage).toHaveURL(/\/practice\?jobId=frl-backend/);
      await expect(demoPage.getByTestId("practice-target-job-banner")).toContainText("Backend Engineering Intern");
      await expect(demoPage.getByTestId("practice-target-job-banner")).not.toContainText("Frontend Engineering Intern");
      await expect(demoPage.getByTestId("practice-question-scope-notice")).toContainText("general question bank");

      // Picker distinguishes identical Stripe Software Engineer Intern postings by location + Req #
      const optionTexts = await demoPage
        .locator('[data-testid="practice-job-context-select"] option')
        .allTextContents();
      expect(optionTexts).toContain("Stripe — Software Engineer Intern (Toronto, ON · Req #1111)");
      expect(optionTexts).toContain("Stripe — Software Engineer Intern (Toronto, ON · Req #2222)");

      // Demo Outcomes explains local stage counts without sending guests to /login
      await demoPage.goto("/tracker/outcomes");
      await expect(demoPage.getByTestId("outcomes-demo-mode-notice")).toBeVisible({ timeout: 10000 });
      await expect(demoPage.getByTestId("outcomes-demo-mode-notice").locator('a[href="/login"]')).toHaveCount(0);
      await expect(demoPage.getByTestId("outcome-stage-tiles")).toBeVisible();

      // Blank Tailor (?new=1) hides Partial Extraction banner and shows Awaiting job description until text is entered
      await demoPage.goto("/tailor?new=1");
      await expect(demoPage.getByTestId("jd-textarea")).toHaveValue("");
      await expect(demoPage.getByTestId("confidence-banner-partial-extraction")).toHaveCount(0);
      await expect(demoPage.getByTestId("job-extraction-diagnostics-summary")).toContainText("Awaiting job description");
      await demoPage.getByTestId("jd-textarea").fill("Backend Engineer\n- TypeScript and PostgreSQL");
      await expect(demoPage.getByTestId("job-extraction-diagnostics-summary")).toContainText("Pasted job posting");
    } finally {
      await demoCtx.close();
    }
  });
  test("Review follow-up preserves PDF choices, retries only the failed item, and blocks another submit", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      const submissions: string[] = [];
      const savedItems = new Map<string, object>();
      let releaseRequest!: () => void;
      const blockedRequest = new Promise<void>((resolve) => { releaseRequest = resolve; });
      await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: false } }));
      await page.route("**/api/auth/me", (route) => route.fulfill({
        json: { data: { id: "synthetic-pdf-user", email: "pdf@example.test", username: "PDF Reviewer" } },
      }));
      await page.route("**/api/evidence", async (route) => {
        if (route.request().method() === "GET") {
          await route.fulfill({ json: { success: true, data: [...savedItems.values()] } });
          return;
        }
        const item = route.request().postDataJSON();
        submissions.push(item.importId);
        if (submissions.length === 1) await blockedRequest;
        if (submissions.length === 2) {
          await route.abort("failed");
          return;
        }
        savedItems.set(item.importId, { ...item, id: item.importId, createdAt: new Date().toISOString() });
        await route.fulfill({ status: 201, json: { success: true, data: item } });
      });

      await page.goto(new URL("/library", baseURL).href);
      const dropzone = page.getByTestId("bulk-pdf-dropzone");
      await dropzone.locator('input[type="file"]').setInputFiles({
        name: "synthetic-save-retry.pdf",
        mimeType: "application/pdf",
        buffer: buildSyntheticPdfBuffer([
          "EXPERIENCE",
          "Northwind Labs | Backend Engineer | 2023 - Present",
          "- Kept deterministic PostgreSQL telemetry pipelines.",
          "- Cut tail p99 query latency by 42%.",
          "- Excluded legacy XML adapter for deprecation.",
        ]),
      });
      const excluded = dropzone.getByTestId("pdf-bullet-checkbox-0-3");
      await excluded.uncheck();
      expect(submissions).toHaveLength(0);

      const save = dropzone.getByTestId("pdf-commit-selected-btn-0");
      try {
        await save.click();
        await expect.poll(() => submissions.length).toBe(1);
        await expect(save).toBeDisabled();
        await expect(save).toHaveText("Saving…");
        await save.dispatchEvent("click");
        expect(submissions).toHaveLength(1);
      } finally {
        releaseRequest();
      }

      await expect(dropzone.getByRole("alert")).toContainText("Saved 1. Could not save 1.");
      await expect(excluded).not.toBeChecked();
      await expect(save).toHaveText("Retry save");
      expect(submissions).toHaveLength(2);
      await save.click();
      await expect(save).toHaveText("Saved to Evidence Bank");
      expect(submissions).toEqual([submissions[0], submissions[1], submissions[1]]);
      expect(savedItems.size).toBe(2);
      expect(JSON.stringify([...savedItems.values()])).not.toContain("Excluded legacy XML adapter");
    } finally {
      await context.close();
    }
  });

  test("Review follow-up opens a blank job on mobile and reloads the same saved job", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: true } }));
      await page.goto(new URL("/tracker", baseURL).href);
      await page.getByRole("link", { name: "Add Job", exact: true }).click();
      await expect(page).toHaveURL(/\/tailor\?new=1&tab=job-info$/);
      const description = page.getByTestId("jd-textarea");
      await expect(description).toHaveValue("");
      await page.getByRole("button", { name: "Paste job description" }).click();
      await expect(description).toBeFocused();
      await expect.poll(async () => (await description.boundingBox())?.y).toBeLessThan(350);

      await page.locator("#tailor-company").fill("Fictional Lab");
      await page.locator("#tailor-role").fill("New synthetic role");
      const firstDraft = "Required skills: TypeScript. Preferred skills: AWS.";
      await description.fill(firstDraft);
      await page.getByTestId("save-job-btn").click();
      await expect(page).toHaveURL((url) =>
        url.pathname === "/tailor" &&
        (url.searchParams.get("jobId") ?? "").startsWith("guest-job-") &&
        url.searchParams.get("tab") === "job-info" &&
        !url.searchParams.has("new")
      );
      const savedUrl = page.url();

      await page.reload();
      await expect(description).toHaveValue(firstDraft);
      await expect(page.getByText("Saved posting", { exact: true })).toBeVisible();
      const changedDraft = "Required skills: TypeScript and PostgreSQL. Preferred skills: AWS.";
      await description.fill(changedDraft);
      await page.getByTestId("save-job-btn").click();
      await expect(page.getByText("Job posting saved successfully!", { exact: true })).toBeVisible();
      await expect(page).toHaveURL(savedUrl);
      await page.reload();
      await expect(description).toHaveValue(changedDraft);

      await page.goto(new URL("/tracker", baseURL).href);
      await page.getByRole("link", { name: "Add Job", exact: true }).click();
      await expect(description).toHaveValue("");
      await expect(page).toHaveURL(/\/tailor\?new=1&tab=job-info$/);
    } finally {
      await context.close();
    }
  });

  test("Review follow-up excludes preferred skills from Tracker’s required coverage", async ({ browser, baseURL }) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: { cookies: [], origins: [] } });
    try {
      const page = await context.newPage();
      await page.route("**/api/demo-config", (route) => route.fulfill({ json: { demoMode: true } }));
      // Exercise existing demo data created before the sample included structured requirements.
      await page.addInitScript(() => {
        if (localStorage.getItem("resumeforge_guest_jobs")) return;
        localStorage.setItem("resumeforge_guest_jobs", JSON.stringify([{
          id: "demo-sample-job",
          rawDescription: "Synthetic sample job description for a fictional Sample Software Engineer role at Example Lab. Required skills: TypeScript and PostgreSQL. Preferred skills: AWS. Domain: product analytics. This fictional role is for exploring the tailoring workflow only.",
          roleTitle: "Sample Software Engineer",
          company: "Example Lab (fictional)",
          status: "SAVED",
        }, {
          id: "legacy-serialized-requirements",
          rawDescription: "A fictional role with saved requirements.",
          roleTitle: "Platform Developer",
          company: "Legacy Example Lab",
          status: "SAVED",
          requirementsStatus: "ready",
          extractedRequirements: JSON.stringify({
            requiredSkills: ["Go"],
            preferredSkills: ["Redis"],
            domainTerms: [],
          }),
        }]));
      });
      await page.goto(new URL("/tracker", baseURL).href);
      await page.getByTestId("job-select-btn-demo-sample-job").click();
      const groups = page.getByTestId("requirements-groups");
      const required = groups.getByText("Required", { exact: true }).locator("..");
      await expect(required).toContainText("PostgreSQL");
      await expect(required).not.toContainText("AWS");
      await expect(groups.getByText("Preferred", { exact: true }).locator("..")).toContainText("AWS");
      await expect(page.getByTestId("tracker-required-evidence-coverage")).toContainText("of 2 required skills");

      await page.getByTestId("job-select-btn-legacy-serialized-requirements").click();
      await expect(required).toContainText("Go");
      await expect(groups.getByText("Preferred", { exact: true }).locator("..")).toContainText("Redis");
    } finally {
      await context.close();
    }
  });
});
