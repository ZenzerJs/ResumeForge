import {
  MatchScoreResult,
  MatchScoreResultSchema,
  SkillEvidenceLink,
} from "@packages/schema/matchScore";

export interface CandidateEvidenceInput {
  skills?: string[];
  totalYoe?: number;
  evidenceItems?: {
    id: string;
    title: string;
    tags?: string[] | string;
    bullets?: {
      id?: string;
      text?: string;
      technologies?: string[] | string;
    }[];
  }[];
}

export interface JobRequirementInput {
  requiredSkills: string[];
  preferredSkills?: string[];
  tools?: string[];
  requiredYoe?: number;
}

/**
 * Known tech & framework alias/implication mapping.
 * E.g. Next.js implies React and JavaScript/TypeScript.
 * PostgreSQL implies SQL and relational database.
 */
export const FRAMEWORK_ALIAS_MAP: Record<string, string[]> = {
  "next.js": ["react", "javascript", "typescript"],
  nextjs: ["react", "javascript", "typescript"],
  react: ["javascript"],
  vue: ["javascript"],
  vuejs: ["javascript"],
  angular: ["typescript", "javascript"],
  fastapi: ["python", "restful apis"],
  django: ["python"],
  flask: ["python"],
  express: ["node.js", "javascript"],
  "express.js": ["node.js", "javascript"],
  nestjs: ["node.js", "typescript"],
  "spring boot": ["java", "spring"],
  spring: ["java"],
  kubernetes: ["docker", "containerization"],
  k8s: ["docker", "containerization", "kubernetes"],
  postgresql: ["sql", "relational database", "postgres"],
  postgres: ["sql", "relational database", "postgresql"],
  mysql: ["sql", "relational database"],
  sqlite: ["sql", "relational database"],
  pytorch: ["python", "machine learning"],
  tensorflow: ["python", "machine learning"],
  vitest: ["jest", "testing", "unit test"],
  playwright: ["cypress", "testing", "e2e"],
};

