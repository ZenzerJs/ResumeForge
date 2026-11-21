import type { AtsEvaluationResult } from "./types";

export interface AtsDisplayState {
  hasJobRequirements: boolean;
  hasRequiredSkills: boolean;
  hasPreferredSkills: boolean;
  overallRingText: string;
  overallRingPct: number;
  overallMatchLabel: string;
  overallScorePrimary: string;
  overallScoreSubtext: string | null;
  requiredMatchLabel: string;
  requiredMatchPct: number;
  preferredMatchLabel: string;
  preferredMatchPct: number;
}

export function getAtsDisplayState(
  result: AtsEvaluationResult,
  extractedRequirements: {
    requiredSkills: string[];
    preferredSkills: string[];
    domainTerms?: string[];
  },
  roleTitle?: string
): AtsDisplayState {
  const hasRequiredSkills = (extractedRequirements.requiredSkills?.length ?? 0) > 0;
  const hasPreferredSkills = (extractedRequirements.preferredSkills?.length ?? 0) > 0;
  const hasJobRequirements = hasRequiredSkills || hasPreferredSkills;
  const overallPct = Math.max(0, Math.min(100, result.overallScore || 0));
  const gradeLabel = overallPct >= 80 ? "Strong" : overallPct >= 60 ? "Solid" : "Needs work";

  return {
    hasJobRequirements,
    hasRequiredSkills,
    hasPreferredSkills,
    overallRingText: hasJobRequirements ? String(result.overallScore) : "—",
    overallRingPct: hasJobRequirements ? overallPct : 0,
    overallMatchLabel: hasJobRequirements
      ? `Overall Match · ${gradeLabel}`
      : "Overall Match · No job loaded",
    overallScorePrimary: hasJobRequirements ? `${result.overallScore}` : "No job loaded",
    overallScoreSubtext: hasJobRequirements
      ? `vs. ${roleTitle || `${result.selectedProfile} profile`}`
      : `Unscored until job requirements load (Base Health: ${result.baseHealth.score}/${result.baseHealth.maxScore})`,
    requiredMatchLabel: hasRequiredSkills
      ? `${result.requiredMatch.score} / ${result.requiredMatch.maxScore} pts (${result.requiredMatch.percentage}% match)`
      : hasJobRequirements
      ? "Unscored (none listed)"
      : "No job loaded",
    requiredMatchPct: hasRequiredSkills ? result.requiredMatch.percentage : 0,
    preferredMatchLabel: hasPreferredSkills
      ? `${result.preferredMatch.score} / ${result.preferredMatch.maxScore} pts (${result.preferredMatch.percentage}% match)`
      : hasJobRequirements
      ? "Unscored (none listed)"
      : "No job loaded",
    preferredMatchPct: hasPreferredSkills ? result.preferredMatch.percentage : 0,
  };
}
