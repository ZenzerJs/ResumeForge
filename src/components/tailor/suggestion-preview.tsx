"use client";

import React from "react";
import type { PatchProposal } from "@/lib/ai/patch-schema";
import { buildPreviewCandidate } from "./preview-candidate";
import {
  literalPreviewText,
  locatePreviewText,
  provesPreviewMapping,
  type PreviewLocation,
  type PreviewTextItem,
} from "@/lib/typst/preview-mapping";

type Decision = "pending" | "accepted" | "rejected";

export type RenderReviewFn = (
  source: string,
  renderPages?: boolean,
  options?: { callerId?: string; mode?: "live" | "export" },
) => Promise<{ pages: string[]; items: PreviewTextItem[] }>;

export interface SuggestionPreviewCaches {
  batchKey: string;
  sources: Map<string, { pages: string[]; items: PreviewTextItem[] }>;
  probes: Map<string, PreviewLocation[] | null>;
}

export interface SuggestionPreviewState {
  key: string;
  pages: string[] | null;
  locations: Record<string, PreviewLocation[]>;
  isProbing: boolean;
  error?: string;
}

const MAX_SOURCE_CACHE_ENTRIES = 6;
const MAX_PROBE_CACHE_ENTRIES = 64;

export function createSuggestionPreviewCaches(): SuggestionPreviewCaches {
  return {
    batchKey: "",
    sources: new Map(),
    probes: new Map(),
  };
}

function setBoundedCache<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
  maxEntries: number,
  isPinned: (entryKey: string) => boolean,
) {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size <= maxEntries) return;
  for (const existingKey of cache.keys()) {
    if (cache.size <= maxEntries) break;
    if (existingKey !== key && !isPinned(existingKey)) {
      cache.delete(existingKey);
    }
  }
  while (cache.size > maxEntries) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined || oldest === key) break;
    cache.delete(oldest);
  }
}

function makeProbeKey(source: string, patchId: string, anchor: string): string {
  return `${source}\0${patchId}\0${anchor}`;
}

