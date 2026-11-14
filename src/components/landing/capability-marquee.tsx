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
  { label: "Typst WASM Engine", icon: FileCode },
  { label: "Verified Evidence Bank", icon: Database },
  { label: "BYOK AI Gateway", icon: Sparkles },
  { label: "100-Point ATS Rubric", icon: BarChart2 },
  { label: "Protected Master Resume", icon: ShieldCheck },
  { label: "Kanban Job Pipeline", icon: Briefcase },
  { label: "Company OA Question Bank", icon: Terminal },
  { label: "Culture & Intel Dossier", icon: Building2 },
  { label: "Multi-Format ZIP Bundle", icon: Layers },
  { label: "STAR Story Synthesizer", icon: FileCheck },
];

export function CapabilityMarquee() {
  return (
    <section
      className="relative w-full min-w-0 max-w-full border-y border-outline/70 bg-panel/60 py-5 px-4 md:px-12"
      data-testid="capability-marquee-container"
    >
      <div
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-2.5"
        data-testid="capability-marquee-track"
      >
        {CAPABILITY_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex items-center gap-2 rounded-[6px] border border-outline/70 bg-inset px-3 py-1.5 text-xs font-mono text-on-surface-variant"
            >
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
              <span>{item.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
