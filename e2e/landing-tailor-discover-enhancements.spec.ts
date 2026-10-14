import { test, expect } from "@playwright/test";

test.describe("Jobright Upgrade Features: Instant ATS Sandbox, Competitive Matrix, 3-Pane Tailor, and Signal Badges", () => {
  test("1. Landing page renders Instant ATS Sandbox and Competitive Matrix sections with full interactivity", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify Instant ATS Sandbox Section
    const sandboxSection = page.getByTestId("instant-ats-sandbox-section");
    await expect(sandboxSection).toBeVisible();

    // Verify Sample Roles preset buttons
    const backendPreset = page.getByTestId("sandbox-preset-backend");
    const frontendPreset = page.getByTestId("sandbox-preset-frontend");
    const aiPreset = page.getByTestId("sandbox-preset-ai-platform");

    await expect(backendPreset).toBeVisible();
    await expect(frontendPreset).toBeVisible();
    await expect(aiPreset).toBeVisible();

    // Verify JD textarea and Mathematical Fit Breakdown panel
    const jdInput = page.getByTestId("sandbox-jd-input");
    await expect(jdInput).toBeVisible();

    const scorePanel = page.getByTestId("sandbox-score-panel");
    await expect(scorePanel).toBeVisible();
    await expect(scorePanel).toContainText("ATS MATCH");
    await expect(scorePanel).toContainText("Core Stack");
    await expect(scorePanel).toContainText("Seniority");
    await expect(scorePanel).toContainText("Tools & Infra");
    await expect(scorePanel).toContainText("Evidence Bank Coverage");

    // Switch to Frontend Preset
    await frontendPreset.click();
    await expect(jdInput).toHaveValue(/Staff Frontend Architect/);

    // Test Expandable Formula Derivation Audit Log
    const derivationBtn = page.getByTestId("toggle-derivation-log-btn");
    await expect(derivationBtn).toBeVisible();
    await derivationBtn.click();

    const derivationLog = page.getByTestId("sandbox-derivation-log");
    await expect(derivationLog).toBeVisible();

    // Test Typst AST Source View Tab
    const sourceTab = page.getByTestId("sandbox-tab-source");
    await expect(sourceTab).toBeVisible();
    await sourceTab.click();

    const typstSourceView = page.getByTestId("sandbox-typst-source-view");
    await expect(typstSourceView).toBeVisible();
    await expect(typstSourceView).toContainText("#resume-section");

    // Test Document Preview (WASM SVG) View Tab
    const svgTab = page.getByTestId("sandbox-tab-svg");
    await expect(svgTab).toBeVisible();
    await svgTab.click();

    const svgContainer = page.getByTestId("sandbox-svg-container");
    await expect(svgContainer).toBeVisible();

    // Verify Competitive Matrix Section
    const matrixSection = page.getByTestId("competitive-matrix-section");
    await expect(matrixSection).toBeVisible();
    await expect(matrixSection).toContainText("The Engineering Wedge: Why ResumeForge");

    // Check table moats and competitors
    await expect(matrixSection).toContainText("Hallucination Prevention");
    await expect(matrixSection).toContainText("Cost & Quotas");
    await expect(matrixSection).toContainText("Data Privacy & Ownership");
    await expect(matrixSection).toContainText("Document Quality & Layout");
    await expect(matrixSection).toContainText("ATS Evaluation Engine");

    await expect(matrixSection).toContainText("ResumeForge (Local)");
    await expect(matrixSection).toContainText("Competitors");
    await expect(matrixSection).toContainText("Teal");
    await expect(matrixSection).toContainText("Simplify");
  });

  test("2. Tailor workspace 3-Pane view renders and coordinates Left, Center, and Right panes cleanly", async ({
    page,
  }) => {
    await page.goto("/tailor");

    // Verify 3-Pane tab button exists
    const tab3Pane = page.getByTestId("tailor-tab-3-pane");
    await expect(tab3Pane).toBeVisible();

    // Click 3-Pane tab
    await tab3Pane.click();

    // 3-Pane container is mounted
    const container3Pane = page.getByTestId("tailor-3pane-container");
    await expect(container3Pane).toBeVisible();

    // Left Pane: Job Description with keyword highlights
    const leftPane = page.getByTestId("tailor-pane-left");
    await expect(leftPane).toBeVisible();
    const highlightedJd = page.getByTestId("tailor-jd-highlighted-view");
    await expect(highlightedJd).toBeVisible();

    // Verify keyword highlights render <mark> elements
    const markTags = highlightedJd.locator("mark");
    await expect(markTags.first()).toBeVisible();
    await expect(highlightedJd).toContainText("Go");
    await expect(highlightedJd).toContainText("Python");

    // Verify TechDiffPillList in Left Pane
    const leftTechDiff = leftPane.getByTestId("tech-diff-pill-list");
    await expect(leftTechDiff).toBeVisible();

    // Center Pane: Typst AST and Tailoring Buffer
    const centerPane = page.getByTestId("tailor-pane-center");
    await expect(centerPane).toBeVisible();
    const typstAst = page.getByTestId("typst-ast-preview");
    await expect(typstAst).toBeVisible();

    // Right Pane: ATS Score & Verification Panel
    const rightPane = page.getByTestId("tailor-pane-right");
    await expect(rightPane).toBeVisible();
    const atsScorePanel = rightPane.getByTestId("ats-score-panel");
    await expect(atsScorePanel).toBeVisible();

    // Transition back to Job Info tab via button in left pane
    const editJobBtn = page.getByTestId("edit-job-info-btn");
    await expect(editJobBtn).toBeVisible();
    await editJobBtn.click();

    await expect(page.getByTestId("tailor-job-info-panel")).toBeVisible();
    await expect(container3Pane).not.toBeVisible();

    // Verify Back button returns directly to 3-pane workspace
    const backBtn = page.getByTestId("back-to-overview-btn");
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toContainText("Back to 3-Pane Workspace");
    await backBtn.click();

    await expect(page.getByTestId("tailor-3pane-container")).toBeVisible();
    await expect(page.getByTestId("tailor-job-info-panel")).not.toBeVisible();

    // Direct deep link with ?tab=3-pane
    await page.goto("/tailor?tab=3-pane");
    await expect(page.getByTestId("tailor-3pane-container")).toBeVisible();
  });

  test("3. Discover feed renders JobCardSignalBadge and opens Radix Popover with explainable score derivation", async ({
    page,
  }) => {
    // Intercept /api/connectors/jobs to provide deterministic job item with compatibility data
    await page.route("**/api/connectors/jobs*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: "test-job-signal-01",
              externalId: "ext-gh-101",
              source: "GREENHOUSE",
              companyName: "Shopify",
              title: "Senior Backend Infrastructure Engineer",
              location: "Toronto, ON",
              workplaceType: "REMOTE",
              isCanadianEligible: true,
              description: "Seeking a Senior Backend Infrastructure Engineer proficient in Go, Python, and PostgreSQL.",
              descriptionHtml: "<p>Seeking a Senior Backend Infrastructure Engineer</p>",
              applyUrl: "https://boards.greenhouse.io/shopify/jobs/101",
              postedAt: "2026-08-15T12:00:00.000Z",
              salaryMin: 150000,
              salaryMax: 195000,
              salaryCurrency: "CAD",
              createdAt: "2026-08-15T12:00:00.000Z",
              blendedScore: 86,
              scoreBreakdown: {
                qualificationMatch: 88,
                recency: 90,
                location: 100,
                salaryTransparency: 80,
                composite: 86,
              },
              compatibility: {
                compositeScore: 86,
                requiredScore: 90,
                preferredScore: 80,
                matchedSkills: ["Go", "Python", "PostgreSQL"],
                missingSkills: ["Kubernetes"],
                matchedEvidenceCount: 3,
                totalRequiredCount: 4,
              },
            },
          ],
          total: 1,
          page: 1,
          totalPages: 1,
        }),
      });
    });

    await page.goto("/tracker/feed");

    // Locate the JobCardSignalBadge button
    const signalBadge = page.getByTestId("signal-badge-test-job-signal-01");
    await expect(signalBadge).toBeVisible();
    await expect(signalBadge).toContainText("% Match");

    // Click the signal badge to open the Radix Popover
    await signalBadge.click();

    // Verify Radix Popover content
    const popoverContent = page.getByTestId("signal-badge-popover");
    await expect(popoverContent).toBeVisible();
    await expect(popoverContent).toContainText("Explainable Match Derivation");
    await expect(popoverContent).toContainText("Weighted Score Components");
    await expect(popoverContent).toContainText("Core Stack (50%)");
    await expect(popoverContent).toContainText("Seniority & YOE (20%)");
    await expect(popoverContent).toContainText("Tooling & Infra (15%)");
    await expect(popoverContent).toContainText("Evidence Coverage (15%)");
    await expect(popoverContent).toContainText("Ground Truth Derivation Steps");

    // Verify sub-badges: Funding and H1B
    const fundingBadge = page.getByTestId("funding-badge");
    await expect(fundingBadge).toBeVisible();
    await expect(fundingBadge).toContainText("Public");

    const h1bBadge = page.getByTestId("h1b-badge");
    await expect(h1bBadge).toBeVisible();
    await expect(h1bBadge).toContainText("H1B Filings Verified (2026)");

    // Verify TechDiffPillList on the job card
    const card = page.locator("div").filter({ hasText: "Senior Backend Infrastructure Engineer" }).first();
    await expect(card).toBeVisible();
    const techPills = card.getByTestId("tech-diff-pill-list");
    await expect(techPills).toBeVisible();
    await expect(card.getByTestId("tech-pill-verified-Go")).toBeVisible();
    await expect(card.getByTestId("tech-pill-missing-Kubernetes")).toBeVisible();
  });

  test("4. 3-Pane Workspace and tab navigation adapt smoothly to mobile viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tailor?tab=3-pane");

    const container3Pane = page.getByTestId("tailor-3pane-container");
    await expect(container3Pane).toBeVisible();

    // Verify all 3 panes remain visible and functional in stacked single-column mode
    const leftPane = page.getByTestId("tailor-pane-left");
    const centerPane = page.getByTestId("tailor-pane-center");
    const rightPane = page.getByTestId("tailor-pane-right");

    await expect(leftPane).toBeVisible();
    await expect(centerPane).toBeVisible();
    await expect(rightPane).toBeVisible();

    // Verify tab buttons exist and are accessible
    const tabOverview = page.getByTestId("tailor-tab-overview");
    const tab3Pane = page.getByTestId("tailor-tab-3-pane");
    const tabJobInfo = page.getByTestId("tailor-tab-job-info");

    await expect(tabOverview).toBeVisible();
    await expect(tab3Pane).toBeVisible();
    await expect(tabJobInfo).toBeVisible();
  });
});
