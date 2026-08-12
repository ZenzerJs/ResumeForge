import React from "react";
import { Sparkles, FileCode, ShieldCheck, Database, BarChart2, Briefcase } from "lucide-react";

const CAPABILITY_ITEMS = [
  { label: "Typst WASM Engine", icon: FileCode, color: "text-amber-400" },
  { label: "Verified Evidence Bank", icon: Database, color: "text-emerald-400" },
  { label: "BYOK AI Gateway", icon: Sparkles, color: "text-purple-400" },
  { label: "100-Point ATS Rubric", icon: BarChart2, color: "text-cyan-400" },
  { label: "Protected Master Resume", icon: ShieldCheck, color: "text-amber-400" },
  { label: "Kanban Job Pipeline", icon: Briefcase, color: "text-blue-400" },
];

export function CapabilityMarquee() {
  return (
    <section className="w-full border-y border-slate-800/80 bg-slate-950/60 py-4 overflow-hidden relative" data-testid="capability-marquee-container">
      {/* Horizontal Gradient Fades */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

      {/* Marquee Motion Container */}
      <div className="animate-marquee flex items-center gap-8">
        {[...CAPABILITY_ITEMS, ...CAPABILITY_ITEMS].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={`cap-${idx}`}
              tabIndex={0}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/80 text-xs font-mono text-slate-300 shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            >
              <Icon className={`h-3.5 w-3.5 ${item.color}`} />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
