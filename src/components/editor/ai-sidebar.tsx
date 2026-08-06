"use client";

import React from "react";
import { Bot, Sparkles, Lock } from "lucide-react";

export function AiSidebar() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700">
        <span className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-indigo-500" />
          AI assistant (coming in a later phase)
        </span>
        <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          <Lock className="h-3 w-3" /> Phase 5
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 rounded-full bg-indigo-50 p-3 text-indigo-600 border border-indigo-100">
          <Sparkles className="h-6 w-6" />
        </div>
        
        <h3 className="text-sm font-semibold text-slate-800">
          AI Tailoring Assistant
        </h3>
        
        <p className="mt-2 text-xs text-slate-500 max-w-[260px] leading-relaxed">
          Structured patch recommendations, evidence citation matching, and ATS evaluation tools will appear here in future phases.
        </p>

        <div className="mt-6 w-full rounded-md border border-dashed border-slate-200 p-4 bg-white/50 text-left text-[11px] text-slate-400 space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span>Job requirement ingestion</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span>Verified evidence citations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span>Structured patch diff proposals</span>
          </div>
        </div>
      </div>
    </div>
  );
}
