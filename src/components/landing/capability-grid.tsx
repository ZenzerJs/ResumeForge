import React from "react";
import Link from "next/link";
import { FileText, Database, Sparkles, Briefcase, Settings, ArrowRight, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  hasMasterResume: boolean;
  masterResumeTitle: string | null;
  evidenceCount: number;
  verifiedEvidenceCount: number;
  jobsCount: number;
  appliedJobsCount: number;
  variantsCount: number;
  coverLettersCount: number;
}

interface CapabilityGridProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function CapabilityGrid({ stats, loading }: CapabilityGridProps) {
  const cards = [
    {
      title: "Master Resume Editor",
      description:
        "Edit your protected Typst master resume with WASM compilation and instant live preview.",
      href: "/editor",
      icon: FileText,
      tileStyle: "bg-slate-900 border-amber-500/30 text-amber-400 hover:border-amber-500/60",
      badge: stats?.hasMasterResume ? "Master Active" : "Requires Setup",
      badgeStyle: stats?.hasMasterResume
        ? "bg-amber-950/50 border-amber-800 text-amber-400"
        : "bg-slate-800 text-slate-400",
      stat: stats ? (stats.hasMasterResume ? "1 Master Resume" : "No Master Resume") : "—",
      accentColor: "text-amber-400",
    },
    {
      title: "Verified Evidence Bank",
      description:
        "Central repository of career achievements, verified bullets, and skill inventory.",
      href: "/library",
      icon: Database,
      tileStyle: "bg-slate-100 text-slate-950 border-slate-300 hover:bg-white hover:border-slate-400",
      badge: stats ? `${stats.verifiedEvidenceCount} Verified` : "Evidence Bank",
      badgeStyle: "bg-slate-200 text-slate-900 border-slate-300 font-bold",
      stat: stats ? `${stats.evidenceCount} Total Items` : "—",
      accentColor: "text-slate-950",
      isSilverInverted: true,
    },
    {
      title: "Tailor Engine & AI Gateway",
      description:
        "Parse job descriptions, generate evidence-grounded patches, and inspect 100-point ATS scores.",
      href: "/tailor",
      icon: Sparkles,
      tileStyle: "bg-slate-900 border-[#847dff]/40 text-[#847dff] hover:border-[#847dff]/70",
      badge: "BYOK AI",
      badgeStyle: "bg-[#847dff]/10 border-[#847dff]/30 text-[#847dff]",
      stat: stats ? `${stats.variantsCount} Variants Generated` : "—",
      accentColor: "text-[#847dff]",
    },
    {
      title: "Job Application Tracker",
      description:
        "Kanban & list pipeline for tracking applications, interview notes, and status history.",
      href: "/tracker",
      icon: Briefcase,
      tileStyle: "bg-slate-900 border-[#90b8f0]/40 text-[#90b8f0] hover:border-[#90b8f0]/70",
      badge: stats ? `${stats.appliedJobsCount} Applied` : "Pipeline",
      badgeStyle: "bg-[#90b8f0]/10 border-[#90b8f0]/30 text-[#90b8f0]",
      stat: stats ? `${stats.jobsCount} Jobs Tracked` : "—",
      accentColor: "text-[#90b8f0]",
    },
    {
      title: "AI Key Vault & Settings",
      description:
        "Configure BYOK credentials (OpenAI, Anthropic, Gemini) with local client-side key scrubbing.",
      href: "/settings",
      icon: Settings,
      tileStyle: "bg-slate-900 border-[#00b3dd]/40 text-[#00b3dd] hover:border-[#00b3dd]/70",
      badge: "Local-First",
      badgeStyle: "bg-[#00b3dd]/10 border-[#00b3dd]/30 text-[#00b3dd]",
      stat: "Zero-Leak Redaction",
      accentColor: "text-[#00b3dd]",
    },
  ];

  return (
    <section className="flex flex-col gap-6 w-full max-w-5xl mx-auto py-6" data-testid="capability-grid-section">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          Workspace Capability Modules
        </h2>
        <span className="text-[10px] font-mono text-slate-500">
          5 modules · local-only confidential storage
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="capability-cards-grid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.href} href={card.href} className="group block h-full">
              <div
                className={`h-full p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all duration-200 shadow-md ${card.tileStyle}`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border ${
                        card.isSilverInverted ? "bg-slate-200 border-slate-300" : "bg-slate-950 border-slate-800"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${card.accentColor}`} />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full border ${card.badgeStyle}`}
                    >
                      {card.badge}
                    </span>
                  </div>

                  <div>
                    <h3 className={`font-bold text-sm ${card.isSilverInverted ? "text-slate-950" : "text-white"}`}>
                      {card.title}
                    </h3>
                    <p
                      className={`text-xs mt-1.5 leading-relaxed ${
                        card.isSilverInverted ? "text-slate-700" : "text-slate-400"
                      }`}
                    >
                      {card.description}
                    </p>
                  </div>
                </div>

                <div
                  className={`flex items-center justify-between pt-3 border-t text-xs ${
                    card.isSilverInverted ? "border-slate-300" : "border-slate-800"
                  }`}
                >
                  <span className="font-mono opacity-80">
                    {loading ? <Skeleton className="h-3 w-20" /> : card.stat}
                  </span>
                  <span className={`flex items-center gap-1 font-semibold group-hover:translate-x-1 transition-transform`}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
