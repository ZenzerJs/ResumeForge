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
  roleProfile: RoleProfile,
  options?: { measuredPages?: number }
): AtsEvaluationResult {
  const contentLower = typstContent.toLowerCase();

  // Split typst content into body sections (experience/projects) vs skills section
  const { bodyText, skillsSectionText } = parseTypstSections(typstContent);

  const bodyLower = bodyText.toLowerCase();
  const skillsLower = skillsSectionText.toLowerCase();

  // 1. Base Resume Health (30 pts)
  const baseHealth = evaluateBaseHealth(
    typstContent,
    bodyText,
    skillsSectionText,
    options?.measuredPages
  );

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

function stripTypstCommentsAndPreamble(source: string): string {
  const withoutComments = source
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(?<!:)\s+\/\/.*$/gm, "");

  let result = "";
  let i = 0;
  while (i < withoutComments.length) {
    const atLineStart = i === 0 || /\s/.test(withoutComments[i - 1]);
    const match = atLineStart
      ? withoutComments.slice(i).match(/^#(let|set|show|import)\b/)
      : null;
    if (!match) {
      result += withoutComments[i];
      i++;
      continue;
    }

    let j = i + match[0].length;
    let parenDepth = 0;
    let bracketDepth = 0;
    let braceDepth = 0;
    let inString = false;

    while (j < withoutComments.length) {
      const ch = withoutComments[j];
      if (ch === "\\" && j + 1 < withoutComments.length) {
        j += 2;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        j++;
        continue;
      }
      if (!inString) {
        if (ch === "(") parenDepth++;
        else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === "[") bracketDepth++;
        else if (ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
        else if (ch === "{") braceDepth++;
        else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);
        else if (ch === "\n" && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
          const sliceTrimmed = withoutComments.slice(i, j).trimEnd();
          const prevNonWs = sliceTrimmed.slice(-1);
          if (
            prevNonWs !== "=" &&
            prevNonWs !== ":" &&
            prevNonWs !== "," &&
            !sliceTrimmed.endsWith("=>")
          ) {
            j++;
            break;
          }
        }
      }
      j++;
    }
    i = j;
  }

  return result.trim();
}

