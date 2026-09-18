import { FactDateRange, FactEmployer, FactMetric, FactTitle, ResumeFacts } from "./types";
import {
  extractMetricsFromText,
  normalizeEmployer,
  normalizeSkillToken,
  normalizeTitle,
  parseDateRange,
} from "./normalize";

export interface VerifiedEvidenceInput {
  id: string;
  type: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary: string;
  tags?: string[] | string;
  status: string;
  bullets?: Array<{
    id: string;
    text: string;
    technologies?: string[] | string;
    verified: boolean;
  }>;
}

/**
 * Extracts an immutable FactSnapshot from Master Typst source and verified Evidence Bank items.
 * Ignores unverified drafts and archived evidence items.
 */
export function extractResumeFacts(
  typstSource: string,
  evidenceBank: VerifiedEvidenceInput[] = []
): ResumeFacts {
  const employersMap = new Map<string, FactEmployer>();
  const titlesMap = new Map<string, FactTitle>();
  const dateRangesMap = new Map<string, FactDateRange>();
  const metricsList: FactMetric[] = [];
  const skillsSet = new Set<string>();
  const evidenceIdsSet = new Set<string>();

  // 1. Process verified Evidence Bank items
  for (const item of evidenceBank) {
    if (item.status !== "verified") continue;
    evidenceIdsSet.add(item.id);

    if (item.organization) {
      const normEmp = normalizeEmployer(item.organization);
      if (normEmp && !employersMap.has(normEmp)) {
        employersMap.set(normEmp, {
          raw: item.organization,
          normalized: normEmp,
          evidenceId: item.id,
        });
      }
    }

    if (item.title) {
      const normTitle = normalizeTitle(item.title);
      if (normTitle && !titlesMap.has(normTitle)) {
        titlesMap.set(normTitle, {
          raw: item.title,
          normalized: normTitle,
          employerNormalized: item.organization ? normalizeEmployer(item.organization) : undefined,
          evidenceId: item.id,
        });
      }
    }

    if (item.dates) {
      const parsed = parseDateRange(item.dates);
      if (parsed.raw && !dateRangesMap.has(parsed.raw)) {
        dateRangesMap.set(parsed.raw, parsed);
      }
    }

    // Extract tags/skills
    const tags = parseArrayField(item.tags);
    for (const tag of tags) {
      const norm = normalizeSkillToken(tag);
      if (norm) skillsSet.add(norm);
    }

    // Extract metrics from summary
    if (item.verifiedSummary) {
      const mets = extractMetricsFromText(item.verifiedSummary);
      metricsList.push(...mets);
    }

    // Process bullets
    if (item.bullets) {
      for (const bullet of item.bullets) {
        if (!bullet.verified) continue;
        evidenceIdsSet.add(bullet.id);

        const techs = parseArrayField(bullet.technologies);
        for (const tech of techs) {
          const norm = normalizeSkillToken(tech);
          if (norm) skillsSet.add(norm);
        }

        if (bullet.text) {
          const mets = extractMetricsFromText(bullet.text);
          metricsList.push(...mets);
        }
      }
    }
  }

  // 2. Process Master Typst source markup
  if (typstSource) {
    extractFactsFromTypst(typstSource, employersMap, titlesMap, dateRangesMap, metricsList, skillsSet);
  }

  // 3. Deduplicate metrics by rounded value + unit
  const seenMetrics = new Set<string>();
  const dedupedMetrics: FactMetric[] = [];
  for (const m of metricsList) {
    const key = `${m.value}:${m.unit.toLowerCase()}`;
    if (!seenMetrics.has(key)) {
      seenMetrics.add(key);
      dedupedMetrics.push(m);
    }
  }

  return {
    version: 1,
    snapshotAt: new Date().toISOString(),
    employers: Array.from(employersMap.values()),
    titles: Array.from(titlesMap.values()),
    dateRanges: Array.from(dateRangesMap.values()),
    metrics: dedupedMetrics,
    skills: Array.from(skillsSet).sort(),
    evidenceIds: Array.from(evidenceIdsSet),
  };
}

