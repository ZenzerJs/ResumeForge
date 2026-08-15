"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, RotateCcw, AlertOctagon } from "lucide-react";
import { GuardrailResult, GuardrailStatus } from "@/lib/guardrail/types";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface GuardrailFeedbackProps {
  result: GuardrailResult | null;
  className?: string;
}

export function GuardrailFeedback({ result, className }: GuardrailFeedbackProps) {
  if (!result) return null;

  const { status, passed, violations, hasHardViolations, hasSoftViolations } = result;

  const renderBadge = (status: GuardrailStatus) => {
    switch (status) {
      case "clean":
        return (
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-950/30 gap-1">
            <CheckCircle2 className="size-3 text-emerald-400" />
            Clean — Guardrail Passed
          </Badge>
        );
      case "retried":
        return (
          <Badge variant="outline" className="border-amber-500/40 text-amber-400 bg-amber-950/30 gap-1">
            <RotateCcw className="size-3 text-amber-400" />
            Retried &amp; Cleared
          </Badge>
        );
      case "fell_back":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="size-3" />
            Fell Back to Verified Master
          </Badge>
        );
      case "blocked":
        return (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="size-3" />
            Export Blocked
          </Badge>
        );
    }
  };

  return (
    <div className={className} data-testid="guardrail-feedback-container">
      {passed && !hasSoftViolations ? (
        <Alert className="border-emerald-800/50 bg-emerald-950/20 text-emerald-300">
          <ShieldCheck className="size-4 text-emerald-400" />
          <div className="flex items-center justify-between w-full">
            <div>
              <AlertTitle className="text-emerald-200 font-semibold">Mechanical Guardrail Verified</AlertTitle>
              <AlertDescription className="text-xs text-emerald-400/90 mt-0.5">
                All claims, metrics, and employers conform strictly to frozen master facts.
              </AlertDescription>
            </div>
            {renderBadge(status)}
          </div>
        </Alert>
      ) : hasHardViolations ? (
        <Alert variant="destructive" className="border-red-800 bg-red-950/40">
          <AlertOctagon className="size-4" />
          <div>
            <div className="flex items-center justify-between">
              <AlertTitle className="font-semibold text-red-200">Mechanical Guardrail Violation</AlertTitle>
              {renderBadge(status)}
            </div>
            <AlertDescription className="text-xs text-red-300/90 mt-1">
              Unverified claims detected. Hard violations disable document export until corrected.
            </AlertDescription>

            <div className="mt-3 rounded-md border border-red-900/60 bg-black/40 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-red-900/60 hover:bg-transparent">
                    <TableHead className="text-[11px] text-red-400 h-8">Kind</TableHead>
                    <TableHead className="text-[11px] text-red-400 h-8">Severity</TableHead>
                    <TableHead className="text-[11px] text-red-400 h-8">Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v, i) => (
                    <TableRow key={i} className="border-red-900/40 text-xs hover:bg-red-950/20">
                      <TableCell className="font-mono text-[11px] text-red-300 py-1.5 uppercase">{v.kind}</TableCell>
                      <TableCell className="py-1.5">
                        <Badge variant={v.severity === "HARD" ? "destructive" : "secondary"} className="text-[10px] py-0 px-1.5">
                          {v.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-200 py-1.5">{v.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Alert>
      ) : (
        <Alert className="border-amber-800/50 bg-amber-950/20 text-amber-300">
          <AlertTriangle className="size-4 text-amber-400" />
          <div>
            <div className="flex items-center justify-between">
              <AlertTitle className="text-amber-200 font-semibold">Guardrail Advisory</AlertTitle>
              {renderBadge(status)}
            </div>
            <AlertDescription className="text-xs text-amber-300/90 mt-1">
              Soft advisories found (unverified skills). Export remains permitted.
            </AlertDescription>
          </div>
        </Alert>
      )}
    </div>
  );
}
