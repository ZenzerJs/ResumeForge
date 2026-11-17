import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  TAILOR_PRIMARY_TABS,
  TAILOR_MORE_TOOLS,
  normalizeTailorTabParam,
  isPrimaryTailorTab,
  isMoreToolTab,
  getTailorToolLabel,
  getTailorPanelLabelledBy,
  getTailorBackLabel,
  createInitialTailorNavigationState,
  transitionTailorNavigation,
  formatRequirementSourceLabel,
  formatJobDiagnosticLabel,
} from "@/components/tailor/tailor-workspace";

describe("Tailor task-sequence navigation & state helpers", () => {
  it("exposes exactly two primary tabs ('Job' and 'Review edits') and three secondary tools", () => {
    expect(TAILOR_PRIMARY_TABS).toEqual([
      { id: "job-info", label: "Job", testId: "tailor-tab-job-info" },
      { id: "3-pane", label: "Review edits", testId: "tailor-tab-3-pane" },
    ]);

    expect(TAILOR_MORE_TOOLS).toEqual([
      { id: "overview", label: "Overview", testId: "tailor-tool-overview" },
      { id: "cover-letter", label: "Cover letter", testId: "tailor-tool-cover-letter" },
      { id: "diagnostic", label: "Diagnostics", testId: "tailor-tool-diagnostic" },
    ]);

    for (const tab of [...TAILOR_PRIMARY_TABS, ...TAILOR_MORE_TOOLS]) {
      expect(tab.label).not.toMatch(/3-pane|workspace/i);
    }
  });

  it("normalizes all 5 legacy ?tab= values and falls back to job-info on unknown values", () => {
    expect(normalizeTailorTabParam("job-info")).toBe("job-info");
    expect(normalizeTailorTabParam("3-pane")).toBe("3-pane");
    expect(normalizeTailorTabParam("overview")).toBe("overview");
    expect(normalizeTailorTabParam("cover-letter")).toBe("cover-letter");
    expect(normalizeTailorTabParam("diagnostic")).toBe("diagnostic");

    expect(normalizeTailorTabParam(null)).toBe("job-info");
    expect(normalizeTailorTabParam(undefined)).toBe("job-info");
    expect(normalizeTailorTabParam("")).toBe("job-info");
    expect(normalizeTailorTabParam("unknown-view")).toBe("job-info");
  });

  it("classifies primary tabs vs More tools and resolves valid aria-labelledby targets", () => {
    expect(isPrimaryTailorTab("job-info")).toBe(true);
    expect(isPrimaryTailorTab("3-pane")).toBe(true);
    expect(isPrimaryTailorTab("overview")).toBe(false);
    expect(isPrimaryTailorTab("cover-letter")).toBe(false);
    expect(isPrimaryTailorTab("diagnostic")).toBe(false);

    expect(isMoreToolTab("overview")).toBe(true);
    expect(isMoreToolTab("cover-letter")).toBe(true);
    expect(isMoreToolTab("diagnostic")).toBe(true);
    expect(isMoreToolTab("job-info")).toBe(false);
    expect(isMoreToolTab("3-pane")).toBe(false);

    expect(getTailorPanelLabelledBy("job-info")).toBe("tailor-tab-job-info");
    expect(getTailorPanelLabelledBy("3-pane")).toBe("tailor-tab-3-pane");
    expect(getTailorPanelLabelledBy("overview")).toBe("tailor-tool-heading-overview");
    expect(getTailorPanelLabelledBy("cover-letter")).toBe("tailor-tool-heading-cover-letter");
    expect(getTailorPanelLabelledBy("diagnostic")).toBe("tailor-tool-heading-diagnostic");

    expect(getTailorToolLabel("job-info")).toBe("Job");
    expect(getTailorToolLabel("3-pane")).toBe("Review edits");
    expect(getTailorToolLabel("overview")).toBe("Overview");
    expect(getTailorToolLabel("cover-letter")).toBe("Cover letter");
    expect(getTailorToolLabel("diagnostic")).toBe("Diagnostics");
  });

  it("never sets a spurious Back button on fresh initial load", () => {
    for (const rawParam of [null, undefined, "job-info", "3-pane", "overview", "cover-letter", "diagnostic", "bogus"]) {
      const initial = createInitialTailorNavigationState(rawParam);
      expect(initial.previousTab).toBeNull();
      expect(getTailorBackLabel(initial.previousTab)).toBeNull();
    }
  });

  it("tracks previousTab only on explicit in-page return-preserving transitions and clears on primary/tool navigation", () => {
    let state = createInitialTailorNavigationState("3-pane");
    expect(state).toEqual({ activeTab: "3-pane", previousTab: null });

    state = transitionTailorNavigation(state, "job-info", { preserveReturnRoute: true });
    expect(state).toEqual({ activeTab: "job-info", previousTab: "3-pane" });
    expect(getTailorBackLabel(state.previousTab)).toBe("← Back to Review edits");

    state = transitionTailorNavigation(state, "3-pane");
    expect(state).toEqual({ activeTab: "3-pane", previousTab: null });
    expect(getTailorBackLabel(state.previousTab)).toBeNull();

    state = transitionTailorNavigation(state, "overview");
    expect(state).toEqual({ activeTab: "overview", previousTab: null });

    state = transitionTailorNavigation(state, "job-info", { preserveReturnRoute: true });
    expect(state).toEqual({ activeTab: "job-info", previousTab: "overview" });
    expect(getTailorBackLabel(state.previousTab)).toBe("← Back to Overview");

    // Same-tab transition should never set previousTab to itself
    state = transitionTailorNavigation(
      { activeTab: "job-info", previousTab: null },
      "job-info",
      { preserveReturnRoute: true }
    );
    expect(state).toEqual({ activeTab: "job-info", previousTab: null });
  });

  it("keeps DropdownMenu for More tools, two primary role='tab' buttons, disclosure diagnostics, and Settings save-before-navigation intact", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/components/tailor/tailor-workspace.tsx"),
      "utf8"
    );

    expect(src).toContain("DropdownMenu");
    expect(src).toContain("DropdownMenuTrigger");
    expect(src).toContain("DropdownMenuContent");
    expect(src).toContain("DropdownMenuItem");
    expect(src).toContain('data-testid="tailor-more-tools-trigger"');
    expect(src).toContain('data-testid="job-extraction-diagnostics-details"');
    expect(src).toContain('data-testid="job-extraction-diagnostics-summary"');
    expect(src).toContain("Suggest resume edits");
    expect(src).toContain("handleOpenSettings");
    expect(src).toContain("handleOpenEditor");
    expect(src).toContain("handleOpenLibrary");
    expect(src).toContain("requireSuccess: true");
    expect(src).toContain('data-testid="job-load-error-banner"');
    expect(src).toContain('href="/tracker"');
    expect(src).toContain("pendingNavTarget");
    expect(src).toContain("[targetJobToLoad, fetchMatches, triggerTier2Fetch]");
    expect(src).toContain("[activeTab, isBootstrapping, isLoadingJob]");
    expect(src).not.toContain("Open in 3-Pane Tailor");
    expect(src).not.toContain("Back to 3-Pane Workspace");
    expect(src).not.toContain(">USER_ADDED<");
  });

  it("formats requirement and diagnostic statuses in plain English", () => {
    expect(formatRequirementSourceLabel("USER_ADDED")).toBe("Added manually");
    expect(formatRequirementSourceLabel("USER_PASTED")).toBe("Pasted job posting");
    expect(formatJobDiagnosticLabel("USER_PASTED")).toBe("Pasted job posting");
    expect(formatJobDiagnosticLabel("PASTED")).toBe("Pasted job posting");
    expect(formatJobDiagnosticLabel("VERIFIED_ATS")).toBe("Verified ATS source");
    expect(formatJobDiagnosticLabel("STRUCTURED_PAGE")).toBe("Structured posting page");
    expect(formatJobDiagnosticLabel("PARTIAL_EXTRACTION")).toBe("Partial posting extraction");
  });
});