const ENGINEERING_SPECIFICITY_PATTERNS: RegExp[] = [
  // APIs, protocols, and backend interfaces
  /\b(?:restful(?:\s+apis?)?|rest\s+(?:apis?|endpoints?|services?|clients?|backends?)|graphql|grpc|trpc|openapi|swagger|websockets?|server-sent\s+events|webhooks?|api\s+(?:endpoints?|routes?|gateway|client|server|layer|contracts?|integrations?)|(?:backend|public|internal|external)\s+apis?|endpoints?|middleware|rate[\s-]limit(?:er|ing)|pagination|idempoten(?:t|cy)|sdk|rpc)\b/i,
  // Case-sensitive technical acronyms (avoids matching common English words like "rest" or "rag")
  /\b(?:REST|API|APIs|SSE|RAG|ISR|ORM|SQL|ETL|ELT|CI\/CD|JWT|SSO|MFA|RBAC|WCAG|ARIA|SSR|CLI)\b/,
  // Concrete systems and components built
  /\b(?:microservices?|monorepo|pub\/sub|event\s+bus|message\s+(?:queue|broker)|state\s+machine|compilers?|parsers?|lexers?|interpreters?|schedulers?|search\s+(?:engine|index)|query\s+engine|sync\s+engine|cli\s+tools?|reverse\s+proxy|load\s+balanc(?:er|ing)|design\s+system|component\s+library|browser\s+extension|real[\s-]time|offline[\s-]first|multi[\s-]threaded|distributed\s+lock|full[\s-]text\s+search|type[\s-]safe|(?:csv|json|pdf|markdown|typst|xml)\s+(?:export(?:s|ing)?|import(?:s|ing)?|pars(?:er|ing)|render(?:er|ing)|generat(?:or|ion)|processing)|open[\s-]sourced|published\s+(?:to|on)\s+(?:npm|pypi|crates\.io|chrome\s+web\s+store|app\s+store|play\s+store))\b/i,
  // Databases, schemas, and persistence
  /\b(?:postgres(?:ql)?|mysql|sqlite|mongodb|dynamodb|redis|memcached|prisma|drizzle|sqlalchemy|typeorm|mongoose|supabase|firestore|bigquery|snowflake|elasticsearch|pgvector|indexeddb|localstorage|sql\s+(?:quer(?:y|ies)|schemas?)|database\s+(?:schemas?|index(?:es|ing)?|migrations?|model(?:ing|s)?|quer(?:y|ies))|schemas?|migrations?|composite\s+index(?:es)?|b-tree|foreign\s+keys?|connection\s+pool(?:ing)?|acid\s+transactions?|row[\s-]level\s+security|vector\s+(?:search|store|db|database))\b/i,
  // Authentication, authorization, and security
  /\b(?:oauth(?:2)?|oidc|jwt|saml|sso|mfa|2fa|rbac|role[\s-]based\s+access(?:\s+control)?|acl|pkce|csrf|xss|cors|csp|tls|bcrypt|argon2|encryption|authentication|authorization|auth\s+(?:flow|middleware|session|tokens?)|session\s+(?:management|handling|cookies?|tokens?)|cookie[\s-]based\s+auth|input\s+validation|sanitiz(?:ation|ing)|zod|nextauth|better[\s-]auth|clerk\s+auth|auth0)\b/i,
  // Caching, pipelines, queues, and AI/ML engineering
  /\b(?:cach(?:ing|e\s+(?:invalidation|layer|strategy|headers?))|lru\s+cache|ttl|etag|memoiz(?:ation|ed)|(?:data|ingestion|streaming|build|deploy(?:ment)?|ci\/cd)\s+pipelines?|kafka|rabbitmq|bullmq|celery|sqs|airflow|apache\s+spark|pyspark|dbt|cron\s+jobs?|background\s+(?:jobs?|workers?)|worker\s+(?:queue|pool|threads?)|retrieval[\s-]augmented|embeddings?|fine[\s-]tun(?:ed|ing)|quantiz(?:ation|ed)|pytorch|tensorflow|scikit[\s-]learn|eval(?:uation)?\s+harness|prompt\s+injection|guardrails|structured\s+output)\b/i,
  // Testing, CI/CD, containerization, and infra
  /\b(?:unit\s+tests?|integration\s+tests?|e2e\s+tests?|end-to-end(?:\s+tests?)?|regression\s+tests?|load\s+tests?|test\s+(?:suite|coverage|harness|cases)|vitest|jest|pytest|playwright|cypress|selenium|junit|testing\s+library|github\s+actions|gitlab\s+ci|circleci|jenkins|docker(?:file)?|containeriz(?:ed|ation)|kubernetes|k8s|helm\s+charts?|terraform|ansible|nginx|vercel|aws\s+(?:lambda|ecs|eks|s3|rds|ec2|cloudfront)|gcp|cloud\s+run|webassembly|wasm)\b/i,
  // Accessibility, UI engineering, and latency/reliability constraints
  /\b(?:accessibility|a11y|wcag|aria|screen\s+readers?|keyboard\s+navigation|focus\s+(?:management|trapping)|color\s+contrast|semantic\s+html|server[\s-]side\s+rendering|hydration|virtualiz(?:ed|ation)|optimistic\s+(?:ui|updates?)|code\s+splitting|lazy\s+loading|bundle\s+size|responsive\s+(?:layout|grid|design)|service\s+workers?|webgl|three\.js|codemirror|latency|p9[59]|throughput|backpressure|exponential\s+backoff|retry\s+(?:logic|policy|backoff)|circuit\s+breaker|dead[\s-]letter|fault[\s-]toleran(?:t|ce)|graceful\s+degradation|race\s+conditions?|concurrency|mutex|thread[\s-]safe|observability|opentelemetry|prometheus|grafana|sentry|structured\s+logging|distributed\s+tracing)\b/i,
];

const MEASURED_METRIC_PATTERN =
  /\b\d[\d,]*(?:\.\d+)?\s*%|\$\s*\d[\d,]*(?:\.\d+)?(?:\s*[kmb]\b)?|\b\d[\d,]*(?:\.\d+)?\s*(?:k|m|b)?\+?\s*(?:ms|req\/s|rps|qps|requests?(?:\/(?:s|sec|min|day))?|(?:(?:daily|monthly|active|concurrent|registered)\s+)*users)\b|\b\d+(?:\.\d+)?x\b/i;

/**
 * Extracts accomplishment bullet text (and non-header body text fallback) while
 * excluding Education/Coursework headers and lines so keyword lists outside
 * experience/project bullets do not satisfy engineering specificity checks.
 */
