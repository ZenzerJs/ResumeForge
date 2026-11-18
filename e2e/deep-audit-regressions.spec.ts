import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { test, expect, type Browser } from "@playwright/test";
import { buildSampleResumePdf } from "../scripts/generate-sample-resume-pdf";

const prisma = new PrismaClient();

async function createIsolatedUserContext(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  const suffix = randomUUID().replace(/-/g, "").slice(0, 12);
  const email = `deep-audit-${suffix}@resumeforge.test`;
  const username = `deepaudit_${suffix}`;
  const password = "playwright-test-secret";
  const signup = await page.request.post(`${baseURL}/api/auth/signup`, {
    data: { email, username, password },
  });
  expect(signup.ok()).toBeTruthy();
  return { context, page, email, username };
}

async function seedTestIngestedJob() {
  const suffix = randomUUID().slice(0, 8);
  const companyName = `DeepAuditCo ${suffix}`;
  const title = `Staff Systems Engineer ${suffix}`;
  const description = `Build resilient distributed systems for ${companyName} with TypeScript and PostgreSQL.`;
  const row = await prisma.ingestedJob.create({
    data: {
      fingerprint: createHash("sha256").update(`deep-audit-${suffix}`).digest("hex"),
      externalId: `deep-audit-ext-${suffix}`,
      source: "GREENHOUSE",
      companyName,
      title,
      location: "Toronto, ON",
      workplaceType: "REMOTE",
      isCanadianEligible: true,
      description,
      descriptionHtml: `<p>${description}</p>`,
      applyUrl: `https://example.com/jobs/deep-audit-${suffix}`,
      postedAt: new Date(),
    },
  });
  return row;
}

