"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import type { ScoreBreakdown } from "@/lib/scoring/blended-sort";
import { blendedFactors, displayScore } from "@/lib/scoring/blended-display";

interface Props {
  compositeScore?: number | null;
  breakdown?: Partial<ScoreBreakdown> | null;
  size?: number;
  showLabel?: boolean;
}

export function FitPercentageDial({ compositeScore, breakdown, size = 120, showLabel = true }: Props) {
  const score = displayScore(compositeScore);
  const strokeWidth = Math.max(3, Math.min(10, size * 0.1));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - ((score ?? 0) / 100) * circumference;
  const label = score === null ? "Blended score unavailable" : `Blended score: ${score}%`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} — show breakdown`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
              <circle className="text-muted stroke-current" strokeWidth={strokeWidth} fill="none" r={radius} cx={size / 2} cy={size / 2} />
              {score !== null && (
                <circle
                  className="text-primary stroke-current"
                  strokeWidth={strokeWidth}
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  strokeLinecap="round"
                  fill="none"
                  r={radius}
                  cx={size / 2}
                  cy={size / 2}
                />
              )}
            </svg>
            {showLabel && (
              <span className="absolute flex flex-col items-center text-center">
                <span className="text-xl font-bold text-foreground">{score === null ? "—" : `${score}%`}</span>
                <span className="text-xs text-muted-foreground">Score</span>
              </span>
            )}
          </span>
          {!showLabel && <span className="font-mono text-xs text-slate-200">{score === null ? "Unavailable" : `${score}%`}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-4">
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Blended score breakdown</h4>
          <div className="space-y-3 text-sm">
            {blendedFactors(breakdown).map(({ label: factor, weight, score: value }) => (
              <div key={factor} className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span>{factor} ({weight}%)</span>
                  <span>{value === null ? "Unavailable" : `${value}%`}</span>
                </div>
                {value !== null && (
                  <div role="progressbar" aria-label={factor} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} className="h-1.5 w-full rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
