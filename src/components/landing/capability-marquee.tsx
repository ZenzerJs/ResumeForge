import React from "react";
import {
  Sparkles,
  FileCode,
  ShieldCheck,
  Database,
  BarChart2,
  Briefcase,
  Terminal,
  Building2,
  Layers,
  FileCheck,
} from "lucide-react";

const CAPABILITY_ITEMS = [
  { label: "Typst WASM Engine", icon: FileCode, color: "text-amber-400" },
  { label: "Verified Evidence Bank", icon: Database, color: "text-emerald-400" },
  { label: "BYOK AI Gateway", icon: Sparkles, color: "text-purple-400" },
  { label: "100-Point ATS Rubric", icon: BarChart2, color: "text-cyan-400" },
  { label: "Protected Master Resume", icon: ShieldCheck, color: "text-amber-400" },
  { label: "Kanban Job Pipeline", icon: Briefcase, color: "text-blue-400" },
  { label: "Company OA Question Bank", icon: Terminal, color: "text-emerald-400" },
  { label: "Culture & Intel Dossier", icon: Building2, color: "text-amber-400" },
  { label: "Multi-Format ZIP Bundle", icon: Layers, color: "text-sky-400" },
  { label: "STAR Story Synthesizer", icon: FileCheck, color: "text-pink-400" },
];

// Duplicate items in each set so track width is significantly wider than any 4K screen
const TRACK_ITEMS = [...CAPABILITY_ITEMS, ...CAPABILITY_ITEMS];

export function CapabilityMarquee() {
  return (
    <section
      className="relative w-full min-w-0 max-w-full overflow-hidden border-y border-slate-800/80 bg-slate-950/60 py-4 select-none"
      data-testid="capability-marquee-container"
    >
      {/* Horizontal Gradient Fades */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />

      {/* Marquee Motion Container */}
      <div
        className="marquee-track animate-marquee flex items-center"
        data-testid="capability-marquee-track"
        style={{ "--marquee-s": "36s" } as React.CSSProperties}
      >
        {/* Set A */}
        <div className="flex items-center gap-6 pr-6 shrink-0" aria-hidden={false}>
          {TRACK_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={`cap-a-${idx}`}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/80 text-xs font-mono text-slate-300 shrink-0 shadow-sm"
              >
                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>

        {/* Set B (Duplicate for seamless -50% loop) */}
        <div className="flex items-center gap-6 pr-6 shrink-0" aria-hidden={true}>
          {TRACK_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={`cap-b-${idx}`}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800/80 text-xs font-mono text-slate-300 shrink-0 shadow-sm"
              >
                <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                <span>{item.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
