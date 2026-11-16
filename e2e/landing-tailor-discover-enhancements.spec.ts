import { test, expect } from "@playwright/test";

test.describe("Jobright Upgrade Features: Instant ATS Sandbox, Competitive Matrix, 3-Pane Tailor, and Signal Badges", () => {
  test("1. Landing page renders Instant ATS Sandbox and Competitive Matrix sections with full interactivity", async ({
    page,
  }) => {
    await page.goto("/");

    // Verify Ember Ink landing atmosphere and AsciiWaves canvas
    await expect(page.getByTestId("landing-atmosphere")).toBeVisible();
    await expect(page.getByTestId("ascii-waves-canvas")).toBeVisible();

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
    await expect(svgContainer.locator("svg")).toBeVisible({ timeout: 15000 });
    const sandboxSvgSecurity = await svgContainer.locator("svg").first().evaluate((svg) => ({
      unsafeTags: svg.querySelectorAll("script, style, foreignObject").length,
      unsafeEventAttrs: Array.from(svg.querySelectorAll("*")).some((el) =>
        Array.from(el.attributes).some((attr) => /^on/i.test(attr.name))
      ),
      unsafeLinks: Array.from(svg.querySelectorAll("a")).filter((a) => {
        const href = a.getAttribute("href") ?? a.getAttribute("xlink:href") ?? "";
        return /^(?:javascript|data|vbscript|file):/i.test(href);
      }).length,
      unsafeExternalRefs: Array.from(svg.querySelectorAll("use, image")).filter((el) => {
        const href = el.getAttribute("href") ?? el.getAttribute("xlink:href") ?? "";
        return href.length > 0 && !href.startsWith("#");
      }).length,
    }));
    expect(sandboxSvgSecurity).toEqual({
      unsafeTags: 0,
      unsafeEventAttrs: false,
      unsafeLinks: 0,
      unsafeExternalRefs: 0,
    });

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

    await expect(matrixSection).toContainText("ResumeForge (Guest / Postgres)");
    await expect(matrixSection).toContainText("Competitors");
    await expect(matrixSection).not.toContainText(/\bTeal\b/i);
    await expect(matrixSection).not.toContainText(/\bSimplify\b/i);
  });

  test("2. Tailor workspace review-first layout coordinates Primary Review, Secondary Preview/ATS, Sheet, and Source toggle cleanly", async ({
    page,
  }) => {
    await page.goto("/tailor");

    // Verify Workspace tab button exists
    const tab3Pane = page.getByTestId("tailor-tab-3-pane");
    await expect(tab3Pane).toBeVisible();

    // Click Workspace tab
    await tab3Pane.click();

    // Workspace container is mounted
    const container3Pane = page.getByTestId("tailor-3pane-container");
    await expect(container3Pane).toBeVisible();

    // Primary Review & Secondary Preview/ATS panes
    const primaryPane = page.getByTestId("tailor-pane-center");
    await expect(primaryPane).toBeVisible();

    const secondaryPane = page.getByTestId("tailor-pane-right");
    await expect(secondaryPane).toBeVisible();
    await expect(secondaryPane.getByTestId("ats-score-panel")).toBeVisible();

    // Switch secondary pane to Job Details to inspect TechDiffPillList & keyword highlights
    await page.getByTestId("workspace-secondary-job-tab").click();
    const highlightedJd = secondaryPane.getByTestId("tailor-jd-highlighted-view");
    await expect(highlightedJd).toBeVisible();

    const markTags = highlightedJd.locator("mark");
    await expect(markTags.first()).toBeVisible();
    await expect(highlightedJd).toContainText("Go");
    await expect(highlightedJd).toContainText("Python");
    await expect(secondaryPane.getByTestId("tech-diff-pill-list")).toBeVisible();

    // Open on-demand Requirements & JD Sheet
    await page.getByTestId("workspace-job-details-btn").click();
    const jdSheet = page.getByRole("dialog");
    await expect(jdSheet).toBeVisible();
    await expect(jdSheet.getByTestId("tech-diff-pill-list")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(jdSheet).not.toBeVisible();

    // Toggle optional Typst Source view
    await page.getByTestId("toggle-typst-source-btn").click();
    await expect(page.getByTestId("typst-ast-preview")).toBeVisible();

    // Transition to Job Info tab via context bar button
    const editJobBtn = page.getByTestId("edit-job-info-btn");
    await expect(editJobBtn).toBeVisible();
    await editJobBtn.click();

    await expect(page.getByTestId("tailor-job-info-panel")).toBeVisible();
    await expect(container3Pane).not.toBeVisible();

    // Verify Back button returns directly to Workspace
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
          hasEvidence: true,
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

  test("4. Review-first Workspace, on-demand Sheet, and tab navigation adapt smoothly to mobile viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/tailor?tab=3-pane");

    const container3Pane = page.getByTestId("tailor-3pane-container");
    await expect(container3Pane).toBeVisible();

    // Primary review and secondary preview/ATS panes stack cleanly on mobile
    const centerPane = page.getByTestId("tailor-pane-center");
    const rightPane = page.getByTestId("tailor-pane-right");

    await expect(centerPane).toBeVisible();
    await expect(rightPane).toBeVisible();

    // On-demand Requirements & JD Sheet works cleanly on mobile
    await page.getByTestId("workspace-job-details-btn").click();
    const jdSheet = page.getByRole("dialog");
    await expect(jdSheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(jdSheet).not.toBeVisible();

    // Verify tab buttons exist and are accessible
    const tabOverview = page.getByTestId("tailor-tab-overview");
    const tab3Pane = page.getByTestId("tailor-tab-3-pane");
    const tabJobInfo = page.getByTestId("tailor-tab-job-info");

    await expect(tabOverview).toBeVisible();
    await expect(tab3Pane).toBeVisible();
    await expect(tabJobInfo).toBeVisible();
  });
});
