"use client";

import React from "react";
import { FileCode, ShieldCheck, Database, Sparkles } from "lucide-react";

export function ProductProofCard() {
  return (
    <div
      className="w-full rounded-[10px] border border-outline/70 bg-panel p-5 space-y-4 shadow-lg"
      data-testid="product-proof-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-outline/70 pb-3">
        <span className="text-xs font-mono font-semibold text-foreground">
          Sample Workspace Layout
        </span>
        <span className="text-xs font-mono text-muted-foreground">
          Typst WASM Preview
        </span>
      </div>

      <div className="rounded-[6px] border border-outline/70 bg-inset p-4 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-primary" aria-hidden />
            <span className="text-foreground font-semibold text-xs md:text-sm">master-resume.typ</span>
            <span className="text-xs text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-[4px] font-mono">
              Protected Master
            </span>
          </div>
          <span className="text-muted-foreground text-xs font-mono">WASM Compiled</span>
        </div>

        <pre className="rounded-[6px] border border-outline/70 bg-canvas p-3.5 text-xs text-foreground/90 overflow-x-auto leading-relaxed whitespace-pre-wrap">
{`#set section(title) = block(width: 100%)[ ... ]

#section("Technical Experience")
#entry(title: "Senior Software Engineer", company: "TechCorp")[
  - Architected high-throughput microservices using Go and gRPC.
]`}
        </pre>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        <div className="rounded-[6px] border border-outline/70 bg-inset p-3.5 flex items-center gap-2.5 text-xs">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <div>
            <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.04em] block">Constraint</span>
            <span className="font-semibold text-foreground text-xs md:text-sm">Protected Master</span>
          </div>
        </div>
        <div className="rounded-[6px] border border-outline/70 bg-inset p-3.5 flex items-center gap-2.5 text-xs">
          <Database className="h-4 w-4 text-status-success shrink-0" aria-hidden />
          <div>
            <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.04em] block">Grounding</span>
            <span className="font-semibold text-foreground text-xs md:text-sm">Evidence ID: exp-01</span>
          </div>
        </div>
        <div className="rounded-[6px] border border-outline/70 bg-inset p-3.5 flex items-center gap-2.5 text-xs">
          <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
          <div>
            <span className="text-[11px] text-muted-foreground font-mono uppercase tracking-[0.04em] block">ATS Rubric</span>
            <span className="font-semibold text-foreground text-xs md:text-sm tabular-nums">100-Point Audit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
