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
import { ShieldCheck, AlertTriangle, Briefcase, Award, Calendar, Hash, Wrench, Loader2 } from "lucide-react";
import { extractResumeFacts } from "@/lib/facts/extract";

interface ConfirmMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typstSource: string;
  title?: string;
  onConfirm: () => Promise<void> | void;
  isSaving?: boolean;
}

export function ConfirmMasterDialog({
  open,
  onOpenChange,
  typstSource,
  title = "Master Resume",
  onConfirm,
  isSaving = false,
}: ConfirmMasterDialogProps) {
  const [confirmed, setConfirmed] = useState(true);

  const facts = useMemo(() => {
    if (!typstSource) return null;
    return extractResumeFacts(typstSource);
  }, [typstSource]);

  const handleConfirm = async () => {
    if (!confirmed) return;
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        data-testid="save-master-confirm-modal"
        className="max-w-xl bg-slate-900 border-slate-800 text-slate-100 shadow-2xl"
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

        {facts && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1 text-xs">
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

            {/* Confirmation Checkbox */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-900/60 bg-amber-950/20">
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
                I confirm these extracted facts accurately represent my verified career experience.
                I understand future AI tailoring and exports will be fail-closed against this baseline.
              </label>
            </div>
          </div>
        )}

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
