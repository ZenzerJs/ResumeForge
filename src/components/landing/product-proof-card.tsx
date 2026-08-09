import React from "react";
import { FileCode, ShieldCheck, Database, CheckCircle2, Sparkles } from "lucide-react";

export function ProductProofCard() {
  return (
    <div className="w-full bg-slate-950/90 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 backdrop-blur-md relative overflow-hidden" data-testid="product-proof-card">
      {/* Illustrative Disclaimer Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-400">
            WORKSPACE PREVIEW
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-400 italic">
          Illustrative interface — your verified data stays local
        </span>
      </div>

      {/* Editor Mockup Window Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-amber-400" />
            <span className="text-white font-semibold">master-resume.typ</span>
            <span className="text-[10px] text-amber-400/90 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded">
              Protected Master
            </span>
          </div>
          <span className="text-slate-400 text-[10px]">WASM Compiled</span>
        </div>

        {/* Structural Typst Source Lines */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-1.5 text-[11px] text-slate-300">
          <div className="text-amber-300/90">
            #let section(title) = block(width: 100%)[ ... ]
          </div>
          <div className="text-slate-300">
            #section(&quot;Technical Experience&quot;)
          </div>
          <div className="text-slate-400 pl-4 border-l border-slate-800">
            #entry(title: &quot;Senior Software Engineer&quot;, company: &quot;Tech Corp&quot;)
          </div>
        </div>
      </div>

      {/* Proof Signal Badges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Constraint</span>
            <span className="font-medium text-slate-200 text-[11px]">Protected Master</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <Database className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">Grounding</span>
            <span className="font-medium text-slate-200 text-[11px]">Evidence ID: exp-01</span>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-purple-400 shrink-0" />
          <div>
            <span className="text-[10px] text-slate-400 font-mono uppercase block">ATS Rubric</span>
            <span className="font-medium text-slate-200 text-[11px]">100-Point Audit</span>
          </div>
        </div>
      </div>
    </div>
  );
}
