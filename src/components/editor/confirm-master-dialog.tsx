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
  draftEvidence: boolean;
  onDraftEvidenceChange: (next: boolean) => void;
}

export function ConfirmMasterDialog({
  open,
  onOpenChange,
  typstSource,
  priorSource,
  title = "Master Resume",
  onConfirm,
  isSaving = false,
  draftEvidence,
  onDraftEvidenceChange,
}: ConfirmMasterDialogProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<"facts" | "diff">("facts");
  const confirmingRef = React.useRef(false);
  const [localSaving, setLocalSaving] = useState(false);

  React.useEffect(() => {
    if (!open) {
      confirmingRef.current = false;
      setLocalSaving(false);
    }
  }, [open]);

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

  const busy = isSaving || localSaving;

  const handleConfirm = async () => {
    if (!confirmed || busy || confirmingRef.current) return;
    confirmingRef.current = true;
    setLocalSaving(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      confirmingRef.current = false;
      setLocalSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="save-master-confirm-modal"
        className="max-w-2xl bg-panel border-hairline text-foreground shadow-2xl"
      >
        <DialogHeader>
          <div className="flex items-center gap-2 text-status-warning">
            <ShieldCheck className="size-5 text-status-warning" />
            <DialogTitle className="text-lg font-bold text-foreground">
              Confirm &amp; Freeze Master Fact Snapshot
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-text-secondary">
            Saving as <strong className="text-status-warning">{title}</strong> will freeze an immutable fact baseline.
            Future AI tailoring and exports will be guarded against these verified claims.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selector with Accessible Semantics */}
        <div
          role="tablist"
          aria-label="Master freeze inspection views"
          className="flex items-center gap-1.5 border-b border-hairline pb-2"
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
                ? "bg-primary text-primary-foreground font-bold"
                : "text-text-secondary hover:text-foreground hover:bg-elevated"
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
                ? "bg-primary text-primary-foreground font-bold"
                : "text-text-secondary hover:text-foreground hover:bg-elevated"
            )}
          >
            <GitCompare className="size-3.5" />
            <span>Source Diff Review</span>
            {diff && (diff.stats.addedCount > 0 || diff.stats.deletedCount > 0) && (
              <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded bg-inset border border-hairline">
                <span className="text-status-success-soft font-bold">+{diff.stats.addedCount}</span>
                <span className="text-status-danger font-bold">-{diff.stats.deletedCount}</span>
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
            <div className="p-3 bg-inset rounded-lg border border-hairline space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <Briefcase className="size-3.5 text-status-info" />
                <span>Extracted Employers ({facts.employers.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {facts.employers.length > 0 ? (
                  facts.employers.map((emp, i) => (
                    <Badge key={i} variant="secondary" className="bg-elevated text-foreground border-hairline">
                      {emp.raw}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic">No employer records detected</span>
                )}
              </div>
            </div>

            {/* Titles */}
            <div className="p-3 bg-inset rounded-lg border border-hairline space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <Award className="size-3.5 text-status-warning" />
                <span>Extracted Job Titles ({facts.titles.length})</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {facts.titles.length > 0 ? (
                  facts.titles.map((t, i) => (
                    <Badge key={i} variant="secondary" className="bg-elevated text-foreground border-hairline">
                      {t.raw}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground italic">No job title records detected</span>
                )}
              </div>
            </div>

            {/* Metrics */}
            <div className="p-3 bg-inset rounded-lg border border-hairline space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <Hash className="size-3.5 text-status-success" />
                <span>Extracted Metrics ({facts.metrics.filter((m) => !m.isTrivial).length} non-trivial)</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {facts.metrics.filter((m) => !m.isTrivial).length > 0 ? (
                  facts.metrics
                    .filter((m) => !m.isTrivial)
                    .map((m, i) => (
                      <Badge key={i} variant="outline" className="border-status-success/35 bg-status-success/15 text-status-success-soft">
                        {m.raw}
                      </Badge>
                    ))
                ) : (
                  <span className="text-muted-foreground italic">No non-trivial metrics detected</span>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="p-3 bg-inset rounded-lg border border-hairline space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs">
                <Wrench className="size-3.5 text-status-info" />
                <span>Extracted Skills ({facts.skills.length})</span>
              </div>
              <div className="flex flex-wrap gap-1 pt-1 max-h-24 overflow-y-auto">
                {facts.skills.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-elevated text-xs text-text-secondary border border-hairline">
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
              <div className="p-2.5 rounded bg-status-warning/15 border border-status-warning/40 text-xs text-status-warning flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-status-warning" />
                <span>Document exceeds 2,000 lines. Diff truncated for display performance.</span>
              </div>
            )}

            {isInitialBaseline ? (
              <div
                data-testid="master-diff-container"
                className="p-4 rounded-lg bg-inset border border-hairline text-xs text-text-secondary space-y-2"
              >
                <div className="flex items-center gap-2 text-status-warning font-semibold">
                  <Info className="size-4" />
                  <span>Initial Master Baseline Creation</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  No prior baseline exists. Freezing this document will create the initial master fact snapshot.
                </p>
                <div className="mt-3 p-2.5 rounded bg-panel border border-hairline font-mono text-xs text-text-secondary max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {typstSource}
                </div>
              </div>
            ) : hasNoChanges ? (
              <div
                data-testid="master-diff-container"
                className="p-4 rounded-lg bg-inset border border-hairline text-xs text-text-secondary space-y-2"
              >
                <div className="flex items-center gap-2 text-status-success-soft font-semibold">
                  <CheckCircle2 className="size-4 text-status-success" />
                  <span>No Text Changes Detected</span>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  The current live editor buffer is identical to the active master baseline.
                </p>
              </div>
            ) : (
              <div
                data-testid="master-diff-container"
                className="font-mono text-xs leading-relaxed max-h-[45vh] overflow-y-auto rounded-lg border border-hairline bg-inset p-2 space-y-0.5"
              >
                {diff?.lines.map((line, idx) => {
                  if (line.type === "add") {
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 px-2 py-0.5 bg-status-success/15 text-status-success-soft border-l-2 border-status-success rounded-sm"
                      >
                        <span className="w-8 text-right select-none text-status-success/75 text-xs">
                          {line.lineNew}
                        </span>
                        <span className="select-none text-status-success font-bold px-1 rounded bg-status-success/20 text-xs">+</span>
                        <span className="flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
                      </div>
                    );
                  }
                  if (line.type === "delete") {
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2 px-2 py-0.5 bg-status-danger/10 text-status-danger border-l-2 border-status-danger rounded-sm line-through opacity-85"
                      >
                        <span className="w-8 text-right select-none text-status-danger/75 text-xs">
                          {line.lineOld}
                        </span>
                        <span className="select-none text-status-danger font-bold px-1 rounded bg-status-danger/20 text-xs">-</span>
                        <span className="flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="flex items-start gap-2 px-2 py-0.5 text-text-secondary hover:bg-panel/50 rounded-sm"
                    >
                      <span className="w-8 text-right select-none text-muted-foreground text-xs">
                        {line.lineNew}
                      </span>
                      <span className="select-none text-muted-foreground w-3 text-center"> </span>
                      <span className="flex-1 whitespace-pre-wrap break-words">{line.text || " "}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Confirmation Checkbox */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-status-warning/40 bg-status-warning/15 mt-1">
          <Checkbox
            id="confirm-master-checkbox"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(Boolean(checked))}
            data-testid="confirm-master-checkbox"
            className="mt-0.5 border-status-warning data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
          />
          <label
            htmlFor="confirm-master-checkbox"
            className="text-xs text-status-warning leading-snug cursor-pointer select-none"
          >
            I confirm these extracted facts and document changes accurately represent my verified career experience.
            I understand future AI tailoring and exports of tailored documents are checked against this baseline.
          </label>
        </div>

        {/* Optional Evidence Bank Drafting Consent */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-hairline bg-inset">
          <Checkbox
            id="extract-evidence-checkbox"
            checked={draftEvidence}
            onCheckedChange={(checked) => onDraftEvidenceChange(Boolean(checked))}
            data-testid="extract-evidence-checkbox"
            className="mt-0.5"
          />
          <label
            htmlFor="extract-evidence-checkbox"
            className="text-xs text-text-secondary leading-snug cursor-pointer select-none"
          >
            Also draft Evidence Bank items from this Master (one AI call on my provider key)
          </label>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => handleConfirm()}
            disabled={!confirmed || busy}
            data-testid="confirm-save-master-btn"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-1.5 shadow-lg shadow-primary/20"
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
            Confirm &amp; Freeze Master
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
