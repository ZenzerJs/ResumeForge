import { describe, it, expect } from "vitest";
import {
  calculateBlendedScore,
  calculateRecencyScore,
  calculateLocationScore,
  calculateSalaryScore,
} from "@/lib/scoring/blended-sort";

describe("WS2.3 — Blended Match Scoring Engine", () => {
  it("rewards fresh postings with higher recency scores", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 1000 * 60 * 60);
    const twoDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 48);
    const tenDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 240);
    const fortyDaysAgo = new Date(now.getTime() - 1000 * 60 * 60 * 960);

    expect(calculateRecencyScore(oneHourAgo)).toBe(100);
    expect(calculateRecencyScore(twoDaysAgo)).toBe(85);
    expect(calculateRecencyScore(tenDaysAgo)).toBe(45);
    expect(calculateRecencyScore(fortyDaysAgo)).toBe(10);
  });

  it("calculates location score with city and remote affinity", () => {
    expect(calculateLocationScore(true, false)).toBe(100);
    expect(calculateLocationScore(false, true)).toBe(90);
    expect(calculateLocationScore(false, false)).toBe(40);
  });

  it("evaluates salary score against targets", () => {
    // Meets minimum salary threshold of $100k
    expect(calculateSalaryScore(100000, 120000, 100000)).toBe(100);
    // Partial meet (within 80%)
    expect(calculateSalaryScore(85000, 90000, 100000)).toBe(70);
    // Well below target
    expect(calculateSalaryScore(50000, 60000, 100000)).toBe(30);
    // Transparent salary without specific target
    expect(calculateSalaryScore(90000, 110000)).toBe(85);
    // No salary provided
    expect(calculateSalaryScore(null, null)).toBe(40);
  });

  it("computes bounded composite blended score", () => {
    const perfectRole = calculateBlendedScore({
      atsScore: 95,
      postedAt: new Date(),
      isCityMatch: true,
      isRemote: true,
      salaryMin: 120000,
      salaryMax: 150000,
      targetMinSalary: 100000,
    });

    expect(perfectRole.finalScore).toBeGreaterThanOrEqual(90);
    expect(perfectRole.finalScore).toBeLessThanOrEqual(100);

    const staleRole = calculateBlendedScore({
      atsScore: 50,
      postedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      isCityMatch: false,
      isRemote: false,
      salaryMin: null,
      salaryMax: null,
    });

    expect(staleRole.finalScore).toBeLessThan(50);
  });
});
