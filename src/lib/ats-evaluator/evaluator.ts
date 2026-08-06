import { JobRequirements } from "@/lib/jd-parser/types";
import {
  AtsEvaluationResult,
  CategoryResult,
  RoleProfile,
  SkillEvaluation,
  SkillMatchStatus,
} from "./types";

const PROFILE_PRIORITIES: Record<RoleProfile, string[]> = {
  "Full-stack": [
    "frontend",
    "backend",
    "react",
    "node",
    "api",
    "database",
    "sql",
    "testing",
    "deploy",
    "git",
  ],
  Backend: [
    "api",
    "rest",
    "graphql",
    "postgres",
    "sql",
    "database",
    "redis",
    "cache",
    "microservices",
    "authentication",
    "testing",
    "docker",
  ],
  "AI/LLM": [
    "agent",
    "llm",
    "rag",
    "retrieval",
    "prompt",
    "vector",
    "openai",
    "embeddings",
    "python",
    "guardrails",
    "eval",
  ],
  ML: [
    "pytorch",
    "tensorflow",
    "model",
    "training",
    "dataset",
    "accuracy",
    "evaluation",
    "metrics",
    "scikit",
    "python",
  ],
  Frontend: [
    "react",
    "next.js",
    "typescript",
    "tailwind",
    "css",
    "ui",
    "accessibility",
    "performance",
    "responsive",
    "component",
  ],
  "Data/Platform": [
    "pipeline",
    "sql",
    "etl",
    "spark",
    "kafka",
    "airflow",
    "data warehouse",
    "bigquery",
    "automation",
    "observability",
  ],
};

export function evaluateAtsScore(
  typstContent: string,
  requirements: JobRequirements,
  roleProfile: RoleProfile
): AtsEvaluationResult {
  const contentLower = typstContent.toLowerCase();

  // Split typst content into body sections (experience/projects) vs skills section
  const { bodyText, skillsSectionText } = parseTypstSections(typstContent);

  const bodyLower = bodyText.toLowerCase();
  const skillsLower = skillsSectionText.toLowerCase();

  // 1. Base Resume Health (30 pts)
  const baseHealth = evaluateBaseHealth(typstContent, bodyText, skillsSectionText);

  // 2. Required Role Match (40 pts)
  const { category: requiredMatch, evaluations: requiredEvals } = evaluateSkillsMatch(
    requirements.requiredSkills || [],
    "required",
    bodyLower,
    skillsLower,
    40
  );

  // 3. Preferred Match (15 pts)
  const { category: preferredMatch, evaluations: preferredEvals } = evaluateSkillsMatch(
    requirements.preferredSkills || [],
    "preferred",
    bodyLower,
    skillsLower,
    15
  );

  // 4. Role-Relevant Evidence (15 pts)
  const roleEvidence = evaluateRoleEvidence(contentLower, roleProfile);

  // Collect all skill evaluations
  const skillEvaluations = [...requiredEvals, ...preferredEvals];

  // Collect truthful gaps
  const gaps: string[] = [];
  for (const evalItem of skillEvaluations) {
    if (evalItem.status === "UNSUPPORTED_GAP") {
      if (evalItem.category === "required") {
        gaps.push(
          `Missing required skill: "${evalItem.skill}" (no verified evidence or mention found)`
        );
      } else {
        gaps.push(
          `Missing preferred qualification: "${evalItem.skill}" (minor gap)`
        );
      }
    } else if (evalItem.status === "LISTED_IN_SKILLS_ONLY") {
      gaps.push(
        `Skill "${evalItem.skill}" is listed in skills section but weakly demonstrated in experience/project bullets`
      );
    }
  }

  // Add structural gaps if any
  for (const finding of baseHealth.findings) {
    if (finding.startsWith("Warning:") || finding.startsWith("Penalized:")) {
      gaps.push(finding);
    }
  }

  const overallScore = Math.min(
    100,
    Math.max(
      0,
      baseHealth.score +
        requiredMatch.score +
        preferredMatch.score +
        roleEvidence.score
    )
  );

  return {
    overallScore,
    baseHealth,
    requiredMatch,
    preferredMatch,
    roleEvidence,
    skillEvaluations,
    gaps,
    selectedProfile: roleProfile,
  };
}

