"use client";

import React, { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TechDiffItem {
  skill: string;
  verified: boolean;
  matchType?: "exact" | "alias" | "missing";
  aliasChain?: string[];
  evidenceTitle?: string;
}

interface TechDiffPillListProps {
  items?: TechDiffItem[];
  allRequiredSkills?: string[];
  verifiedSkillNames?: string[];
  missingSkillNames?: string[];
  maxDisplay?: number;
  className?: string;
}

export function TechDiffPillList({
  items: directItems,
  allRequiredSkills = [],
  verifiedSkillNames = [],
  missingSkillNames = [],
  maxDisplay = 8,
  className,
}: TechDiffPillListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Build uniform items list
  let items: TechDiffItem[] = [];

  if (directItems && directItems.length > 0) {
    items = directItems;
  } else {
    const verifiedSet = new Set(verifiedSkillNames.map((s) => s.toLowerCase().trim()));
    const missingSet = new Set(missingSkillNames.map((s) => s.toLowerCase().trim()));

    // Case-insensitive deduplication preserving original casing
    const seen = new Set<string>();
    const uniqueSkills: string[] = [];
    for (const raw of [...allRequiredSkills, ...verifiedSkillNames, ...missingSkillNames]) {
      const norm = raw.toLowerCase().trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        uniqueSkills.push(raw.trim());
      }
    }

    items = uniqueSkills.map((skill) => {
      const lower = skill.toLowerCase().trim();
      const isVerified = verifiedSet.has(lower);

      return {
        skill,
        verified: isVerified,
        matchType: isVerified ? "exact" : "missing",
      };
    });
  }

  // Sort: verified first, then missing
  const sortedItems = [...items].sort((a, b) => {
    if (a.verified === b.verified) return a.skill.localeCompare(b.skill);
    return a.verified ? -1 : 1;
  });

  const displayedItems = isExpanded
    ? sortedItems
    : sortedItems.slice(0, maxDisplay);
  const hiddenCount = sortedItems.length - maxDisplay;

  if (sortedItems.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} data-testid="tech-diff-pill-list">
      {displayedItems.map((item, index) => {
        if (item.verified) {
          return (
            <span
              key={`${item.skill}-${index}`}
              className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-500/25"
              title={
                item.evidenceTitle
                  ? `Verified via Evidence Bank: ${item.evidenceTitle}`
                  : item.aliasChain
                  ? `Inferred via ${item.aliasChain.join(" → ")}`
                  : "Verified in Evidence Bank"
              }
              data-testid={`tech-pill-verified-${item.skill}`}
            >
              <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" />
              <span>{item.skill}</span>
            </span>
          );
        }

        return (
          <span
            key={`${item.skill}-${index}`}
            className="inline-flex items-center gap-1 rounded border border-dashed border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-500/20"
            title="Requirement missing from candidate Evidence Bank"
            data-testid={`tech-pill-missing-${item.skill}`}
          >
            <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
            <span>{item.skill}</span>
          </span>
        );
      })}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-0.5 rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          data-testid="tech-diff-expand-btn"
        >
          {isExpanded ? (
            <>
              <span>Less</span>
              <ChevronUp className="h-2.5 w-2.5" />
            </>
          ) : (
            <>
              <span>+{hiddenCount} more</span>
              <ChevronDown className="h-2.5 w-2.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
