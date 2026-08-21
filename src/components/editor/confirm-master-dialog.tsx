"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Briefcase,
  Award,
  Hash,
  Wrench,
  Loader2,
  GitCompare,
  CheckCircle2,
  Info,
  AlertTriangle,
} from "lucide-react";
import { extractResumeFacts } from "@/lib/facts/extract";
import { computeLineDiff } from "@/lib/diff/simple-diff";
import { cn } from "@/lib/utils";

export interface ConfirmMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typstSource: string;
  priorSource?: string | null;
  title?: string;
  onConfirm: () => Promise<void> | void;
  isSaving?: boolean;
}

export function ConfirmMasterDialog({
  open,
  onOpenChange,
  typstSource,
  priorSource,
  title = "Master Resume",
  onConfirm,
  isSaving = false,
}: ConfirmMasterDialogProps) {
  const [confirmed, setConfirmed] = useState(true);
  const [activeTab, setActiveTab] = useState<"facts" | "diff">("facts");

  const facts = useMemo(() => {
    if (!typstSource) return null;
    return extractResumeFacts(typstSource);
  }, [typstSource]);

  const diff = useMemo(() => {
    if (!typstSource) return null;
    return computeLineDiff(priorSource || "", typstSource);
  }, [priorSource, typstSource]);

  const isInitialBaseline = !priorSource || priorSource.trim().length === 0;
  const hasNoChanges = priorSource === typstSource;

  const handleConfirm = async () => {
    if (!confirmed) return;
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="save-master-confirm-modal"
        className="max-w-2xl bg-slate-900 border-slate-800 text-slate-100 shadow-2xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-400">
            <ShieldCheck className="size-5 text-amber-400" />
            <DialogTitle className="text-lg font-bold text-white">
              Confirm &amp; Freeze Master Fact Snapshot
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-300">
            Saving as <strong className="text-amber-300">{title}</strong> will freeze an immutable fact baseline.
            Future AI tailoring and exports will be guarded against these verified claims.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector with Accessible Semantics */}
        <div
          role="tablist"
          aria-label="Master freeze inspection views"
          className="flex items-center gap-1.5 border-b border-slate-800 pb-2"
        >
          <button
            type="button"
            role="tab"
            id="tab-facts"
            aria-selected={activeTab === "facts"}
            aria-controls="panel-facts"
            onClick={() => setActiveTab("facts")}
            data-testid="confirm-dialog-tab-facts"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "facts"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <ShieldCheck className="size-3.5" />
            <span>Extracted Facts</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-diff"
            aria-selected={activeTab === "diff"}
            aria-controls="panel-diff"
            onClick={() => setActiveTab("diff")}
            data-testid="confirm-dialog-tab-diff"
            className={cn(
              "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5",
              activeTab === "diff"
                ? "bg-amber-500 text-slate-950 font-bold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            )}
          >
            <GitCompare className="size-3.5" />
            <span>Source Diff Review</span>
            {diff && (diff.stats.addedCount > 0 || diff.stats.deletedCount > 0) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700">
                <span className="text-emerald-400 font-bold">+{diff.stats.addedCount}</span>
                <span className="text-red-400 font-bold">-{diff.stats.deletedCount}</span>
              </span>
            )}
          </button>
        </div>

        {/* Tab 1: Extracted Facts View */}
        {activeTab === "facts" && facts && (
          <div
            id="panel-facts"
            role="tabpanel"
            aria-labelledby="tab-facts"
            className="space-y-3.5 max-h-[48vh] overflow-y-auto pr-1 text-xs"
          >
            {/* Employers */}
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                <Briefcase className="size-3.5 text-blue-400" />
                <span>Extracted Employers ({facts.employers.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {facts.employers.length > 0 ? (
                  facts.employers.map((emp, i) => (
                    <Badge key={i} variant="secondary" className="bg-slate-800 text-slate-200 border-slate-700">
                      {emp.raw}
                    </Badge>
                  ))
                ) : (
                  <span className="text-slate-500 italic">No employer records detected</span>
                )}
              </div>
            </div>

            {/* Titles */}
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                <Award className="size-3.5 text-amber-400" />
                <span>Extracted Job Titles ({facts.titles.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {facts.titles.length > 0 ? (
                  facts.titles.map((t, i) => (
                    <Badge key={i} variant="secondary" className="bg-slate-800 text-slate-200 border-slate-700">
                      {t.raw}
                    </Badge>
                  ))
                ) : (
                  <span className="text-slate-500 italic">No job title records detected</span>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                <Hash className="size-3.5 text-emerald-400" />
                <span>Extracted Metrics ({facts.metrics.filter((m) => !m.isTrivial).length} non-trivial)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {facts.metrics.filter((m) => !m.isTrivial).length > 0 ? (
                  facts.metrics
                    .filter((m) => !m.isTrivial)
                    .map((m, i) => (
                      <Badge key={i} variant="outline" className="border-emerald-700/60 bg-emerald-950/40 text-emerald-300">
                        {m.raw}
                      </Badge>
                    ))
                ) : (
                  <span className="text-slate-500 italic">No non-trivial metrics detected</span>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                <Wrench className="size-3.5 text-purple-400" />
                <span>Extracted Skills ({facts.skills.length})</span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                {facts.skills.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] text-slate-300 border border-slate-700">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Source Diff Review */}
        {activeTab === "diff" && (
          <div id="panel-diff" role="tabpanel" aria-labelledby="tab-diff" className="max-h-[48vh] overflow-y-auto pr-1 space-y-2">
            {diff?.isTruncated && (
              <div className="p-2.5 rounded bg-amber-950/50 border border-amber-800 text-xs text-amber-300 flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-400" />
                <span>Document exceeds 2,000 lines. Diff truncated for display performance.</span>
              </div>
            )}

            {isInitialBaseline ? (
              <div
                data-testid="master-diff-container"
                className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2"
              >
                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                  <Info className="size-4" />
                  <span>Initial Master Baseline Creation</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  No prior baseline exists. Freezing this document will create the initial master fact snapshot.
                </p>
                <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {typstSource}
                </div>
              </div>
            ) : hasNoChanges ? (
              <div
                data-testid="master-diff-container"
                className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-2"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span>No Text Changes Detected</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  The current live editor buffer is identical to the active master baseline.
                </p>
              </div>
            ) : (
              <div
                data-testid="master-diff-container"
                className="font-mono text-[11px] leading-relaxed max-h-[45vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/90 p-2 space-y-0.5"
              >
                {diff?.lines.map((line, idx) => {
                  if (line.type === "add") {
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 px-2 py-0.5 bg-emerald-950/50 text-emerald-300 border-l-2 border-emerald-500 rounded-sm"
                      >
                        <span className="w-8 text-right select-none text-emerald-600 text-[10px]">
                          {line.lineNew}
                        </span>
                        <span className="select-none text-emerald-400 font-bold px-1 rounded bg-emerald-900/40 text-[10px]">+</span>
                        <span className="flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
                      </div>
                    );
                  }
                  if (line.type === "delete") {
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 px-2 py-0.5 bg-red-950/50 text-red-300 border-l-2 border-red-500 rounded-sm line-through opacity-85"
                      >
                        <span className="w-8 text-right select-none text-red-600 text-[10px]">
                          {line.lineOld}
                        </span>
                        <span className="select-none text-red-400 font-bold px-1 rounded bg-red-900/40 text-[10px]">-</span>
                        <span className="flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 px-2 py-0.5 text-slate-400 hover:bg-slate-900/50 rounded-sm"
                    >
                      <span className="w-8 text-right select-none text-slate-600 text-[10px]">
                        {line.lineNew}
                      </span>
                      <span className="select-none text-slate-700 w-3 text-center"> </span>
                      <span className="flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Confirmation Checkbox */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-900/60 bg-amber-950/20 mt-1">
          <Checkbox
            id="confirm-master-checkbox"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(Boolean(checked))}
            data-testid="confirm-master-checkbox"
            className="mt-0.5 border-amber-600 data-[state=checked]:bg-amber-500 data-[state=checked]:text-slate-950"
          />
          <label
            htmlFor="confirm-master-checkbox"
            data-testid="extract-evidence-checkbox"
            className="text-[11px] text-amber-200 leading-snug cursor-pointer select-none"
          >
            I confirm these extracted facts and document changes accurately represent my verified career experience.
            I understand future AI tailoring and exports will be fail-closed against this baseline.
          </label>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-400 hover:text-slate-200 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleConfirm()}
            disabled={!confirmed || isSaving}
            data-testid="confirm-save-master-btn"
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs gap-1.5 shadow-lg shadow-amber-500/20"
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
            Confirm &amp; Freeze Master
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