function evaluateBaseHealth(
  fullContent: string,
  bodyText: string,
  skillsText: string
): CategoryResult {
  let score = 0;
  const maxScore = 30;
  const findings: string[] = [];

  // Sub-check A: ATS Readability & Page Fit (8 pts)
  let readabilityPts = 0;
  const charLength = fullContent.length;
  if (charLength > 100 && charLength <= 4000) {
    readabilityPts += 4;
    findings.push("✓ Standard one-page length constraints satisfied.");
  } else if (charLength > 4000) {
    readabilityPts += 2;
    findings.push("Warning: Document length may exceed a single page.");
  } else {
    findings.push("Warning: Document length is unusually short.");
  }

  if (
    /experience|work history|projects|education|skills/i.test(fullContent)
  ) {
    readabilityPts += 4;
    findings.push("✓ Standard ATS section headers detected.");
  } else {
    findings.push("Warning: Missing standard ATS section headings.");
  }
  score += readabilityPts;

  // Sub-check B: Evidence Quality Signals (8 pts)
  let qualityPts = 0;
  if (/http:\/\/|https:\/\/|github\.com|link\(/i.test(fullContent)) {
    qualityPts += 4;
    findings.push("✓ Working project/portfolio links present.");
  } else {
    findings.push("Warning: No live links or GitHub repository URLs found.");
  }

  // Quantitative metrics check (digits followed by %, $, x, ms, users, etc.)
  if (/\d+%\s*|\$\d+|\d+\s*ms|\d+\s*users|\d+x/i.test(fullContent)) {
    qualityPts += 4;
    findings.push("✓ Quantitative impact metrics present in accomplishments.");
  } else {
    findings.push("Warning: Few or no quantitative metrics found in experience bullets.");
  }
  score += qualityPts;

  // Sub-check C: Technical Clarity (8 pts)
  // Cross-check listed skills against experience bullet bodies
  let clarityPts = 0;
  const skillsList = skillsText
    .split(/[,;\n•|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  if (skillsList.length === 0) {
    clarityPts += 4;
    findings.push("✓ Skills are integrated into document text.");
  } else {
    const bodyLower = bodyText.toLowerCase();
    let demonstratedCount = 0;
    for (const skill of skillsList) {
      if (bodyLower.includes(skill.toLowerCase())) {
        demonstratedCount++;
      }
    }

    const ratio = demonstratedCount / skillsList.length;
    if (ratio >= 0.5) {
      clarityPts += 8;
      findings.push(
        `✓ ${Math.round(ratio * 100)}% of listed skills are demonstrated in accomplishment bullets.`
      );
    } else if (ratio >= 0.25) {
      clarityPts += 4;
      findings.push(
        `Warning: Only ${Math.round(ratio * 100)}% of listed skills are demonstrated in accomplishment bullets.`
      );
    } else {
      clarityPts += 2;
      findings.push(
        "Warning: Many listed skills appear only in the skills section without bullet context."
      );
    }
  }
  score += clarityPts;

  // Sub-check D: Consistency & Anti-Gaming Check (6 pts)
  let consistencyPts = 6;
  // Detect anti-gaming / hidden text patterns (e.g., text(fill: white) or white hex codes)
  if (
    /text\(\s*fill:\s*(white|rgb\(#ffffff\)|"#ffffff")/i.test(fullContent) ||
    /color:\s*white/i.test(fullContent)
  ) {
    consistencyPts = 0;
    findings.push(
      "Penalized: Hidden or white-colored text pattern detected (anti-gaming violation)."
    );
  } else {
    findings.push("✓ Zero hidden text or keyword-stuffing patterns detected.");
  }
  score += consistencyPts;

  score = Math.min(maxScore, Math.max(0, score));
  const percentage = Math.round((score / maxScore) * 100);

  return {
    score,
    maxScore,
    percentage,
    findings,
  };
}

function evaluateSkillsMatch(
  skills: string[],
  category: "required" | "preferred",
  bodyLower: string,
  skillsLower: string,
  maxPoints: number
): { category: CategoryResult; evaluations: SkillEvaluation[] } {
  if (skills.length === 0) {
    return {
      category: {
        score: maxPoints,
        maxScore: maxPoints,
        percentage: 100,
        findings: [`No ${category} skills specified in job description.`],
      },
      evaluations: [],
    };
  }

  const pointsPerSkill = maxPoints / skills.length;
  let totalScore = 0;
  const evaluations: SkillEvaluation[] = [];
  const findings: string[] = [];

  for (const skill of skills) {
    const sLower = skill.toLowerCase();
    let status: SkillMatchStatus = "UNSUPPORTED_GAP";
    let earnedPts = 0;
    let contextStr: string | undefined = undefined;

    if (bodyLower.includes(sLower)) {
      status = "DEMONSTRATED_IN_EXPERIENCE";
      earnedPts = pointsPerSkill; // Full credit
      contextStr = `Verified in experience/project bullets`;
    } else if (skillsLower.includes(sLower)) {
      status = "LISTED_IN_SKILLS_ONLY";
      earnedPts = pointsPerSkill * 0.5; // Partial credit
      contextStr = `Listed in skills section only (weakly demonstrated)`;
    } else {
      status = "UNSUPPORTED_GAP";
      earnedPts = 0;
    }

    totalScore += earnedPts;
    evaluations.push({
      skill,
      category,
      status,
      matchedContext: contextStr,
      score: Math.round(earnedPts * 10) / 10,
      maxScore: Math.round(pointsPerSkill * 10) / 10,
    });

    if (status === "DEMONSTRATED_IN_EXPERIENCE") {
      findings.push(`✓ ${skill}: verified in experience/project bullets`);
    } else if (status === "LISTED_IN_SKILLS_ONLY") {
      findings.push(`~ ${skill}: listed but weakly demonstrated in bullets`);
    } else {
      findings.push(`✗ ${skill}: unsupported gap`);
    }
  }

  const finalScore = Math.round(Math.min(maxPoints, totalScore));
  const percentage = Math.round((finalScore / maxPoints) * 100);

  return {
    category: {
      score: finalScore,
      maxScore: maxPoints,
      percentage,
      findings,
    },
    evaluations,
  };
}

function evaluateRoleEvidence(
  contentLower: string,
  roleProfile: RoleProfile
): CategoryResult {
  const priorities = PROFILE_PRIORITIES[roleProfile] || PROFILE_PRIORITIES["Full-stack"];
  const maxScore = 15;
  const findings: string[] = [];

  let matchedCount = 0;
  for (const term of priorities) {
    if (contentLower.includes(term)) {
      matchedCount++;
    }
  }

  const score = Math.min(
    maxScore,
    Math.round((matchedCount / priorities.length) * maxScore)
  );
  const percentage = Math.round((score / maxScore) * 100);

  findings.push(
    `Evaluated against "${roleProfile}" profile: ${matchedCount}/${priorities.length} priority domain signals matched.`
  );

  return {
    score,
    maxScore,
    percentage,
    findings,
  };
}

function parseTypstSections(typstContent: string): {
  bodyText: string;
  skillsSectionText: string;
} {
  // Simple heuristic parser for Typst markup
  const lines = typstContent.split("\n");
  let bodyLines: string[] = [];
  let skillsLines: string[] = [];

  let inSkillsSection = false;

  for (const line of lines) {
    const isHeader =
      line.includes("resume-section") ||
      line.includes("#heading") ||
      /^(=+)\s+/i.test(line);

    if (isHeader) {
      if (/skills|technologies|tools/i.test(line)) {
        inSkillsSection = true;
      } else {
        inSkillsSection = false;
      }
    }

    if (inSkillsSection) {
      skillsLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  return {
    bodyText: bodyLines.join("\n"),
    skillsSectionText: skillsLines.join("\n"),
  };
}