export async function resolveSuggestionPreview(params: {
  caches: SuggestionPreviewCaches;
  batchKey: string;
  effectKey: string;
  source: string;
  anchors: Array<{ id: string; anchor: string }>;
  pinnedSources: Array<string | null | undefined>;
  renderReview: RenderReviewFn;
  isCancelled: () => boolean;
  onUpdate: (state: SuggestionPreviewState) => void;
}) {
  const {
    caches,
    batchKey,
    effectKey,
    source,
    anchors,
    pinnedSources,
    renderReview,
    isCancelled,
    onUpdate,
  } = params;

  if (caches.batchKey !== batchKey) {
    caches.batchKey = batchKey;
    caches.sources.clear();
    caches.probes.clear();
  }

  const activePinned = pinnedSources.filter((value): value is string => Boolean(value));
  const isSourcePinned = (entryKey: string) => activePinned.includes(entryKey);
  const isProbePinned = (entryKey: string) =>
    activePinned.some((pinned) => entryKey.startsWith(`${pinned}\0`));

  const idCounts = new Map<string, number>();
  for (const item of anchors) {
    idCounts.set(item.id, (idCounts.get(item.id) || 0) + 1);
  }

  const locations: Record<string, PreviewLocation[]> = {};
  const pendingAnchors: Array<{ id: string; anchor: string; probeKey: string }> = [];

  for (const item of anchors) {
    if (idCounts.get(item.id) !== 1) continue;
    const probeKey = makeProbeKey(source, item.id, item.anchor);
    if (caches.probes.has(probeKey)) {
      const cachedLocation = caches.probes.get(probeKey);
      if (cachedLocation) locations[item.id] = cachedLocation;
    } else {
      pendingAnchors.push({ ...item, probeKey });
    }
  }

  let rendered = caches.sources.get(source);
  if (rendered) {
    if (pendingAnchors.length === 0) {
      onUpdate({
        key: effectKey,
        pages: rendered.pages,
        locations,
        isProbing: false,
      });
      return;
    }
    onUpdate({
      key: effectKey,
      pages: rendered.pages,
      locations: { ...locations },
      isProbing: true,
    });
  } else {
    // Discard stale coordinates from any previous source while rendering.
    onUpdate({
      key: effectKey,
      pages: null,
      locations: {},
      isProbing: true,
    });
    try {
      rendered = await renderReview(source, true, {
        callerId: "suggestion-preview",
        mode: "live",
      });
    } catch (error) {
      if (!isCancelled()) {
        onUpdate({
          key: effectKey,
          pages: [],
          locations: {},
          isProbing: false,
          error:
            error instanceof Error
              ? error.message
              : "Preview compilation failed.",
        });
      }
      return;
    }
    if (isCancelled()) return;
    setBoundedCache(
      caches.sources,
      source,
      rendered,
      MAX_SOURCE_CACHE_ENTRIES,
      isSourcePinned,
    );
    if (pendingAnchors.length === 0) {
      onUpdate({
        key: effectKey,
        pages: rendered.pages,
        locations,
        isProbing: false,
      });
      return;
    }
    onUpdate({
      key: effectKey,
      pages: rendered.pages,
      locations: { ...locations },
      isProbing: true,
    });
  }

  let currentLocations = { ...locations };
  for (const item of pendingAnchors) {
    if (isCancelled()) return;
    // Strip leading Typst line comments (e.g. // RF_BULLET:...) so anchored bullets still locate their rendered text.
    const candidateAnchor = item.anchor.replace(/^(?:[ \t]*\/\/[^\r\n]*\r?\n)+/, "");
    const text = literalPreviewText(candidateAnchor);
    if (!text) {
      setBoundedCache(caches.probes, item.probeKey, null, MAX_PROBE_CACHE_ENTRIES, isProbePinned);
      continue;
    }
    const anchorIndex = source.indexOf(item.anchor);
    if (anchorIndex < 0 || source.indexOf(item.anchor, anchorIndex + 1) >= 0) {
      setBoundedCache(caches.probes, item.probeKey, null, MAX_PROBE_CACHE_ENTRIES, isProbePinned);
      continue;
    }
    // Preserve a simple list marker in the source while probing its literal content.
    const rawText = candidateAnchor.replace(/^\s*[-+]\s+/, "").trim();
    const offset = item.anchor.indexOf(rawText);
    if (offset < 0) {
      setBoundedCache(caches.probes, item.probeKey, null, MAX_PROBE_CACHE_ENTRIES, isProbePinned);
      continue;
    }
    const index = anchorIndex + offset;
    const location = locatePreviewText(rendered.items, text);
    if (!location) {
      setBoundedCache(caches.probes, item.probeKey, null, MAX_PROBE_CACHE_ENTRIES, isProbePinned);
      continue;
    }
    let sentinel = "ResumeForgePreviewAnchor";
    while (source.includes(sentinel)) sentinel += "X";
    const probeSource =
      source.slice(0, index) +
      sentinel +
      source.slice(index + rawText.length);
    try {
      const probe = await renderReview(probeSource, false, {
        callerId: "suggestion-preview",
        mode: "live",
      });
      if (isCancelled()) return;
      if (provesPreviewMapping(rendered.items, probe.items, text, sentinel)) {
        setBoundedCache(
          caches.probes,
          item.probeKey,
          location,
          MAX_PROBE_CACHE_ENTRIES,
          isProbePinned,
        );
        currentLocations = { ...currentLocations, [item.id]: location };
        onUpdate({
          key: effectKey,
          pages: rendered.pages,
          locations: currentLocations,
          isProbing: true,
        });
      } else {
        setBoundedCache(caches.probes, item.probeKey, null, MAX_PROBE_CACHE_ENTRIES, isProbePinned);
      }
    } catch {
      if (isCancelled()) return;
      /* A failed probe means the location is unavailable. */
      setBoundedCache(caches.probes, item.probeKey, null, MAX_PROBE_CACHE_ENTRIES, isProbePinned);
    }
  }

  if (!isCancelled()) {
    onUpdate({
      key: effectKey,
      pages: rendered.pages,
      locations: currentLocations,
      isProbing: false,
    });
  }
}

interface Props {
  base: string | null | undefined;
  current: string;
  validBatch: boolean;
  localStorageSourceKey?: string;
  patches: PatchProposal[];
  decisions: Record<string, Decision>;
  selected: string | null;
  onSelect: (id: string) => void;
  onDecision: (id: string, decision: Decision) => void;
  renderReview?: RenderReviewFn;
  evidenceTitles?: Record<string, string>;
}