function extractAccomplishmentText(cleanBody: string): string {
  const lines = cleanBody.split("\n");
  const bulletLines: string[] = [];
  const fallbackLines: string[] = [];

  let inExcludedSection = false;
  let inBullet = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const sectionCallMatch = trimmed.match(
      /^#(?:resume-)?section\s*\(\s*"((?:\\.|[^"\\])*)"(?:\s*,|\s*\))/i
    );
    const isHeader =
      Boolean(sectionCallMatch) ||
      line.includes("resume-section") ||
      line.includes("#heading") ||
      /^(=+)\s+/.test(trimmed);

    if (isHeader) {
      const headingText = sectionCallMatch ? sectionCallMatch[1] : trimmed;
      inExcludedSection = /education|academic|coursework|skills|technologies|tools/i.test(
        headingText
      );
      inBullet = false;
      continue;
    }

    if (inExcludedSection || !trimmed) {
      inBullet = false;
      continue;
    }

    const isRoleOrClosingLine =
      /^\*[^*]+\*\s*(?:\||$)/.test(trimmed) ||
      /^#(?:entry|cventry|resume-entry)\b/i.test(trimmed) ||
      /^[\]\)}]+$/.test(trimmed);

    const isBulletStart =
      /^(?:[-+•])\s+/.test(trimmed) ||
      /^#(?:resume-)?(?:item|bullet)\b/i.test(trimmed) ||
      /^(?:#?list\.item)\b/i.test(trimmed);

    if (isBulletStart) {
      bulletLines.push(trimmed);
      inBullet = true;
      continue;
    }

    if (inBullet && !isRoleOrClosingLine) {
      bulletLines.push(trimmed);
      continue;
    }

    inBullet = false;
    if (!isRoleOrClosingLine) {
      fallbackLines.push(trimmed);
    }
  }

  return (bulletLines.length > 0 ? bulletLines : fallbackLines).join("\n");
}

function evaluateBaseHealth(
  fullContent: string,
  bodyText: string,
  skillsText: string,
  measuredPages?: number
): CategoryResult {
  let score = 0;
  const maxScore = 30;
  const findings: string[] = [];
  const cleanContent = stripTypstCommentsAndPreamble(fullContent);
  const cleanBody = stripTypstCommentsAndPreamble(bodyText);
  const accomplishmentText = extractAccomplishmentText(cleanBody);

  // Sub-check A: ATS Readability & Page Fit (8 pts)
  let readabilityPts = 0;
  const charLength = cleanContent.length;
  const hasMeasuredPages =
    typeof measuredPages === "number" && Number.isFinite(measuredPages) && measuredPages > 0;
  if (charLength <= 100) {
    findings.push("Warning: Document length is unusually short.");
  } else if (hasMeasuredPages ? measuredPages <= 1 : charLength <= 4000) {
    readabilityPts += 4;
    findings.push("✓ Standard one-page length constraints satisfied.");
  } else {
    readabilityPts += 2;
    findings.push("Warning: Document length may exceed a single page.");
  }

  if (
    /experience|work history|projects|education|skills/i.test(cleanContent)
  ) {
    readabilityPts += 4;
    findings.push("✓ Standard ATS section headers detected.");
  } else {
    findings.push("Warning: Missing standard ATS section headings.");
  }
  score += readabilityPts;

  // Sub-check B: Evidence Quality Signals (8 pts)
  let qualityPts = 0;
  if (/http:\/\/|https:\/\/|github\.com|link\(/i.test(cleanContent)) {
    qualityPts += 4;
    findings.push("✓ Working project/portfolio links present.");
  } else {
    findings.push("Warning: No live links or GitHub repository URLs found.");
  }

  // Concrete engineering specificity OR real measured metrics (4 pts)
  const hasEngineeringSpecifics = ENGINEERING_SPECIFICITY_PATTERNS.some((pattern) =>
    pattern.test(accomplishmentText)
  );
  const hasMeasuredMetrics = MEASURED_METRIC_PATTERN.test(accomplishmentText);

  if (hasEngineeringSpecifics && hasMeasuredMetrics) {
    qualityPts += 4;
    findings.push(
      "✓ Accomplishments demonstrate concrete engineering specifics and measured impact."
    );
  } else if (hasEngineeringSpecifics) {
    qualityPts += 4;
    findings.push(
      "✓ Accomplishments demonstrate concrete engineering specifics and technical scope."
    );
  } else if (hasMeasuredMetrics) {
    qualityPts += 4;
    findings.push("✓ Accomplishments demonstrate measured impact metrics.");
  } else {
    findings.push(
      "Warning: Accomplishments read as generic; specify concrete technical scope, systems built, or verifiable artifacts."
    );
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
    /text\(\s*fill:\s*(white|rgb\(#ffffff\)|"#ffffff")/i.test(cleanContent) ||
    /color:\s*white/i.test(cleanContent)
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
    const trimmed = line.trim();
    const isCommentOrDefinition =
      trimmed.startsWith("//") || /^#let\b/.test(trimmed);
    const sectionCallMatch = !isCommentOrDefinition
      ? trimmed.match(/^#section\s*\(\s*"((?:\\.|[^"\\])*)"(?:\s*,|\s*\))/)
      : null;

    const isHeader =
      Boolean(sectionCallMatch) ||
      line.includes("resume-section") ||
      line.includes("#heading") ||
      /^(=+)\s+/i.test(line);

    if (isHeader) {
      const headingText = sectionCallMatch ? sectionCallMatch[1] : line;
      if (/skills|technologies|tools/i.test(headingText)) {
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
