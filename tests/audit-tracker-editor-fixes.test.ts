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
});