export function SuggestionPreview({
  base,
  current,
  validBatch,
  localStorageSourceKey,
  patches,
  decisions,
  selected,
  onSelect,
  onDecision,
  renderReview,
  evidenceTitles,
}: Props) {
  const [localCurrent, setLocalCurrent] = React.useState<
    string | null | undefined
  >(undefined);
  React.useEffect(() => {
    if (!localStorageSourceKey) return;
    const check = () =>
      setLocalCurrent(localStorage.getItem(localStorageSourceKey));
    check();
    window.addEventListener("storage", check);
    window.addEventListener("focus", check);
    return () => {
      window.removeEventListener("storage", check);
      window.removeEventListener("focus", check);
    };
  }, [localStorageSourceKey, current]);
  const [view, setView] = React.useState<"original" | "suggested">("original");
  const [result, setResult] = React.useState<SuggestionPreviewState | null>(null);
  const cachesRef = React.useRef<SuggestionPreviewCaches | null>(null);
  if (!cachesRef.current) {
    cachesRef.current = createSuggestionPreviewCaches();
  }
  const renderReviewRef = React.useRef(renderReview);
  renderReviewRef.current = renderReview;

  const candidate = React.useMemo(() => {
    if (
      !base ||
      base !== current ||
      !validBatch ||
      (localStorageSourceKey && localCurrent !== base)
    )
      return null;
    return buildPreviewCandidate(base, patches, decisions);
  }, [
    base,
    current,
    validBatch,
    patches,
    decisions,
    localStorageSourceKey,
    localCurrent,
  ]);
  const batchKey = React.useMemo(
    () =>
      JSON.stringify({
        base: base ?? null,
        patches: patches.map(({ id, before, after }) => ({ id, before, after })),
      }),
    [base, patches],
  );
  const displayed = candidate
    ? view === "original"
      ? base ?? null
      : candidate.source
    : null;
  const anchorTargets = React.useMemo(() => {
    if (!candidate || !displayed) return [];
    return patches.map((patch) => ({
      id: patch.id,
      anchor:
        view === "original" || !candidate.included.includes(patch.id)
          ? patch.before
          : patch.after,
    }));
  }, [candidate, displayed, patches, view]);
  const key =
    candidate && displayed
      ? JSON.stringify({
          batchKey,
          displayed,
          anchors: anchorTargets,
        })
      : null;
  const detailRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  React.useEffect(() => {
    if (!key || !displayed) return;
    const snapshot = JSON.parse(key) as {
      batchKey: string;
      displayed: string;
      anchors: Array<{ id: string; anchor: string }>;
    };
    let cancelled = false;
    const pinnedSources = [base, candidate?.source];
    void resolveSuggestionPreview({
      caches: cachesRef.current!,
      batchKey: snapshot.batchKey,
      effectKey: key,
      source: snapshot.displayed,
      anchors: snapshot.anchors,
      pinnedSources,
      renderReview: async (source, renderPages, options) => {
        if (renderReviewRef.current) {
          return renderReviewRef.current(source, renderPages, options);
        }
        const { renderTypstReview } = await import("@/lib/typst/compiler");
        return renderTypstReview(source, renderPages, options);
      },
      isCancelled: () => cancelled,
      onUpdate: (nextState) => {
        if (!cancelled) setResult(nextState);
      },
    });
    return () => {
      cancelled = true;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps -- `key` already serializes batchKey, displayed source, and anchors; base/candidate?.source only pin cache eviction.

  if (!candidate)
    return (
      <div
        role="status"
        className="rounded-lg border border-amber-800 p-3 text-xs text-amber-200"
      >
        Preview unavailable: this proposal no longer matches the current resume
        or batch. Generate suggestions again.
      </div>
    );
  const active = key && result?.key === key ? result : null;
  const selectedPatch = patches.find((patch) => patch.id === selected);
  return (
    <section
      className="space-y-3 rounded-xl border border-hairline bg-panel p-3"
      aria-label="Resume suggestion preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Review on resume</h3>
          <p className="text-xs text-muted-foreground">
            Suggested is a temporary preview; applying creates the saved result.
          </p>
        </div>
        <div className="flex gap-1" aria-label="Preview version">
          {(["original", "suggested"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={`rounded px-3 py-2 text-xs ${view === option ? "bg-primary text-primary-foreground font-semibold" : "bg-elevated text-text-secondary"}`}
            >
              {option === "original" ? "Original" : "Suggested"}
            </button>
          ))}
        </div>
      </div>
      {candidate.excluded.length ? (
        <p role="status" className="text-xs text-amber-300">
          {candidate.excluded.length} conflicting or invalid suggestion(s) are
          excluded from the candidate. Review the list below.
        </p>
      ) : null}
      {!active || active.pages === null ? (
        <p role="status" className="text-xs text-text-secondary transition-opacity duration-150 motion-reduce:transition-none">
          Compiling and locating suggestions…
        </p>
      ) : active.error ? (
        <p role="alert" className="text-xs text-red-300 transition-opacity duration-150 motion-reduce:transition-none">
          Preview compilation failed: {active.error}
        </p>
      ) : (
        <div className="mx-auto max-h-[700px] max-w-[650px] space-y-4 overflow-auto transition-opacity duration-150 motion-reduce:transition-none">
          {active.pages.map((page, pageIndex) => (
            <div key={pageIndex} className="relative bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={page}
                alt={`Resume page ${pageIndex + 1}`}
                className="block h-auto w-full"
              />
              {patches.flatMap((patch, patchIndex) =>
                (active.locations[patch.id] || [])
                  .filter((location) => location.page === pageIndex)
                  .map((location, locationIndex) => (
                    <React.Fragment key={`${patch.id}-${locationIndex}`}>
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none absolute rounded-sm ${selected === patch.id ? "bg-amber-400/45" : decisions[patch.id] === "accepted" ? "paper-highlight-accepted" : decisions[patch.id] === "rejected" ? "bg-red-300/30" : "bg-amber-300/30"}`}
                        style={{
                          left: `${location.left}%`,
                          top: `${location.top}%`,
                          width: `${location.width}%`,
                          height: `${location.height}%`,
                        }}
                      />
                      {locationIndex === 0 && (
                        <button
                          type="button"
                          aria-label={`Review suggestion ${patchIndex + 1}, ${decisions[patch.id] || "pending"}`}
                          onClick={() => onSelect(patch.id)}
                          className={`absolute z-10 flex h-7 min-w-7 -translate-y-1/2 items-center justify-center rounded-full border px-1 text-xs font-bold shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${decisions[patch.id] === "accepted" ? "paper-marker-accepted" : decisions[patch.id] === "rejected" ? "border-red-800 bg-red-300 text-primary-foreground" : "border-amber-700 bg-amber-300 text-primary-foreground"}`}
                          style={{
                            left: `max(0px, calc(${location.left}% - 34px))`,
                            top: `${location.top}%`,
                          }}
                        >
                          {patchIndex + 1}
                        </button>
                      )}
                    </React.Fragment>
                  )),
              )}
            </div>
          ))}
        </div>
      )}
      {active && active.pages !== null && !active.error && (
        <p className="text-xs text-muted-foreground">
          {active.isProbing
            ? "Locating suggestions on preview…"
            : `${patches.filter((patch) => !active.locations[patch.id]).length} suggestion(s) have no verified location in this view; use the review list below.`}
        </p>
      )}
      {selectedPatch && (
        <div
          ref={detailRef}
          className="space-y-2 rounded-lg border border-amber-700/50 bg-inset p-3 text-sm text-foreground transition-opacity duration-150 motion-reduce:transition-none"
          aria-live="polite"
        >
          <p className="text-xs font-semibold text-amber-300">
            Suggestion {patches.indexOf(selectedPatch) + 1} ·{" "}
            {decisions[selectedPatch.id] || "pending"}
          </p>
          <p className="break-words leading-relaxed">
            <strong>Before:</strong> {selectedPatch.before || "(empty)"}
          </p>
          <p className="break-words leading-relaxed">
            <strong>After:</strong> {selectedPatch.after || "(empty)"}
          </p>
          <p className="break-words text-xs leading-relaxed text-text-secondary">
            <strong>Reason:</strong> {selectedPatch.rationale}
          </p>
          <p className="break-words text-xs text-text-secondary">
            <strong>Evidence:</strong>{" "}
            {selectedPatch.evidenceIds
              .map((eid) => evidenceTitles?.[eid] || eid)
              .join(", ")}
            {evidenceTitles && selectedPatch.evidenceIds.some((eid) => evidenceTitles[eid]) ? (
              <span className="mt-1 block break-all font-mono text-[11px] text-muted-foreground">
                IDs: {selectedPatch.evidenceIds.join(", ")}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onDecision(selectedPatch.id, "accepted")}
              aria-pressed={decisions[selectedPatch.id] === "accepted"}
              className="rounded px-3 py-2 text-xs font-semibold paper-action-accepted transition-colors motion-reduce:transition-none"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onDecision(selectedPatch.id, "rejected")}
              aria-pressed={decisions[selectedPatch.id] === "rejected"}
              className="rounded bg-red-900 px-3 py-2 text-xs font-semibold text-white transition-colors motion-reduce:transition-none"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
