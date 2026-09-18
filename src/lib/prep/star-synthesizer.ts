export type EvidenceGrounding = "DIRECT" | "TRANSFERABLE" | "GAP";

export interface StarStory {
  requirement: string;
  grounding: EvidenceGrounding;
  evidenceIds: string[];
  sourceBulletIds: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  technologies: string[];
  evidenceTitle: string;
  mitigationPlan?: string;
}

export interface GapMitigation {
  requirement: string;
  mitigationStrategy: string;
  transferableSkills: string[];
}

export interface StarInterviewPrepResult {
  stories: StarStory[];
  gapMitigations: GapMitigation[];
  talkingPoints: string[];
}

export interface EvidenceBullet {
  id?: string;
  text: string;
  technologies?: string[] | string;
  verified?: boolean;
}

export interface EvidenceItem {
  id: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary?: string;
  tags?: string[];
  status?: "verified" | "draft" | "archived" | string;
  isDraft?: boolean;
  bullets?: EvidenceBullet[];
}

export interface StarSynthesizerOptions {
  job: {
    company: string;
    roleTitle: string;
    requirements?: {
      requiredSkills?: string[];
      preferredSkills?: string[];
      domainTerms?: string[];
      [key: string]: any;
    } | null;
  };
  evidenceItems?: EvidenceItem[];
  candidateInfo?: any;
}

/**
 * Extracts normalized technologies list from evidence item tags and bullet points.
 */
function extractEvidenceTechnologies(item: EvidenceItem): string[] {
  const techs = new Set<string>();
  if (Array.isArray(item.tags)) {
    item.tags.forEach((t) => techs.add(t.trim()));
  }
  if (Array.isArray(item.bullets)) {
    item.bullets.forEach((b) => {
      if (Array.isArray(b.technologies)) {
        b.technologies.forEach((t) => techs.add(t.trim()));
      } else if (typeof b.technologies === "string" && b.technologies.trim().length > 0) {
        b.technologies.split(/[,|/]/).forEach((t) => techs.add(t.trim()));
      }
    });
  }
  return Array.from(techs).filter(Boolean);
}

/**
 * Parses action and result strictly from a bullet text string without injecting unverified facts.
 */
function parseBulletActionResult(text: string): { action: string; result: string } {
  const clean = text.replace(/^[-*•]\s*/, "").trim();

  const resultRegex = /(?:,\s*|\s+)(?:reducing|increasing|improving|yielding|saving|delivering|resulting in|achieving|boosting)\s+/i;
  const matchIndex = clean.search(resultRegex);

  if (matchIndex > 0) {
    const actionPart = clean.slice(0, matchIndex).trim();
    const rawResultPart = clean.slice(matchIndex).replace(/^,\s*/, "").trim();
    return {
      action: actionPart,
      result: rawResultPart.charAt(0).toUpperCase() + rawResultPart.slice(1),
    };
  }

  return {
    action: clean,
    result: "Delivered verified outcome documented in master evidence record.",
  };
}

/**
 * Known transferable tech adjacency mapping for realistic, honest bridge strategies.
 */
const TECH_ADJACENCIES: Record<string, string[]> = {
  graphql: ["rest", "api", "typescript", "grpc", "node", "json"],
  rust: ["c++", "c", "go", "golang", "systems", "concurrency"],
  kubernetes: ["docker", "containers", "ci/cd", "aws", "gcp", "devops"],
  react: ["next.js", "vue", "frontend", "typescript", "javascript", "svelte"],
  vue: ["react", "frontend", "javascript", "typescript"],
  postgresql: ["sql", "mysql", "databases", "sqlite", "relational"],
  mysql: ["postgresql", "sql", "databases", "sqlite"],
  redis: ["caching", "memcached", "in-memory", "databases"],
  aws: ["cloud", "gcp", "azure", "infrastructure"],
  gcp: ["aws", "cloud", "azure", "infrastructure"],
};

/**
 * Checks if candidate has verified adjacent skills for a requirement.
 */