function normalizeSkill(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Extracts all verified skills with their evidence provenance from the candidate Evidence Bank.
 */
function extractEvidenceBankSkills(candidate: CandidateEvidenceInput): Map<
  string,
  { evidenceId: string; bulletId?: string; evidenceTitle: string }
> {
  const verifiedMap = new Map<
    string,
    { evidenceId: string; bulletId?: string; evidenceTitle: string }
  >();

  if (!candidate.evidenceItems) return verifiedMap;

  for (const item of candidate.evidenceItems) {
    // Parse tags
    let tags: string[] = [];
    if (Array.isArray(item.tags)) {
      tags = item.tags;
    } else if (typeof item.tags === "string") {
      try {
        tags = JSON.parse(item.tags);
      } catch {
        tags = item.tags.split(",").map((t) => t.trim());
      }
    }

    for (const tag of tags) {
      if (tag) {
        verifiedMap.set(normalizeSkill(tag), {
          evidenceId: item.id,
          evidenceTitle: item.title,
        });
      }
    }

    // Parse bullet technologies
    if (item.bullets) {
      for (const b of item.bullets) {
        let techs: string[] = [];
        if (Array.isArray(b.technologies)) {
          techs = b.technologies;
        } else if (typeof b.technologies === "string") {
          try {
            techs = JSON.parse(b.technologies);
          } catch {
            techs = b.technologies.split(",").map((t) => t.trim());
          }
        }

        for (const tech of techs) {
          if (tech) {
            verifiedMap.set(normalizeSkill(tech), {
              evidenceId: item.id,
              bulletId: b.id,
              evidenceTitle: item.title,
            });
          }
        }
      }
    }
  }

  return verifiedMap;
}

/**
 * Checks whether a candidate possesses a given target skill, either directly,
 * via framework alias implication, or as an unverified candidate claim.
 */
export function resolveSkillMatch(
  targetSkill: string,
  verifiedEvidenceMap: Map<string, { evidenceId: string; bulletId?: string; evidenceTitle: string }>,
  candidateRawSkills: Set<string>
): SkillEvidenceLink {
  const normTarget = normalizeSkill(targetSkill);

  // 1. Exact match in verified Evidence Bank
  if (verifiedEvidenceMap.has(normTarget)) {
    const record = verifiedEvidenceMap.get(normTarget)!;
    return {
      skill: targetSkill,
      matchType: "exact",
      matchedEvidenceId: record.evidenceId,
      matchedBulletId: record.bulletId,
      evidenceTitle: record.evidenceTitle,
      verified: true,
      notes: `Verified in Evidence Bank (${record.evidenceTitle})`,
    };
  }

  // 2. Transitive alias match in verified Evidence Bank (e.g. candidate has Next.js which implies React)
  for (const [candidateSkill, record] of verifiedEvidenceMap.entries()) {
    const implied = FRAMEWORK_ALIAS_MAP[candidateSkill];
    if (implied && implied.includes(normTarget)) {
      return {
        skill: targetSkill,
        matchType: "alias",
        matchedEvidenceId: record.evidenceId,
        matchedBulletId: record.bulletId,
        aliasChain: [candidateSkill, targetSkill],
        evidenceTitle: record.evidenceTitle,
        verified: true,
        notes: `Inferred via ${candidateSkill} in Evidence Bank (${record.evidenceTitle})`,
      };
    }
  }

  // 3. Listed in raw skills but lacks Evidence Bank citation (ungrounded claim - penalized)
  if (candidateRawSkills.has(normTarget)) {
    return {
      skill: targetSkill,
      matchType: "exact",
      verified: false,
      notes: "Listed in resume skills but not backed by Evidence Bank project",
    };
  }

  // 4. Also check alias in raw skills
  for (const rawSkill of candidateRawSkills) {
    const implied = FRAMEWORK_ALIAS_MAP[rawSkill];
    if (implied && implied.includes(normTarget)) {
      return {
        skill: targetSkill,
        matchType: "alias",
        aliasChain: [rawSkill, targetSkill],
        verified: false,
        notes: `Inferred via ${rawSkill} but unbacked by Evidence Bank citation`,
      };
    }
  }

  // 5. Missing requirement
  return {
    skill: targetSkill,
    matchType: "missing",
    verified: false,
    notes: "Missing from both Evidence Bank and resume skills",
  };
}

/**
 * Deterministically calculates a 100-point explainable match score
 * strictly using the mathematical formula:
 * Composite = 0.50(CoreStack) + 0.20(Seniority) + 0.15(Tools) + 0.15(EvidenceCoverage)
 */
export function calculateMatchScore(
  job: JobRequirementInput,
  candidate: CandidateEvidenceInput
): MatchScoreResult {
  const verifiedMap = extractEvidenceBankSkills(candidate);
  const rawSkillsSet = new Set((candidate.skills || []).map(normalizeSkill));

  const explanationDerivation: string[] = [];
  const matchedSkills: SkillEvidenceLink[] = [];
  const missingRequiredSkills: string[] = [];

  // ----------------------------------------------------
  // 1. Core Stack Score (50% Weight)
  // ----------------------------------------------------
  const rawRequiredList = job.requiredSkills || [];
  const seenRequired = new Set<string>();
  const requiredList: string[] = [];
  for (const r of rawRequiredList) {
    const norm = normalizeSkill(r);
    if (norm && !seenRequired.has(norm)) {
      seenRequired.add(norm);
      requiredList.push(r.trim());
    }
  }
  let coreStackPoints = 0;

  if (requiredList.length === 0) {
    coreStackPoints = 100;
  } else {
    let earnedCore = 0;
    for (const req of requiredList) {
      const match = resolveSkillMatch(req, verifiedMap, rawSkillsSet);
      matchedSkills.push(match);

      if (match.matchType === "exact" && match.verified) {
        earnedCore += 1.0;
      } else if (match.matchType === "alias" && match.verified) {
        earnedCore += 0.85; // slight discount for framework alias
      } else if (match.matchType !== "missing" && !match.verified) {
        // Penalty: ungrounded skill lacks evidence backing
        earnedCore += 0.40;
      } else {
        missingRequiredSkills.push(req);
      }
    }
    coreStackPoints = Math.round((earnedCore / requiredList.length) * 100);
  }

  // ----------------------------------------------------
  // 2. Seniority Score (20% Weight)
  // ----------------------------------------------------
  const reqYoe = job.requiredYoe ?? 0;
  const candYoe = candidate.totalYoe ?? 0;
  let seniorityScore = 100;

  if (reqYoe > 0) {
    if (candYoe >= reqYoe) {
      seniorityScore = 100;
    } else {
      seniorityScore = Math.min(100, Math.max(0, Math.round((candYoe / reqYoe) * 100)));
    }
  }

  // ----------------------------------------------------
  // 3. Tools Score (15% Weight)
  // ----------------------------------------------------
  const rawToolList = [...(job.tools || []), ...(job.preferredSkills || [])];
  const seenTools = new Set<string>();
  const toolList: string[] = [];
  for (const t of rawToolList) {
    const norm = normalizeSkill(t);
    if (norm && !seenTools.has(norm)) {
      seenTools.add(norm);
      toolList.push(t.trim());
    }
  }
  let toolsScore = 100;

  if (toolList.length > 0) {
    let earnedTools = 0;
    for (const tool of toolList) {
      const match = resolveSkillMatch(tool, verifiedMap, rawSkillsSet);
      if (!matchedSkills.some((m) => m.skill.toLowerCase() === tool.toLowerCase())) {
        matchedSkills.push(match);
      }

      if (match.matchType === "exact" && match.verified) {
        earnedTools += 1.0;
      } else if (match.matchType === "alias" && match.verified) {
        earnedTools += 0.85;
      } else if (match.matchType !== "missing" && !match.verified) {
        earnedTools += 0.50;
      }
    }
    toolsScore = Math.round((earnedTools / toolList.length) * 100);
  }

  // ----------------------------------------------------
  // 4. Evidence Coverage Score (15% Weight)
  // ----------------------------------------------------
  const seenRelevant = new Set<string>();
  const totalRelevantSkills: string[] = [];
  for (const s of [...requiredList, ...toolList]) {
    const norm = normalizeSkill(s);
    if (norm && !seenRelevant.has(norm)) {
      seenRelevant.add(norm);
      totalRelevantSkills.push(s.trim());
    }
  }
  let evidenceCoverageScore = 100;

  if (totalRelevantSkills.length > 0) {
    const verifiedCount = totalRelevantSkills.filter((s) => {
      const norm = normalizeSkill(s);
      if (verifiedMap.has(norm)) return true;
      for (const [candSkill] of verifiedMap.entries()) {
        if (FRAMEWORK_ALIAS_MAP[candSkill]?.includes(norm)) return true;
      }
      return false;
    }).length;

    evidenceCoverageScore = Math.round(
      (verifiedCount / totalRelevantSkills.length) * 100
    );
  }

  // ----------------------------------------------------
  // 5. Composite Score Calculation
  // Formula: Composite = 0.50(CoreStack) + 0.20(Seniority) + 0.15(Tools) + 0.15(EvidenceCoverage)
  // ----------------------------------------------------
  const compositeScore = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        0.50 * coreStackPoints +
          0.20 * seniorityScore +
          0.15 * toolsScore +
          0.15 * evidenceCoverageScore
      )
    )
  );

  // ----------------------------------------------------
  // Explanation Derivation Generation
  // ----------------------------------------------------
  const coreContribution = (0.50 * coreStackPoints).toFixed(1);
  const seniorityContribution = (0.20 * seniorityScore).toFixed(1);
  const toolsContribution = (0.15 * toolsScore).toFixed(1);
  const coverageContribution = (0.15 * evidenceCoverageScore).toFixed(1);

  explanationDerivation.push(
    `+${coreContribution} pts (Core Stack: 50% weight) — ${coreStackPoints}/100 based on ${requiredList.length} required skills`
  );

  if (reqYoe > 0) {
    if (candYoe >= reqYoe) {
      explanationDerivation.push(
        `+${seniorityContribution} pts (Seniority: 20% weight) — Candidate ${candYoe} YOE meets ${reqYoe} YOE required`
      );
    } else {
      const yoeDelta = reqYoe - candYoe;
      explanationDerivation.push(
        `+${seniorityContribution} pts (Seniority: 20% weight) — Candidate ${candYoe} YOE vs ${reqYoe} YOE required (-${yoeDelta} YOE gap)`
      );
    }
  } else {
    explanationDerivation.push(
      `+${seniorityContribution} pts (Seniority: 20% weight) — No minimum YOE specified`
    );
  }

  if (toolList.length > 0) {
    explanationDerivation.push(
      `+${toolsContribution} pts (Tools & Preferred: 15% weight) — ${toolsScore}/100 across ${toolList.length} tools`
    );
  } else {
    explanationDerivation.push(
      `+${toolsContribution} pts (Tools: 15% weight) — Standard tooling baseline`
    );
  }

  explanationDerivation.push(
    `+${coverageContribution} pts (Evidence Coverage: 15% weight) — ${evidenceCoverageScore}% backed by verified Evidence Bank projects`
  );

  if (missingRequiredSkills.length > 0) {
    explanationDerivation.push(
      `Deductions applied: Missing core requirements: ${missingRequiredSkills.join(", ")}`
    );
  }

  const ungroundedSkills = matchedSkills.filter(
    (s) => s.matchType !== "missing" && !s.verified
  );
  if (ungroundedSkills.length > 0) {
    explanationDerivation.push(
      `Penalty applied: ${ungroundedSkills.length} unverified skills lack Evidence Bank ID citations: ${ungroundedSkills.map((u) => u.skill).join(", ")}`
    );
  }

  explanationDerivation.push(
    `Formula: 0.50(${coreStackPoints}) + 0.20(${seniorityScore}) + 0.15(${toolsScore}) + 0.15(${evidenceCoverageScore}) = ${compositeScore}%`
  );

  const breakdown = {
    coreStackScore: coreStackPoints,
    seniorityScore,
    toolsScore,
    evidenceCoverageScore,
  };

  return MatchScoreResultSchema.parse({
    compositeScore,
    breakdown,
    matchedSkills,
    missingRequiredSkills,
    explanationDerivation,
  });
}
