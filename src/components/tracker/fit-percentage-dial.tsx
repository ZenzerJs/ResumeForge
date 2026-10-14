"use client";

import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface Breakdown {
  coreStackScore: number;
  seniorityScore: number;
  toolsScore: number;
  evidenceCoverageScore: number;
}

interface Props {
  compositeScore: number;
  breakdown?: Breakdown;
  size?: number;
}

export function FitPercentageDial({ compositeScore, breakdown, size = 120 }: Props) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (compositeScore / 100) * circumference;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="relative inline-flex items-center justify-center cursor-pointer" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="transform -rotate-90">
            <circle
              className="text-muted stroke-current"
              strokeWidth={strokeWidth}
              fill="transparent"
              r={radius}
              cx={size / 2}
              cy={size / 2}
            />
            <circle
              className="text-primary stroke-current transition-all duration-500 ease-in-out"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx={size / 2}
              cy={size / 2}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold text-foreground">{compositeScore}%</span>
            <span className="text-xs text-muted-foreground">Fit</span>
          </div>
        </div>
      </PopoverTrigger>
      {breakdown && (
        <PopoverContent className="w-64 p-4">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Score Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Core Stack</span>
                <span>{breakdown.coreStackScore}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${breakdown.coreStackScore}%` }}></div></div>

              <div className="flex justify-between">
                <span>Seniority</span>
                <span>{breakdown.seniorityScore}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${breakdown.seniorityScore}%` }}></div></div>

              <div className="flex justify-between">
                <span>Tools</span>
                <span>{breakdown.toolsScore}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${breakdown.toolsScore}%` }}></div></div>

              <div className="flex justify-between">
                <span>Evidence Coverage</span>
                <span>{breakdown.evidenceCoverageScore}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${breakdown.evidenceCoverageScore}%` }}></div></div>
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