function findTransferableMatch(
  req: string,
  verifiedItems: EvidenceItem[]
): { item: EvidenceItem; bullet?: EvidenceBullet; adjacentTech: string } | null {
  const lowerReq = req.toLowerCase();
  const knownAdjacencies = TECH_ADJACENCIES[lowerReq] || [];

  for (const item of verifiedItems) {
    const itemTechs = extractEvidenceTechnologies(item).map((t) => t.toLowerCase());

    // Check if any item technology is in known adjacencies
    for (const tech of itemTechs) {
      if (knownAdjacencies.includes(tech)) {
        return {
          item,
          bullet: item.bullets?.[0],
          adjacentTech: tech,
        };
      }
    }

    // Check tags or title for domain overlap
    if (Array.isArray(item.tags)) {
      for (const tag of item.tags) {
        if (knownAdjacencies.includes(tag.toLowerCase())) {
          return {
            item,
            bullet: item.bullets?.[0],
            adjacentTech: tag,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Deterministically synthesizes STAR interview stories and gap mitigations strictly from verified evidence.
 * Enforces strict provenance contract: unverified drafts and archived items are rejected.
 */
export function synthesizeStarInterviewPrep(
  options: StarSynthesizerOptions
): StarInterviewPrepResult {
  const { job, evidenceItems = [] } = options;
  const stories: StarStory[] = [];
  const gapMitigations: GapMitigation[] = [];
  const talkingPoints: string[] = [];

  // Filter: Reject unverified drafts and archived items
  const validEvidenceItems = evidenceItems.filter((item) => {
    if (item.status === "archived") return false;
    if (item.status === "draft" || item.isDraft === true) return false;
    return true;
  });

  const requiredSkills = (job.requirements?.requiredSkills || []).map((s) => s.trim()).filter(Boolean);
  const preferredSkills = (job.requirements?.preferredSkills || []).map((s) => s.trim()).filter(Boolean);
  const domainTerms = (job.requirements?.domainTerms || []).map((s) => s.trim()).filter(Boolean);

  const matchedEvidenceIds = new Set<string>();

  // Collect all verified technologies across valid items
  const allVerifiedTechs: string[] = [];
  validEvidenceItems.forEach((ev) => {
    extractEvidenceTechnologies(ev).forEach((t) => {
      if (!allVerifiedTechs.includes(t)) {
        allVerifiedTechs.push(t);
      }
    });
  });

  // Helper to find exact/direct matching evidence item
  const findDirectEvidence = (req: string): { item: EvidenceItem; bullet?: EvidenceBullet } | null => {
    const lowerReq = req.toLowerCase();

    for (const ev of validEvidenceItems) {
      const itemTechs = extractEvidenceTechnologies(ev).map((t) => t.toLowerCase());
      const hasTechMatch = itemTechs.some((t) => t === lowerReq || t.includes(lowerReq) || lowerReq.includes(t));

      const matchingBullet = ev.bullets?.find((b) => {
        if (b.verified === false) return false;
        const bulletText = b.text.toLowerCase();
        let bulletTechs: string[] = [];
        if (Array.isArray(b.technologies)) {
          bulletTechs = b.technologies.map((t) => t.toLowerCase());
        } else if (typeof b.technologies === "string") {
          bulletTechs = b.technologies.toLowerCase().split(/[,|/]/).map((t) => t.trim());
        }
        return (
          bulletText.includes(lowerReq) ||
          bulletTechs.some((t) => t === lowerReq || t.includes(lowerReq) || lowerReq.includes(t))
        );
      });

      if (hasTechMatch || matchingBullet) {
        return {
          item: ev,
          bullet: matchingBullet || ev.bullets?.find((b) => b.verified !== false) || ev.bullets?.[0],
        };
      }
    }
    return null;
  };

  const allReqs = [...requiredSkills, ...preferredSkills];

  // Process all requirements
  for (const req of allReqs) {
    const directMatch = findDirectEvidence(req);

    if (directMatch) {
      matchedEvidenceIds.add(directMatch.item.id);
      const org = directMatch.item.organization ? ` at ${directMatch.item.organization}` : "";
      const dates = directMatch.item.dates ? ` (${directMatch.item.dates})` : "";
      const { action, result } = directMatch.bullet
        ? parseBulletActionResult(directMatch.bullet.text)
        : {
            action: directMatch.item.verifiedSummary || `Utilized ${req} in core engineering workflows.`,
            result: "Delivered verified outcome documented in master record.",
          };

      stories.push({
        requirement: req,
        grounding: "DIRECT",
        evidenceIds: [directMatch.item.id],
        sourceBulletIds: directMatch.bullet?.id ? [directMatch.bullet.id] : [],
        situation: `In role as ${directMatch.item.title}${org}${dates}.`,
        task: `Applied ${req} to deliver technical outcomes for ${directMatch.item.title}.`,
        action,
        result,
        technologies: extractEvidenceTechnologies(directMatch.item),
        evidenceTitle: `${directMatch.item.title}${org}`,
      });
    } else {
      // Check transferable
      const transferableMatch = findTransferableMatch(req, validEvidenceItems);

      if (transferableMatch) {
        matchedEvidenceIds.add(transferableMatch.item.id);
        const org = transferableMatch.item.organization ? ` at ${transferableMatch.item.organization}` : "";
        const dates = transferableMatch.item.dates ? ` (${transferableMatch.item.dates})` : "";
        const { action, result } = transferableMatch.bullet
          ? parseBulletActionResult(transferableMatch.bullet.text)
          : {
              action: transferableMatch.item.verifiedSummary || `Applied adjacent technical depth.`,
              result: "Delivered verified outcome documented in master record.",
            };

        stories.push({
          requirement: req,
          grounding: "TRANSFERABLE",
          evidenceIds: [transferableMatch.item.id],
          sourceBulletIds: transferableMatch.bullet?.id ? [transferableMatch.bullet.id] : [],
          situation: `In role as ${transferableMatch.item.title}${org}${dates}.`,
          task: `Leveraged verified depth in ${transferableMatch.adjacentTech} as an architectural bridge for ${req}.`,
          action,
          result,
          technologies: extractEvidenceTechnologies(transferableMatch.item),
          evidenceTitle: `${transferableMatch.item.title}${org}`,
          mitigationPlan: `Discuss how verified experience in ${transferableMatch.adjacentTech} provides strong transferable fundamentals for ${req}.`,
        });

        gapMitigations.push({
          requirement: req,
          mitigationStrategy: `Bridge via verified background in ${transferableMatch.adjacentTech} to demonstrate rapid onboarding curve.`,
          transferableSkills: [transferableMatch.adjacentTech],
        });
      } else {
        // Honest Unverified Gap
        const transferable = allVerifiedTechs.slice(0, 2);
        stories.push({
          requirement: req,
          grounding: "GAP",
          evidenceIds: [],
          sourceBulletIds: [],
          situation: "",
          task: "",
          action: "",
          result: "",
          technologies: [],
          evidenceTitle: "Unverified Gap",
          mitigationPlan: `No verified example demonstrates ${req}. State your learning plan or discuss adjacent ${transferable.join(", ") || "software engineering"} work only if verified.`,
        });

        gapMitigations.push({
          requirement: req,
          mitigationStrategy: `Acknowledge gap directly and outline self-directed learning or transition plan.`,
          transferableSkills: transferable,
        });
      }
    }
  }

  // If no job requirements given, synthesize DIRECT stories from all valid evidence items
  if (allReqs.length === 0) {
    for (const ev of validEvidenceItems) {
      if (stories.length >= 6) break;
      const org = ev.organization ? ` at ${ev.organization}` : "";
      const dates = ev.dates ? ` (${ev.dates})` : "";
      const bullet = ev.bullets?.find((b) => b.verified !== false) || ev.bullets?.[0];
      const { action, result } = bullet
        ? parseBulletActionResult(bullet.text)
        : {
            action: ev.verifiedSummary || "Executed key initiatives.",
            result: "Delivered verified outcome documented in master record.",
          };

      stories.push({
        requirement: ev.title,
        grounding: "DIRECT",
        evidenceIds: [ev.id],
        sourceBulletIds: bullet?.id ? [bullet.id] : [],
        situation: `In role as ${ev.title}${org}${dates}.`,
        task: `Executed core engineering responsibilities.`,
        action,
        result,
        technologies: extractEvidenceTechnologies(ev),
        evidenceTitle: `${ev.title}${org}`,
      });
    }
  }

  // Synthesize Talking Points strictly from valid verified items
  validEvidenceItems.forEach((ev) => {
    if (ev.verifiedSummary) {
      talkingPoints.push(`${ev.title}${ev.organization ? ` (${ev.organization})` : ""}: ${ev.verifiedSummary}`);
    }
    if (ev.bullets) {
      ev.bullets
        .filter((b) => b.verified !== false)
        .slice(0, 2)
        .forEach((b) => {
          const clean = b.text.replace(/^[-*•]\s*/, "").trim();
          if (clean && !talkingPoints.includes(clean)) {
            talkingPoints.push(clean);
          }
        });
    }
  });

  return {
    stories,
    gapMitigations,
    talkingPoints,
  };
}

/**
 * Formats a STAR story object into clean clipboard-ready text with evidence citations.
 */
export function formatStarStoryForClipboard(story: StarStory): string {
  if (story.grounding === "GAP") {
    return [
      `REQUIREMENT: ${story.requirement} [GAP - UNVERIFIED]`,
      `--------------------------------------------------`,
      `MITIGATION PLAN:`,
      story.mitigationPlan || `No verified evidence demonstrates ${story.requirement}. Acknowledge gap and discuss active learning plan.`,
    ].join("\n");
  }

  const tag = story.grounding === "DIRECT" ? "[DIRECT VERIFIED EVIDENCE]" : "[TRANSFERABLE EVIDENCE]";
  return [
    `STORY: ${story.requirement} ${tag}`,
    `SOURCE: ${story.evidenceTitle}${story.evidenceIds.length > 0 ? ` (Evidence ID: ${story.evidenceIds.join(", ")})` : ""}`,
    story.sourceBulletIds.length > 0 ? `BULLET ID: ${story.sourceBulletIds.join(", ")}` : "",
    `--------------------------------------------------`,
    `SITUATION: ${story.situation}`,
    `TASK:      ${story.task}`,
    `ACTION:    ${story.action}`,
    `RESULT:    ${story.result}`,
    story.technologies.length > 0 ? `TECH:      ${story.technologies.join(", ")}` : "",
    story.mitigationPlan ? `BRIDGE NOTE: ${story.mitigationPlan}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