test.describe("Deep Audit Regression Suite", () => {
  const testPdfPath = path.join(process.cwd(), "e2e", "fixtures", "sample-resume.pdf");

  test.beforeAll(() => {
    fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });
    if (!fs.existsSync(testPdfPath)) {
      fs.writeFileSync(testPdfPath, buildSampleResumePdf(), "utf8");
    }
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("(a) rapid CodeMirror typing in Typst Source produces 0 pageerror and 0 React error #185", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    const react185Errors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const txt = msg.text();
        if (txt.includes("#185") || /Maximum update depth exceeded/i.test(txt)) {
          react185Errors.push(txt);
        }
      }
    });

    await page.goto("/editor");
    await expect(page.getByTestId("panel-code")).toBeVisible({ timeout: 15000 });
    await page.getByTestId("panel-code").getByTestId("editor-mode-code").click();

    const cmContent = page.locator('[data-testid="panel-code"] .cm-content');
    await expect(cmContent).toBeVisible();
    await cmContent.click();
    await page.keyboard.press("Control+End");

    const burstLines = [
      "\n== Rapid Typing Audit\n",
      "- Engineered low-latency ingestion pipelines across distributed workers.\n",
      "- Verified deterministic compilation stability under rapid keystrokes.\n",
      "- Automated regression coverage for CodeMirror synchronization.\n",
    ];
    for (const line of burstLines) {
      await page.keyboard.type(line, { delay: 5 });
    }

    await expect(cmContent).toContainText("Rapid Typing Audit");
    await expect(page.locator('[data-testid="typst-preview-svg"] svg').first()).toBeVisible({
      timeout: 15000,
    });
    expect(pageErrors).toEqual([]);
    expect(react185Errors).toEqual([]);
  });

  test("(b) unauthenticated guest / PDF upload opens /editor with local draft and 0 401 blocker", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    try {
      await page.goto("/");
      await expect(page.getByTestId("upload-pdf-hero-btn")).toBeVisible();

      const fileInput = page.getByTestId("pdf-upload-input");
      await fileInput.setInputFiles(testPdfPath);

      await expect(page).toHaveURL(/\/editor/, { timeout: 30000 });
      await expect(page.getByTestId("document-type-badge")).toBeVisible({ timeout: 15000 });

      const draftState = await page.evaluate(() => ({
        hasGuestDraft: localStorage.getItem("resumeforge_has_guest_draft"),
        typstSource: localStorage.getItem("resumeforge_typst_source") || "",
      }));
      expect(draftState.hasGuestDraft).toBe("true");
      expect(draftState.typstSource).toContain("Alex Rivera");
      await expect(page.getByText(/401|Unauthorized/i)).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("(c) isolated user /tracker starts at 0 tracked jobs, saves 1 from /tracker/feed, sees 1 in /tracker, and Escape closes More actions menu", async ({
    browser,
    baseURL,
  }) => {
    const ingested = await seedTestIngestedJob();
    const { context, page } = await createIsolatedUserContext(browser, baseURL);
    let promotedJobId: string | null = null;

    try {
      await page.goto("/tracker");
      await expect(page.getByTestId("tracker-page-title")).toBeVisible({ timeout: 15000 });
      await expect(page.locator("[data-testid^='tracker-job-card-']")).toHaveCount(0);

      await page.goto("/tracker/feed");
      await expect(page.getByTestId("discover-search-input")).toBeVisible({ timeout: 15000 });
      await page.getByTestId("discover-search-input").fill(ingested.title);

      const targetCard = page.getByTestId(`job-card-${ingested.id}`);
      await expect(targetCard).toBeVisible({ timeout: 15000 });

      const promoteResPromise = page.waitForResponse(
        (res) => res.url().includes("/api/connectors/promote") && res.request().method() === "POST"
      );
      await page.getByTestId(`promote-btn-${ingested.id}`).click();
      const promoteRes = await promoteResPromise;
      expect(promoteRes.ok()).toBeTruthy();
      const promoteJson = (await promoteRes.json()) as { data?: { id?: string } };
      promotedJobId = promoteJson.data?.id ?? null;
      expect(promotedJobId).toBeTruthy();
      await expect(page.getByTestId(`in-tracker-btn-${ingested.id}`)).toBeVisible();

      await page.goto("/tracker");
      await expect(page.getByTestId("tracker-page-title")).toBeVisible({ timeout: 15000 });
      const cards = page.locator("[data-testid^='tracker-job-card-']");
      await expect(cards).toHaveCount(1);
      await expect(page.getByTestId(`tracker-job-card-${promotedJobId}`)).toBeVisible();

      const moreBtn = page.getByTestId(`more-actions-btn-${promotedJobId}`);
      await expect(moreBtn).toBeVisible();
      await moreBtn.click();

      const menu = page.getByTestId(`more-actions-menu-${promotedJobId}`);
      await expect(menu).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    } finally {
      await context.close();
      await prisma.ingestedJob.deleteMany({ where: { id: ingested.id } });
      if (promotedJobId) {
        await prisma.jobApplication.deleteMany({ where: { jobId: promotedJobId } });
        await prisma.job.deleteMany({ where: { id: promotedJobId } });
      }
    }
  });

  test("(d) /tracker/feed Clear filters recovers from 0-match query and job preview modal opens and closes", async ({
    page,
  }) => {
    const ingested = await seedTestIngestedJob();

    try {
      await page.goto("/tracker/feed");
      const searchInput = page.getByTestId("discover-search-input");
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await expect(page.locator("[data-testid^='job-card-']").first()).toBeVisible({
        timeout: 15000,
      });

      await searchInput.fill("__nonexistent_deep_audit_query_999__");
      await expect(page.locator("[data-testid^='job-card-']")).toHaveCount(0, { timeout: 10000 });

      const clearBtn = page.getByTestId("discover-empty-clear-filters-btn");
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();

      await expect(searchInput).toHaveValue("");
      await searchInput.fill(ingested.title);
      await expect(page.getByTestId(`job-card-${ingested.id}`)).toBeVisible({ timeout: 15000 });

      await page.getByTestId(`preview-job-btn-${ingested.id}`).click();
      const previewDialog = page.getByTestId("discover-job-preview-dialog");
      await expect(previewDialog).toBeVisible();
      await expect(page.getByTestId("discover-job-preview-body")).toContainText(
        ingested.companyName
      );

      await page.keyboard.press("Escape");
      await expect(previewDialog).toBeHidden();
    } finally {
      await prisma.ingestedJob.deleteMany({ where: { id: ingested.id } });
    }
  });

  test("(e) /404-check Skip to content focuses #main-content and /privacy, /terms, /practice?tab=questions return 200 with 0 errors", async ({
    page,
  }) => {
    await page.goto("/404-check");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await skipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    for (const route of ["/privacy", "/terms", "/practice?tab=questions"]) {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const onConsole = (msg: import("@playwright/test").ConsoleMessage) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      };
      const onPageError = (err: Error) => pageErrors.push(err.message);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);

      try {
        const response = await page.goto(route);
        expect(response?.status(), `${route} HTTP status`).toBe(200);
        await expect(page.locator("#main-content")).toBeVisible();
        expect(consoleErrors, `${route} console errors`).toEqual([]);
        expect(pageErrors, `${route} page errors`).toEqual([]);
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
      }
    }
  });
});
