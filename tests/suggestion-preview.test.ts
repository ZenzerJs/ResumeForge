import { describe, it, expect } from "vitest";
import {
  createSuggestionPreviewCaches,
  resolveSuggestionPreview,
  type SuggestionPreviewState,
} from "@/components/tailor/suggestion-preview";
import type { PreviewTextItem } from "@/lib/typst/preview-mapping";

function createFakeRenderer() {
  const calls: Array<{ source: string; renderPages: boolean }> = [];
  const renderReview = async (source: string, renderPages = true) => {
    calls.push({ source, renderPages });
    const items: PreviewTextItem[] = [];
    for (const [idx, line] of source.split("\n").entries()) {
      const text = line.replace(/^\s*-\s*/, "").trim();
      if (text) {
        items.push({ text, page: idx, left: 10, top: 20 + idx * 10, width: 40, height: 3 });
      }
    }
    return {
      pages: renderPages ? [`data:image/png;base64,${Buffer.from(source).toString("base64").slice(0, 12)}`] : [],
      items,
    };
  };
  return { calls, renderReview };
}

describe("PERF-02a SuggestionPreview cache & probe separation", () => {
  const base = "- Alpha service\n- Second bullet";
  const suggestedAll = "- Beta platform\n- Updated bullet";
  const suggestedOnlySecond = "- Alpha service\n- Updated bullet";

  it("caches main renders and probes per source+patch+anchor and reuses them on view switch", async () => {
    const caches = createSuggestionPreviewCaches();
    const { calls, renderReview } = createFakeRenderer();
    const updates: SuggestionPreviewState[] = [];

    const batchKey = JSON.stringify({ base, patches: ["p1", "p2"] });

    // 1. Original view
    await resolveSuggestionPreview({
      caches,
      batchKey,
      effectKey: "orig",
      source: base,
      anchors: [
        { id: "p1", anchor: "- Alpha service" },
        { id: "p2", anchor: "- Second bullet" },
      ],
      pinnedSources: [base, suggestedAll],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });
    expect(calls).toHaveLength(3); // 1 main + 2 probes
    expect(updates.at(-1)?.isProbing).toBe(false);
    expect(Object.keys(updates.at(-1)?.locations ?? {})).toEqual(["p1", "p2"]);

    // 2. Switch to Suggested
    await resolveSuggestionPreview({
      caches,
      batchKey,
      effectKey: "sugg",
      source: suggestedAll,
      anchors: [
        { id: "p1", anchor: "- Beta platform" },
        { id: "p2", anchor: "- Updated bullet" },
      ],
      pinnedSources: [base, suggestedAll],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });
    expect(calls).toHaveLength(6); // 1 main + 2 probes

    // 3. Switch back to Original -> 0 compiles
    const beforeSwitchBack = calls.length;
    await resolveSuggestionPreview({
      caches,
      batchKey,
      effectKey: "orig",
      source: base,
      anchors: [
        { id: "p1", anchor: "- Alpha service" },
        { id: "p2", anchor: "- Second bullet" },
      ],
      pinnedSources: [base, suggestedAll],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });
    expect(calls).toHaveLength(beforeSwitchBack);
    expect(updates.at(-1)?.isProbing).toBe(false);
    expect(Object.keys(updates.at(-1)?.locations ?? {})).toEqual(["p1", "p2"]);
  });

  it("discards stale coordinates immediately when Suggested source genuinely changes and reuses prior source on revert", async () => {
    const caches = createSuggestionPreviewCaches();
    const { calls, renderReview } = createFakeRenderer();
    const updates: SuggestionPreviewState[] = [];
    const batchKey = "b1";

    await resolveSuggestionPreview({
      caches,
      batchKey,
      effectKey: "s1",
      source: suggestedAll,
      anchors: [{ id: "p1", anchor: "- Beta platform" }],
      pinnedSources: [base, suggestedAll],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });

    const countBeforeReject = calls.length;
    updates.length = 0;

    // Reject p1 -> source changes to suggestedOnlySecond
    await resolveSuggestionPreview({
      caches,
      batchKey,
      effectKey: "s2",
      source: suggestedOnlySecond,
      anchors: [{ id: "p1", anchor: "- Alpha service" }],
      pinnedSources: [base, suggestedOnlySecond],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });

    // First update discarded stale pages & coordinates while rendering new source
    expect(updates[0]).toEqual({
      key: "s2",
      pages: null,
      locations: {},
      isProbing: true,
    });
    expect(calls.length).toBeGreaterThan(countBeforeReject);

    // Re-accept p1 -> switches back to suggestedAll with 0 compiles
    const countBeforeReaccept = calls.length;
    await resolveSuggestionPreview({
      caches,
      batchKey,
      effectKey: "s1",
      source: suggestedAll,
      anchors: [{ id: "p1", anchor: "- Beta platform" }],
      pinnedSources: [base, suggestedAll],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });
    expect(calls.length).toBe(countBeforeReaccept);
  });

  it("resets caches on batch change and stops cancelled probing", async () => {
    const caches = createSuggestionPreviewCaches();
    const { calls, renderReview } = createFakeRenderer();
    let cancelled = false;
    const updates: SuggestionPreviewState[] = [];

    await resolveSuggestionPreview({
      caches,
      batchKey: "batch-1",
      effectKey: "k1",
      source: base,
      anchors: [
        { id: "p1", anchor: "- Alpha service" },
        { id: "p2", anchor: "- Second bullet" },
      ],
      pinnedSources: [base],
      renderReview: async (source, renderPages) => {
        const res = await renderReview(source, renderPages);
        if (!renderPages) cancelled = true;
        return res;
      },
      isCancelled: () => cancelled,
      onUpdate: (state) => updates.push(state),
    });

    // Main + first probe ran, second probe skipped because cancelled became true
    expect(calls).toHaveLength(2);
    expect(updates.every((u) => u.isProbing === true)).toBe(true);

    // New batch clears caches
    cancelled = false;
    await resolveSuggestionPreview({
      caches,
      batchKey: "batch-2",
      effectKey: "k2",
      source: base,
      anchors: [{ id: "p1", anchor: "- Alpha service" }],
      pinnedSources: [base],
      renderReview,
      isCancelled: () => false,
      onUpdate: (state) => updates.push(state),
    });
    expect(calls).toHaveLength(4); // Recompiled in new batch
  });
});
