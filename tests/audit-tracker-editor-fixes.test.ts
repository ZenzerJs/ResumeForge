import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { mergePatchedGuestJobs } from "@/components/tracker/tracker-feed";
import { extractPromotedJobId } from "@/components/tracker/discover-feed";
import { parseJobDescription } from "@/lib/jd-parser/parser";

const ROOT = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Tracker, Editor, DSA, and Typst Audit Fixes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("1. TrackerFeed mergePatchedGuestJobs updates only the targeted job without overwriting other rows", () => {
    const prev = [
      { id: "job-1", company: "Acme", roleTitle: "Backend Engineer", status: "SAVED" },
      { id: "job-2", company: "Globex", roleTitle: "Frontend Engineer", status: "SAVED" },
      { id: "job-3", company: "Initech", roleTitle: "Platform Engineer", status: "APPLIED" },
    ];
    const next = prev.map((job) =>
      job.id === "job-2" ? { ...job, status: "INTERVIEWING" } : job
    );

    const merged = mergePatchedGuestJobs(prev, next);

    expect(merged).toHaveLength(3);
    expect(merged.map((j) => j.id)).toEqual(["job-1", "job-2", "job-3"]);
    expect(merged[0]).toEqual(prev[0]);
    expect(merged[1].status).toBe("INTERVIEWING");
    expect(merged[2]).toEqual(prev[2]);
  });

  it("1b. TrackerFeed guards non-JSON responses and surfaces !res.ok errors in patchJob", () => {
    const src = readProjectFile("src/components/tracker/tracker-feed.tsx");
    const patchStart = src.indexOf("const patchJob = async");
    const saveNotesStart = src.indexOf("const handleSaveNotes = async");
    const patchBlock = src.slice(patchStart, saveNotesStart);

    expect(src).toContain("item.id === job.id");
    expect(patchBlock).not.toContain("item.id === jobId");
    expect(patchBlock).toContain("mergePatchedGuestJobs");
    expect(patchBlock).toContain("readJsonSafe");
    expect(patchBlock).toContain("Shared catalog postings are read-only and cannot be updated.");
    expect(patchBlock).toContain("Failed to update application");
  });

  it("2. DiscoverFeed extractPromotedJobId supports direct job.id and nested job.id without falling back to 'tracked'", () => {
    expect(extractPromotedJobId({ id: "job-direct-1", status: "SAVED" })).toEqual({
      id: "job-direct-1",
      status: "SAVED",
    });
    expect(extractPromotedJobId({ job: { id: "job-nested-2", status: "APPLIED" } })).toEqual({
      id: "job-nested-2",
      status: "APPLIED",
    });
    expect(extractPromotedJobId({})).toEqual({ id: null, status: "SAVED" });
    expect(extractPromotedJobId(null)).toEqual({ id: null, status: "SAVED" });
  });

  it("2b. DiscoverFeed handles DEMO_MODE sync/promote and never falls back to 'tracked'", () => {
    const src = readProjectFile("src/components/tracker/discover-feed.tsx");
    expect(src).not.toContain('|| "tracked"');
    expect(src).toContain("fetchDemoConfig");
    expect(src).toContain("resumeforge_guest_jobs");
    expect(src).toContain("readJsonSafe");
  });

  it("3. AiSidebar resolves fetchDemoConfig() before /api/jobs/extract and falls back to parseJobDescription in DEMO_MODE", () => {
    const src = readProjectFile("src/components/editor/ai-sidebar.tsx");
    const handleTailorStart = src.indexOf("const handleTailor = useCallback");
    const demoCallIndex = src.indexOf("const demoConfig = await fetchDemoConfig()", handleTailorStart);
    const extractCallIndex = src.indexOf('fetch("/api/jobs/extract"', handleTailorStart);
    const clientFallbackIndex = src.indexOf("parseJobDescription(jdText)", handleTailorStart);

    expect(handleTailorStart).toBeGreaterThan(-1);
    expect(demoCallIndex).toBeGreaterThan(handleTailorStart);
    expect(clientFallbackIndex).toBeGreaterThan(demoCallIndex);
    expect(extractCallIndex).toBeGreaterThan(demoCallIndex);
    expect(src).toContain("readJsonSafe");

    const parsed = parseJobDescription(
      "Requirements:\n- TypeScript and React experience\nPreferred:\n- PostgreSQL"
    );
    expect(parsed.requiredSkills).toContain("TypeScript");
    expect(parsed.requiredSkills).toContain("React");
    expect(parsed.preferredSkills).toContain("PostgreSQL");
  });

  it("4. DsaWorkspace wraps handleAskCoach and handleAuditScorecard with catch blocks and visible error alerts", () => {
    const src = readProjectFile("src/components/interview/dsa-workspace.tsx");
    const askStart = src.indexOf("const handleAskCoach = async");
    const auditStart = src.indexOf("const handleAuditScorecard = async");
    const runStart = src.indexOf("const handleRun = async");

    const askBlock = src.slice(askStart, auditStart);
    const auditBlock = src.slice(auditStart, runStart);

    expect(askBlock).toContain("catch (err)");
    expect(askBlock).toContain("setCoachError(");
    expect(auditBlock).toContain("catch (err)");
    expect(auditBlock).toContain("setAuditError(");
    expect(src).toContain('data-testid="dsa-coach-error"');
    expect(src).toContain('data-testid="dsa-audit-error"');
  });

  it("5. Typst compiler.worker passes { module_or_path } object to getModule and initializes WASM without deprecation warning", async () => {
    const setCompilerInitOptions = vi.fn();
    const setRendererInitOptions = vi.fn();
    const svg = vi.fn().mockResolvedValue("<svg></svg>");
    const pdf = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]));
    const postMessage = vi.fn();

    vi.resetModules();
    const workerGlobal: {
      location: { origin: string };
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: typeof postMessage;
    } = {
      location: { origin: "http://127.0.0.1:3005" },
      onmessage: null,
      postMessage,
    };
    vi.stubGlobal("self", workerGlobal);

    vi.doMock("@myriaddreamin/typst.ts", () => ({
      $typst: {
        setCompilerInitOptions,
        setRendererInitOptions,
        svg,
        pdf,
      },
      loadFonts: vi.fn(() => () => {}),
    }));

    await import("@/lib/typst/compiler.worker");
    expect(workerGlobal.onmessage).toBeTypeOf("function");

    workerGlobal.onmessage!({
      data: { id: 1, kind: "svg", source: "= Hello" },
    } as MessageEvent);

    await vi.waitFor(() => {
      expect(postMessage).toHaveBeenCalledWith({
        id: 1,
        kind: "svg",
        ok: true,
        svg: "<svg></svg>",
      });
    });

    const compilerOpts = setCompilerInitOptions.mock.calls[0][0];
    const rendererOpts = setRendererInitOptions.mock.calls[0][0];
    expect(compilerOpts.getModule()).toEqual({
      module_or_path: "http://127.0.0.1:3005/wasm/typst_ts_web_compiler_bg.wasm",
    });
    expect(rendererOpts.getModule()).toEqual({
      module_or_path: "http://127.0.0.1:3005/wasm/typst_ts_renderer_bg.wasm",
    });

    vi.doUnmock("@myriaddreamin/typst.ts");
    vi.resetModules();

    // Verify against real @myriaddreamin/typst.ts WASM binaries in public/wasm/ with zero console.warn
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { $typst, loadFonts } = await import("@myriaddreamin/typst.ts");
    const compBytes = fs.readFileSync(path.join(ROOT, "public/wasm/typst_ts_web_compiler_bg.wasm"));
    const rendBytes = fs.readFileSync(path.join(ROOT, "public/wasm/typst_ts_renderer_bg.wasm"));

    $typst.setCompilerInitOptions({
      getModule: () => ({ module_or_path: compBytes }) as unknown as string,
      beforeBuild: [loadFonts([], { assets: false })],
    });
    $typst.setRendererInitOptions({
      getModule: () => ({ module_or_path: rendBytes }) as unknown as string,
    });

    const rendered = await $typst.svg({ mainContent: "= Audit Test" });
    expect(rendered).toContain("<svg");
    expect(warnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("using deprecated parameters for the initialization function")
    );
  });

  it("6. phase10-repair.spec.ts waits for waveCanvas width >= 1600 after setViewportSize", () => {
    const spec = readProjectFile("e2e/phase10-repair.spec.ts");
    const resizeIdx = spec.indexOf("await page.setViewportSize({ width: 1600, height: 900 });");
    const evalIdx = spec.indexOf("const canvasMetrics = await waveCanvas.evaluate", resizeIdx);
    const pollSection = spec.slice(resizeIdx, evalIdx);

    expect(resizeIdx).toBeGreaterThan(-1);
    expect(evalIdx).toBeGreaterThan(resizeIdx);
    expect(pollSection).toContain("expect");
    expect(pollSection).toContain("poll");
    expect(pollSection).toContain("el.width");
    expect(pollSection).toContain("1600");
  });

  it("7. EditorWorkspace and ConfirmMasterDialog surface save errors inside the open dialog with role='alert' and Retry", () => {
    const editorSrc = readProjectFile("src/components/editor/editor-workspace.tsx");
    const saveStart = editorSrc.indexOf("const handleConfirmSaveAsMaster = async");
    const revertStart = editorSrc.indexOf("const handleRevertToMaster =");
    const saveBlock = editorSrc.slice(saveStart, revertStart);

    expect(saveBlock).toContain("throw new Error(");
    expect(saveBlock).toContain("throw err instanceof Error ? err : new Error(msg)");

    const dialogSrc = readProjectFile("src/components/editor/confirm-master-dialog.tsx");
    const handleConfirmStart = dialogSrc.indexOf("const handleConfirm = async");
    const returnStart = dialogSrc.indexOf("return (", handleConfirmStart);
    const handleConfirmBlock = dialogSrc.slice(handleConfirmStart, returnStart);

    expect(handleConfirmBlock).toContain("catch (err)");
    expect(handleConfirmBlock).toContain("setSaveError(");
    expect(dialogSrc).toContain('role="alert"');
    expect(dialogSrc).toContain('data-testid="confirm-master-save-error"');
    expect(dialogSrc).toContain('data-testid="confirm-save-master-retry-btn"');
    expect(dialogSrc).toContain("Retry");
  });

  it("8. JobDetailPane renders explicit status text on every checklist row and clarifies required-skill coverage", () => {
    const src = readProjectFile("src/components/tracker/job-detail-pane.tsx");
    const coverageStart = src.indexOf('data-testid="tracker-required-evidence-coverage"');
    const checklistStart = src.indexOf("checklist.items.map");
    const coverageBlock = src.slice(coverageStart, checklistStart);
    const checklistBlock = src.slice(checklistStart, src.indexOf("</ul>", checklistStart));

    expect(coverageBlock).toContain("Required-skill coverage:");
    expect(coverageBlock).toContain("{requiredMatched}/{requiredEvidence.length}");
    expect(coverageBlock).toContain("aria-label={`Required-skill coverage:");

    expect(checklistBlock).toContain("Verified:");
    expect(checklistBlock).toContain("Needs verification");
    expect(checklistBlock).toContain("Missing:");
    expect(checklistBlock).toContain("aria-hidden");
  });

  it("9. TrackerFeed reads resumeforge_guest_jobs for any signed-out guest and supports arrow-key roving tablist", () => {
    const src = readProjectFile("src/components/tracker/tracker-feed.tsx");
    const fetchStart = src.indexOf("const fetchJobs = useCallback");
    const fetchEnd = src.indexOf("const params = new URLSearchParams", fetchStart);
    const fetchBlock = src.slice(fetchStart, fetchEnd);

    expect(fetchBlock).toContain("fetchSessionPayload");
    expect(fetchBlock).toContain("sessionPayload?.guest === true");
    expect(fetchBlock).toContain("!sessionPayload?.data");
    expect(fetchBlock).toContain('localStorage.getItem("resumeforge_guest_jobs")');

    const tablistStart = src.indexOf('aria-label="Tracker display mode"');
    const tablistBlock = src.slice(tablistStart, src.indexOf("Kanban Board", tablistStart) + 300);
    expect(tablistBlock).toContain("onKeyDown=");
    expect(tablistBlock).toContain("ArrowRight");
    expect(tablistBlock).toContain("ArrowLeft");
    expect(tablistBlock).toContain("Home");
    expect(tablistBlock).toContain("End");
    expect(tablistBlock).toContain('tabIndex={viewMode === "split" ? 0 : -1}');
    expect(tablistBlock).toContain('tabIndex={viewMode === "kanban" ? 0 : -1}');
  });

  it("10. fetchSessionPayload returns { data: null, guest: false, error: true } on HTTP 502 and network/parse failures without caching errors", async () => {
    const user = { id: "user-1", email: "alice@example.com", username: "alice" };

    vi.resetModules();
    const fetch502ThenOk = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => ({ error: "Bad Gateway" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: user, guest: false }),
      });
    vi.stubGlobal("fetch", fetch502ThenOk);

    let sessionMod = await import("@/components/auth/session-user");
    const first = await sessionMod.fetchSessionPayload();
    expect(first).toEqual({ data: null, guest: false, error: true });

    const second = await sessionMod.fetchSessionPayload();
    expect(second).toEqual({ data: user, guest: false });
    expect(fetch502ThenOk).toHaveBeenCalledTimes(2);

    const third = await sessionMod.fetchSessionPayload();
    expect(third).toEqual({ data: user, guest: false });
    expect(fetch502ThenOk).toHaveBeenCalledTimes(2);

    vi.resetModules();
    const fetchNetAndParseThenGuest = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected end of JSON input");
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: null, guest: true }),
      });
    vi.stubGlobal("fetch", fetchNetAndParseThenGuest);

    sessionMod = await import("@/components/auth/session-user");
    expect(await sessionMod.fetchSessionPayload()).toEqual({
      data: null,
      guest: false,
      error: true,
    });
    expect(await sessionMod.fetchSessionUser()).toBeNull();
    expect(await sessionMod.fetchSessionPayload()).toEqual({ data: null, guest: true });
    expect(fetchNetAndParseThenGuest).toHaveBeenCalledTimes(3);
  });

  it("11. TrackerFeed fetchJobs syncs authStatus before branching, bypasses guest storage on sessionPayload.error, and cleans up activeJobId for guests", () => {
    const src = readProjectFile("src/components/tracker/tracker-feed.tsx");
    const fetchStart = src.indexOf("const fetchJobs = useCallback");
    const fetchEnd = src.indexOf("const params = new URLSearchParams", fetchStart);
    const fetchBlock = src.slice(fetchStart, fetchEnd);

    const demoAuthIdx = fetchBlock.indexOf('setAuthStatus("guest")');
    const errorGuardIdx = fetchBlock.indexOf("!sessionPayload?.error");
    const authSyncIdx = fetchBlock.indexOf('setAuthStatus(isGuest ? "guest" : "authenticated")');
    const localStorageIdx = fetchBlock.indexOf('localStorage.getItem("resumeforge_guest_jobs")');

    expect(demoAuthIdx).toBeGreaterThan(-1);
    expect(errorGuardIdx).toBeGreaterThan(demoAuthIdx);
    expect(authSyncIdx).toBeGreaterThan(errorGuardIdx);
    expect(localStorageIdx).toBeGreaterThan(authSyncIdx);

    const jobsFetchEnd = src.indexOf("}, [page,", fetchEnd);
    const apiJobsBlock = src.slice(fetchEnd, jobsFetchEnd);
    expect(apiJobsBlock).toContain('fetch(`/api/jobs?${params.toString()}`');
    expect(apiJobsBlock).toContain("setImportNotice(formatApiError");

    const cleanupStart = src.indexOf('if ((!isDemoMode && authStatus !== "guest")');
    expect(cleanupStart).toBeGreaterThan(-1);
    const cleanupEnd = src.indexOf("]);", cleanupStart);
    const cleanupBlock = src.slice(cleanupStart, cleanupEnd + 3);
    expect(cleanupBlock).toContain("[isDemoMode, authStatus, isLoading, activeJobId, jobs]");
  });

  it("12. ConfirmMasterDialog Retry button disables when busy or confirmation is unchecked", () => {
    const dialogSrc = readProjectFile("src/components/editor/confirm-master-dialog.tsx");
    const retryStart = dialogSrc.indexOf('data-testid="confirm-save-master-retry-btn"') - 220;
    const retryEnd = dialogSrc.indexOf("Retry", retryStart + 220) + 40;
    const retryBlock = dialogSrc.slice(retryStart, retryEnd);

    expect(retryBlock).toContain("disabled={busy || !confirmed}");
    expect(retryBlock).not.toMatch(/disabled=\{busy\}\s/);
  });
});
