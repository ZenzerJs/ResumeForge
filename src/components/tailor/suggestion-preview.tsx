"use client";

import React from "react";
import type { PatchProposal } from "@/lib/ai/patch-schema";
import { buildPreviewCandidate } from "./preview-candidate";
import {
  literalPreviewText,
  locatePreviewText,
  provesPreviewMapping,
  type PreviewLocation,
} from "@/lib/typst/preview-mapping";

type Decision = "pending" | "accepted" | "rejected";
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
  const [result, setResult] = React.useState<{
    key: string;
    pages: string[];
    locations: Record<string, PreviewLocation[]>;
    excluded: string[];
    error?: string;
  } | null>(null);
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
  const displayed = view === "original" ? base : candidate?.source;
  const key = JSON.stringify({
    displayed,
    view,
    included: candidate?.included,
    excluded: candidate?.excluded,
    anchors: patches.map(({ id, before, after }) => ({ id, before, after })),
  });
  const detailRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  React.useEffect(() => {
    const snapshot = JSON.parse(key) as {
      displayed?: string | null;
      view: "original" | "suggested";
      included?: string[];
      excluded?: string[];
      anchors: Array<{ id: string; before: string; after: string }>;
    };
    if (!snapshot.displayed || !snapshot.included || !snapshot.excluded) return;
    const source = snapshot.displayed;
    const included = snapshot.included;
    const excluded = snapshot.excluded;
    let cancelled = false;
    void (async () => {
      try {
        const { renderTypstReview } = await import("@/lib/typst/compiler");
        const rendered = await renderTypstReview(source, true, {
          callerId: "suggestion-preview",
          mode: "live",
        });
        if (cancelled) return;
        const locations: Record<string, PreviewLocation[]> = {};
        for (const patch of snapshot.anchors) {
          if (cancelled) return;
          if (
            snapshot.anchors.filter((item) => item.id === patch.id).length !== 1
          )
            continue;
          const anchor =
            snapshot.view === "original" || !included.includes(patch.id)
              ? patch.before
              : patch.after;
          const text = literalPreviewText(anchor);
          if (!text) continue;
          const anchorIndex = source.indexOf(anchor);
          if (anchorIndex < 0 || source.indexOf(anchor, anchorIndex + 1) >= 0)
            continue;
          // Preserve a simple list marker in the source while probing its literal content.
          const rawText = anchor.replace(/^\s*[-+]\s+/, "").trim();
          const offset = anchor.indexOf(rawText);
          if (offset < 0) continue;
          const index = anchorIndex + offset;
          const location = locatePreviewText(rendered.items, text);
          if (!location) continue;
          let sentinel = "ResumeForgePreviewAnchor";
          while (source.includes(sentinel)) sentinel += "X";
          const probeSource =
            source.slice(0, index) +
            sentinel +
            source.slice(index + rawText.length);
          try {
            const probe = await renderTypstReview(probeSource, false, {
              callerId: "suggestion-preview",
              mode: "live",
            });
            if (
              provesPreviewMapping(rendered.items, probe.items, text, sentinel)
            )
              locations[patch.id] = location;
          } catch {
            /* A failed probe means the location is unavailable. */
          }
          if (cancelled) return;
        }
        if (!cancelled)
          setResult({ key, pages: rendered.pages, locations, excluded });
      } catch (error) {
        if (!cancelled)
          setResult({
            key,
            pages: [],
            locations: {},
            excluded,
            error:
              error instanceof Error
                ? error.message
                : "Preview compilation failed.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

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
  const active = result?.key === key ? result : null;
  const selectedPatch = patches.find((patch) => patch.id === selected);
  return (
    <section
      className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3"
      aria-label="Resume suggestion preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-white">Review on resume</h3>
          <p className="text-xs text-slate-400">
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
              className={`rounded px-3 py-2 text-xs ${view === option ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-200"}`}
            >
              {option === "original" ? "Original" : "Suggested"}
            </button>
          ))}
        </div>
      </div>
      {active?.excluded.length ? (
        <p role="status" className="text-xs text-amber-300">
          {active.excluded.length} conflicting or invalid suggestion(s) are
          excluded from the candidate. Review the list below.
        </p>
      ) : null}
      {!active ? (
        <p role="status" className="text-xs text-slate-300">
          Compiling and locating suggestions…
        </p>
      ) : active.error ? (
        <p role="alert" className="text-xs text-red-300">
          Preview compilation failed: {active.error}
        </p>
      ) : (
        <div className="mx-auto max-h-[700px] max-w-[650px] space-y-4 overflow-auto">
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
                        className={`pointer-events-none absolute rounded-sm ${selected === patch.id ? "bg-amber-400/45" : decisions[patch.id] === "accepted" ? "bg-emerald-300/40" : decisions[patch.id] === "rejected" ? "bg-red-300/30" : "bg-amber-300/30"}`}
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
                          className={`absolute z-10 flex h-7 min-w-7 -translate-y-1/2 items-center justify-center rounded-full border px-1 text-xs font-bold text-slate-950 shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 ${decisions[patch.id] === "accepted" ? "border-emerald-800 bg-emerald-300" : decisions[patch.id] === "rejected" ? "border-red-800 bg-red-300" : "border-amber-700 bg-amber-300"}`}
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
      {active && !active.error && (
        <p className="text-xs text-slate-400">
          {patches.filter((patch) => !active.locations[patch.id]).length}{" "}
          suggestion(s) have no verified location in this view; use the review
          list below.
        </p>
      )}
      {selectedPatch && (
        <div
          ref={detailRef}
          className="space-y-2 rounded-lg border border-amber-700/50 bg-slate-950 p-3 text-xs text-slate-200"
          aria-live="polite"
        >
          <p className="font-semibold text-amber-300">
            Suggestion {patches.indexOf(selectedPatch) + 1} ·{" "}
            {decisions[selectedPatch.id] || "pending"}
          </p>
          <p>
            <strong>Before:</strong> {selectedPatch.before || "(empty)"}
          </p>
          <p>
            <strong>After:</strong> {selectedPatch.after || "(empty)"}
          </p>
          <p>
            <strong>Reason:</strong> {selectedPatch.rationale}
          </p>
          <p className="break-all">
            <strong>Evidence:</strong> {selectedPatch.evidenceIds.join(", ")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onDecision(selectedPatch.id, "accepted")}
              aria-pressed={decisions[selectedPatch.id] === "accepted"}
              className="rounded bg-emerald-800 px-3 py-2 text-white"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => onDecision(selectedPatch.id, "rejected")}
              aria-pressed={decisions[selectedPatch.id] === "rejected"}
              className="rounded bg-red-900 px-3 py-2 text-white"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
