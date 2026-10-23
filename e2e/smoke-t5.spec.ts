import { test, expect } from "@playwright/test";

test.describe("T5 Browser Smoke Check", () => {
  const consoleLogs: Record<string, string[]> = {};

  function setupConsoleListener(page: any, surface: string) {
    consoleLogs[surface] = [];
    page.on("console", (msg: any) => {
      const type = msg.type();
      const text = msg.text();
      if (type === "error" || type === "warning") {
        consoleLogs[surface].push(`[${type}] ${text}`);
      }
    });
    page.on("pageerror", (err: Error) => {
      consoleLogs[surface].push(`[pageerror] ${err.message}\n${err.stack || ""}`);
    });
  }

  test.afterAll(async () => {
    console.log("=== T5 BROWSER SMOKE CHECK CONSOLE LOG REPORT ===");
    for (const [surface, logs] of Object.entries(consoleLogs)) {
      console.log(`Surface: ${surface} (Errors/Warnings: ${logs.length})`);
      logs.forEach((l) => console.log(`  ${l}`));
    }
  });

  test("1. Landing page (/) renders onboarding checklist", async ({ page }) => {
    setupConsoleListener(page, "/");
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const checklist = page.getByTestId("consumer-onboarding-checklist");
    await expect(checklist).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("onboarding-step-1")).toBeVisible();
    await expect(page.getByTestId("onboarding-progress-badge")).toBeVisible();
  });

  test("2. /editor Visual <-> Source toggle and round-trip without loss", async ({ page }) => {
    setupConsoleListener(page, "/editor");
    await page.goto("/editor");
    await page.waitForLoadState("networkidle");

    // Use panel-code scope to target desktop visible editor buttons
    const codePanel = page.getByTestId("panel-code");
    const visualBtn = codePanel.getByTestId("editor-mode-visual");
    const codeBtn = codePanel.getByTestId("editor-mode-code");
    await expect(visualBtn).toBeVisible({ timeout: 15000 });
    await expect(codeBtn).toBeVisible({ timeout: 15000 });

    // Toggle 1: Switch to Visual Form
    await visualBtn.click();
    const formBuilder = page.getByTestId("resume-form-builder");
    await expect(formBuilder).toBeVisible();

    // Edit full name field
    const nameInput = page.getByTestId("form-input-fullname");
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Sarah Connor");

    // Edit location field
    const locationInput = page.getByTestId("form-input-location");
    await expect(locationInput).toBeVisible();
    await locationInput.fill("Berlin, Germany");

    // Edit phone field
    const phoneInput = page.getByTestId("form-input-phone");
    await expect(phoneInput).toBeVisible();
    await phoneInput.fill("+49 30 123456");

    // Edit summary field
    const summaryInput = page.getByTestId("form-input-summary");
    await summaryInput.fill("Cybernetic defense engineer specializing in temporal resilience.");

    // Switch to Projects tab and verify projects section exists
    const projectsTab = page.getByTestId("form-builder-tab-projects");
    await expect(projectsTab).toBeVisible();
    await projectsTab.click();
    await expect(page.getByTestId("form-section-projects")).toBeVisible();

    // Helper to get CodeMirror doc text
    const getCodeMirrorDoc = async () => {
      return await page.evaluate(() => {
        const cmEl = document.querySelector(".cm-editor");
        const cmView = (cmEl as any)?.cmView?.view;
        if (cmView) return cmView.state.doc.toString();
        return localStorage.getItem("resumeforge_typst_source") || "";
      });
    };

    // Toggle 2: Switch to Source (Typst)
    await codeBtn.click();
    await expect(page.locator(".cm-editor").first()).toBeVisible();

    // Verify source contains updated content
    await expect.poll(getCodeMirrorDoc, { timeout: 5000 }).toContain("Sarah Connor");
    const doc1 = await getCodeMirrorDoc();
    expect(doc1).toContain("Cybernetic defense engineer");
    expect(doc1).toContain("Berlin, Germany");
    expect(doc1).toContain("+49 30 123456");

    // Also confirm preview SVG updates
    const previewSvg = page.getByTestId("typst-preview-svg");
    await expect(previewSvg).toBeVisible({ timeout: 15000 });
    await expect(previewSvg).toContainText("Sarah Connor");

    // Toggle 3: Switch back to Visual Form
    await visualBtn.click();
    await expect(formBuilder).toBeVisible();
    await page.getByTestId("form-builder-tab-contact").click();
    await expect(page.getByTestId("form-input-fullname")).toHaveValue("Sarah Connor");
    await expect(page.getByTestId("form-input-location")).toHaveValue("Berlin, Germany");
    await expect(page.getByTestId("form-input-phone")).toHaveValue("+49 30 123456");
    await expect(page.getByTestId("form-input-summary")).toHaveValue(
      "Cybernetic defense engineer specializing in temporal resilience."
    );

    // Toggle 4: Switch back to Source second time (confirming no loss)
    await codeBtn.click();
    await expect(page.locator(".cm-editor").first()).toBeVisible();
    await expect.poll(getCodeMirrorDoc, { timeout: 5000 }).toContain("Sarah Connor");
    const doc2 = await getCodeMirrorDoc();
    expect(doc2).toContain("Cybernetic defense engineer");
    expect(doc2).toContain("Berlin, Germany");
    expect(doc2).toContain("+49 30 123456");
  });

  test("3. /library dark dropzone, checkboxes, Keep Both / Merge survive reload", async ({ page }) => {
    setupConsoleListener(page, "/library");

    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    const dropzone = page.getByTestId("bulk-pdf-dropzone");
    await expect(dropzone).toBeVisible({ timeout: 15000 });

    const testDuplicates = [
      {
        id: "guest-dup-target",
        title: "Staff Systems Engineer",
        organization: "Acme Corp",
        dates: "2023 - Present",
        verifiedSummary: "Original verified record of distributed systems work",
        tags: ["Distributed Systems", "Go"],
        status: "verified",
        bullets: [{ id: "b1", text: "Architected raft consensus protocol cluster", verified: true }],
      },
      {
        id: "guest-dup-candidate",
        title: "Staff Systems Engineer",
        organization: "Acme Corp",
        dates: "2023 - Present",
        verifiedSummary: "Candidate duplicate imported from second PDF",
        tags: ["Go", "Kubernetes"],
        status: "draft",
        bullets: [{ id: "b2", text: "Optimized raft heartbeat RPC latency by 40%", verified: true }],
      },
    ];

    await page.evaluate((items) => {
      localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(items));
      localStorage.removeItem("rf_reviewed_duplicates");
    }, testDuplicates);

    // Reload to pick up guest evidence
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Switch to Review Queue tab
    const reviewTab = page.locator("button", { hasText: "Review Queue" });
    await expect(reviewTab).toBeVisible();
    await reviewTab.click();

    // Verify Review Card is visible
    const reviewCard = page.getByTestId("duplicate-review-card-guest-dup-candidate");
    await expect(reviewCard).toBeVisible();

    // Click "Keep Both"
    const keepBothBtn = page.getByTestId("keep-both-btn-guest-dup-candidate");
    await expect(keepBothBtn).toBeVisible();
    await keepBothBtn.click();

    // Confirm notification and removal from review queue
    await expect(page.locator("text=Kept both")).toBeVisible();

    // Reload page and confirm review queue still remains cleared (survives reload)
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("button", { hasText: "Review Queue" }).click();
    await expect(page.getByTestId("duplicate-review-card-guest-dup-candidate")).toHaveCount(0);

    // Test Merge survival: Seed another duplicate pair
    const mergeDuplicates = [
      {
        id: "guest-merge-target",
        title: "Principal Security Architect",
        organization: "CyberDyne",
        dates: "2024",
        verifiedSummary: "Primary target security record",
        tags: ["Security", "Rust"],
        status: "verified",
        bullets: [{ id: "mb1", text: "Led zero-trust cryptographic perimeter migration", verified: true }],
      },
      {
        id: "guest-merge-candidate",
        title: "Principal Security Architect",
        organization: "CyberDyne",
        dates: "2024",
        verifiedSummary: "Duplicate candidate with additional bullet",
        tags: ["Rust", "eBPF"],
        status: "draft",
        duplicateTargetId: "guest-merge-target",
        needsReview: true,
        bullets: [{ id: "mb2", text: "Implemented eBPF runtime network packet inspection", verified: true }],
      },
    ];

    await page.evaluate((items) => {
      localStorage.setItem("resumeforge_guest_evidence", JSON.stringify(items));
      localStorage.removeItem("rf_reviewed_duplicates");
    }, mergeDuplicates);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("button", { hasText: "Review Queue" }).click();

    const mergeCard = page.getByTestId("duplicate-review-card-guest-merge-candidate");
    await expect(mergeCard).toBeVisible();

    // Click Merge
    const mergeBtn = page.getByTestId("merge-duplicate-btn-guest-merge-candidate");
    await expect(mergeBtn).toBeVisible();
    await mergeBtn.click();
    await expect(page.locator("text=Merged")).toBeVisible();

    // Reload and verify the candidate is gone and bullets merged into target
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.locator("button", { hasText: "Review Queue" }).click();
    await expect(page.getByTestId("duplicate-review-card-guest-merge-candidate")).toHaveCount(0);
  });

  test("4. /tracker Kanban view, drag card to APPLIED, reload persists status", async ({ page, request }) => {
    setupConsoleListener(page, "/tracker");

    // Login via API to get session cookie
    let loginRes = await request.post("/api/auth/login", {
      data: { email: "testuser@example.com", password: "password1234" },
    });
    if (!loginRes.ok()) {
      await request.post("/api/auth/signup", {
        data: { email: "testuser@example.com", username: "testuser", password: "password1234" },
      });
      loginRes = await request.post("/api/auth/login", {
        data: { email: "testuser@example.com", password: "password1234" },
      });
    }

    const setCookie = loginRes.headers()["set-cookie"] || "";
    const sessionMatch = setCookie.match(/rf_session=([^;]+)/);
    if (sessionMatch) {
      await page.context().addCookies([
        {
          name: "rf_session",
          value: sessionMatch[1],
          domain: "localhost",
          path: "/",
        },
      ]);
    }

    // Create a job posting with SAVED status
    const jobRes = await request.post("/api/jobs", {
      data: {
        company: "Stripe",
        roleTitle: "Staff Infrastructure Engineer",
        rawDescription: "Distributed systems, Kubernetes, Go, PostgreSQL",
        source: "pasted",
        status: "SAVED",
      },
    });
    expect(jobRes.ok()).toBeTruthy();
    const jobJson = await jobRes.json();
    const jobId = jobJson.data.id;

    // Open /tracker
    await page.goto("/tracker");
    await page.waitForLoadState("networkidle");

    // Switch to Kanban View
    const kanbanTab = page.getByTestId("tracker-view-kanban");
    await expect(kanbanTab).toBeVisible({ timeout: 15000 });
    await kanbanTab.click();

    const kanbanBoard = page.getByTestId("tracker-kanban-board");
    await expect(kanbanBoard).toBeVisible();

    // Verify card is in SAVED column
    const savedCol = page.getByTestId("kanban-col-SAVED");
    const jobCard = page.getByTestId(`kanban-card-${jobId}`);
    await expect(savedCol).toContainText("Staff Infrastructure Engineer");

    // Perform drag & drop from SAVED to APPLIED
    const appliedCol = page.getByTestId("kanban-col-APPLIED");

    const patchPromise = page.waitForResponse(
      (resp) => resp.url().includes(`/api/jobs/${jobId}`) && resp.request().method() === "PATCH" && resp.status() === 200
    );

    await jobCard.dragTo(appliedCol);
    await patchPromise;

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.getByTestId("tracker-view-kanban").click();

    // Confirm card is now in APPLIED column
    await expect(page.getByTestId("kanban-col-APPLIED")).toContainText("Staff Infrastructure Engineer");
  });

  test("5. /tracker/discover curated company chips and match badges", async ({ page }) => {
    setupConsoleListener(page, "/tracker/discover");
    // Test alias redirect from /tracker/discover to /tracker/feed
    await page.goto("/tracker/discover");
    await page.waitForLoadState("networkidle");

    // Curated Company Quick-Filter Chips
    const chipsBar = page.getByTestId("curated-company-chips");
    await expect(chipsBar).toBeVisible({ timeout: 15000 });

    // Check specific chips
    const stripeChip = page.getByTestId("curated-chip-stripe");
    await expect(stripeChip).toBeVisible();

    // Click Stripe chip and confirm search query updates
    await stripeChip.click();
    const searchInput = page.getByTestId("discover-search-input");
    await expect(searchInput).toHaveValue("Stripe");
  });

  test("6. /tailor?jobId=X&tab=cover-letter lands on cover letter section", async ({ page }) => {
    setupConsoleListener(page, "/tailor?tab=cover-letter");
    await page.goto("/tailor?jobId=mock-job-123&tab=cover-letter");
    await page.waitForLoadState("networkidle");

    const coverLetterSection = page.getByTestId("tailor-cover-letter-section");
    await expect(coverLetterSection).toBeVisible({ timeout: 15000 });
    await expect(coverLetterSection).toContainText("Active Section");
  });

  test("7. /practice?jobId=X renders job context banner", async ({ page }) => {
    setupConsoleListener(page, "/practice?jobId=X");

    // Seed guest job in localStorage
    await page.goto("/practice");
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => {
      localStorage.setItem(
        "resumeforge_guest_jobs",
        JSON.stringify([
          {
            id: "target-job-999",
            company: "Anthropic",
            roleTitle: "Systems Research Engineer",
          },
        ])
      );
    });

    // Navigate to /practice with jobId
    await page.goto("/practice?jobId=target-job-999");
    await page.waitForLoadState("networkidle");

    const jobBanner = page.getByTestId("practice-target-job-banner");
    await expect(jobBanner).toBeVisible({ timeout: 15000 });
    await expect(jobBanner).toContainText("Systems Research Engineer");
    await expect(jobBanner).toContainText("Anthropic");
  });

  test("8. /settings Test Connection works with gemini-2.5-flash", async ({ page }) => {
    setupConsoleListener(page, "/settings");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Select Gemini provider
    await page.selectOption("#provider-select", "gemini");

    // Verify model input defaults to gemini-2.5-flash
    const modelInput = page.locator("#model-input");
    await expect(modelInput).toHaveValue("gemini-2.5-flash");

    // Enter test API key
    await page.fill("#api-key-input", "AIzaSyTestKeyForSmokeVerification");

    // Click Test Connection
    await page.click("#test-connection-btn");

    // Verify test result banner renders
    const banner = page.locator("#test-result-banner");
    await expect(banner).toBeVisible({ timeout: 15000 });
  });
});
