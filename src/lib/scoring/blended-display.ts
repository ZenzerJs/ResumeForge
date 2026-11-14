import type { ScoreBreakdown } from "./blended-sort";

export function displayScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(Math.min(100, Math.max(0, value)))
    : null;
}

export function blendedFactors(breakdown?: Partial<ScoreBreakdown> | null) {
  return [
    { label: "Qualifications", weight: 55, score: displayScore(breakdown?.atsScore) },
    { label: "Recency", weight: 20, score: displayScore(breakdown?.recencyScore) },
    { label: "Location", weight: 15, score: displayScore(breakdown?.locationScore) },
    { label: "Salary", weight: 10, score: displayScore(breakdown?.salaryScore) },
  ];
}