function parseArrayField(val: string[] | string | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return val.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

/**
 * Extracts structural facts (roles, companies, dates, metrics, skills) from Typst source.
 */
function extractFactsFromTypst(
  source: string,
  employersMap: Map<string, FactEmployer>,
  titlesMap: Map<string, FactTitle>,
  dateRangesMap: Map<string, FactDateRange>,
  metricsList: FactMetric[],
  skillsSet: Set<string>
) {
  const lines = source.split("\n");

  // Regex patterns for Typst entry helpers:
  // e.g. #resume-entry(title: "Software Engineer", location: "Seattle, WA", date: "May 2023 - Present", description: "...")
  // or #entry("Software Engineer", "Google", "2022 - 2023")
  const entryRegex = /#resume-entry\s*\(\s*title:\s*["']([^"']+)["'](?:,\s*location:\s*["']([^"']+)["'])?(?:,\s*date:\s*["']([^"']+)["'])?/gi;

  for (const line of lines) {
    // Check #resume-entry
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(line)) !== null) {
      const title = match[1];
      const date = match[3];

      if (title) {
        const normTitle = normalizeTitle(title);
        if (normTitle && !titlesMap.has(normTitle)) {
          titlesMap.set(normTitle, { raw: title, normalized: normTitle });
        }
      }
      if (date) {
        const parsed = parseDateRange(date);
        if (parsed.raw && !dateRangesMap.has(parsed.raw)) {
          dateRangesMap.set(parsed.raw, parsed);
        }
      }
    }

    // Check headings / bold roles: *Software Engineer* | *Google* or *Google* -- *Software Engineer*
    const boldPairs = line.match(/\*([^*]+)\*/g);
    if (boldPairs && boldPairs.length >= 2) {
      const part1 = boldPairs[0].replace(/\*/g, "").trim();
      const part2 = boldPairs[1].replace(/\*/g, "").trim();

      const titleKeywords = /\b(engineer|developer|designer|manager|lead|director|architect|intern|specialist|consultant|analyst|scientist|associate|officer|vp|founder)\b/i;

      let empRaw = part1;
      let titleRaw = part2;

      if (titleKeywords.test(part1) && !titleKeywords.test(part2)) {
        titleRaw = part1;
        empRaw = part2;
      } else if (!titleKeywords.test(part1) && titleKeywords.test(part2)) {
        empRaw = part1;
        titleRaw = part2;
      }

      const normEmp = normalizeEmployer(empRaw);
      const normTitle = normalizeTitle(titleRaw);

      if (normEmp && !employersMap.has(normEmp)) {
        employersMap.set(normEmp, { raw: empRaw, normalized: normEmp });
      }
      if (normTitle && !titlesMap.has(normTitle)) {
        titlesMap.set(normTitle, { raw: titleRaw, normalized: normTitle });
      }
    }

    // Check skills section lines
    if (line.toLowerCase().includes("skills") || line.includes("- *") || line.startsWith("- ")) {
      const cleanedSkillLine = line
        .replace(/^[-*#\s]+/, "")
        .replace(/^(Languages|Frameworks|Developer Tools|Tools|Databases|Libraries|Platforms|Core Competencies|Technical Skills|Skills)\s*:\s*/i, "");

      const skillTokens = cleanedSkillLine
        .split(/[,;|•]/)
        .map((s) => s.replace(/[*_]/g, "").trim());
      for (const tok of skillTokens) {
        if (tok.length > 1 && tok.length < 35) {
          const norm = normalizeSkillToken(tok);
          if (norm) skillsSet.add(norm);
        }
      }
    }

    // Extract metrics from line
    const lineMetrics = extractMetricsFromText(line);
    metricsList.push(...lineMetrics);
  }
}
