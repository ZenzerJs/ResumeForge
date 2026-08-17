/**
 * Blended Match Scoring Engine
 * Combines ATS qualification match, posting recency, location affinity, and salary transparency.
 */

export interface ScoreBreakdown {
  atsScore: number;
  recencyScore: number;
  locationScore: number;
  salaryScore: number;
  finalScore: number;
}

export interface BlendedScoringInput {
  atsScore?: number;
  postedAt?: string | Date | null;
  createdAt?: string | Date;
  isRemote?: boolean;
  isCityMatch?: boolean;
  salaryMin?: number | null;
  salaryMax?: number | null;
  targetMinSalary?: number;
}

/**
 * Calculates posting recency score (0-100).
 */
export function calculateRecencyScore(postedAt?: string | Date | null, createdAt?: string | Date): number {
  const dateVal = postedAt || createdAt;
  if (!dateVal) return 30;

  const time = typeof dateVal === "string" ? new Date(dateVal).getTime() : dateVal.getTime();
  const diffHours = (Date.now() - time) / (1000 * 60 * 60);

  if (diffHours <= 24) return 100;
  if (diffHours <= 72) return 85;
  if (diffHours <= 168) return 65; // 7 days
  if (diffHours <= 336) return 45; // 14 days
  if (diffHours <= 720) return 25; // 30 days
  return 10;
}

/**
 * Calculates location affinity score (0-100).
 */
export function calculateLocationScore(isCityMatch?: boolean, isRemote?: boolean): number {
  if (isCityMatch) return 100;
  if (isRemote) return 90;
  return 40;
}

/**
 * Calculates salary transparency and threshold score (0-100).
 */
export function calculateSalaryScore(
  salaryMin?: number | null,
  salaryMax?: number | null,
  targetMinSalary?: number
): number {
  if (!salaryMin && !salaryMax) return 40;

  if (targetMinSalary && targetMinSalary > 0) {
    const maxVal = salaryMax || salaryMin || 0;
    if (maxVal >= targetMinSalary) return 100;
    if (maxVal >= targetMinSalary * 0.8) return 70;
    return 30;
  }

  return 85; // Salary is transparently listed
}

/**
 * Calculates overall blended score with weighted multi-factor composition.
 */
export function calculateBlendedScore(input: BlendedScoringInput): ScoreBreakdown {
  const atsScore = Math.max(0, Math.min(100, input.atsScore ?? 60));
  const recencyScore = calculateRecencyScore(input.postedAt, input.createdAt);
  const locationScore = calculateLocationScore(input.isCityMatch, input.isRemote);
  const salaryScore = calculateSalaryScore(input.salaryMin, input.salaryMax, input.targetMinSalary);

  const finalScore = Math.round(
    atsScore * 0.55 +
    recencyScore * 0.20 +
    locationScore * 0.15 +
    salaryScore * 0.10
  );

  return {
    atsScore,
    recencyScore,
    locationScore,
    salaryScore,
    finalScore,
  };
}
