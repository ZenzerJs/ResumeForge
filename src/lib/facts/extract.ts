import { FactDateRange, FactEmployer, FactMetric, FactTitle, ResumeFacts } from "./types";
import {
  extractEmployerAliases,
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

type SectionKind = "experience" | "education" | "projects" | "skills" | "other" | "unknown";

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

    const isEducation = item.type?.toLowerCase() === "education";
    const isProject = item.type?.toLowerCase() === "project" || item.type?.toLowerCase() === "projects";

    let empNormForItem: string | undefined;
    if (item.organization && !isEducation && !isProject) {
      const normEmp = normalizeEmployer(item.organization);
      const aliases = extractEmployerAliases(item.organization);
      if (normEmp) {
        empNormForItem = normEmp;
        if (!employersMap.has(normEmp)) {
          employersMap.set(normEmp, {
            raw: item.organization,
            normalized: normEmp,
            aliases,
            evidenceId: item.id,
          });
        } else {
          const existing = employersMap.get(normEmp)!;
          const mergedAliases = new Set([...(existing.aliases || []), ...aliases]);
          existing.aliases = Array.from(mergedAliases);
        }
      }
    }

    if (item.title && !isEducation && !isProject) {
      const normTitle = normalizeTitle(item.title);
      if (normTitle && !titlesMap.has(normTitle)) {
        titlesMap.set(normTitle, {
          raw: item.title,
          normalized: normTitle,
          employerNormalized: empNormForItem,
          evidenceId: item.id,
        });
      }
    }

    if (item.dates && !isEducation) {
      const parsed = parseDateRange(item.dates, empNormForItem);
      const dateKey = `${empNormForItem || ""}:${parsed.raw}`;
      if (parsed.raw && !dateRangesMap.has(dateKey)) {
        dateRangesMap.set(dateKey, parsed);
      }
    }

    // Extract tags/skills
    const tags = parseArrayField(item.tags);
    for (const tag of tags) {
      const norm = normalizeSkillToken(tag);
      if (norm) skillsSet.add(norm);
    }

    // Extract metrics from summary
    if (item.verifiedSummary && !isEducation) {
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

        if (bullet.text && !isEducation) {
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

  // 3. Deduplicate metrics by rounded value + unit + subject
  const seenMetrics = new Set<string>();
  const dedupedMetrics: FactMetric[] = [];
  for (const m of metricsList) {
    const key = `${m.value}:${m.unit.toLowerCase()}:${m.subject || ""}`;
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

function classifySectionTitle(rawTitle: string): SectionKind {
  const lower = rawTitle.toLowerCase().trim();
  if (/\b(experience|employment|work\s+history|career|internships?)\b/.test(lower)) {
    return "experience";
  }
  if (/\b(education|academic|university|degrees?)\b/.test(lower)) {
    return "education";
  }
  if (/\b(projects?|personal\s+projects?|open\s+source)\b/.test(lower)) {
    return "projects";
  }
  if (/\b(skills?|technologies|technical\s+skills?|core\s+competencies|stack|tools)\b/.test(lower)) {
    return "skills";
  }
  return "other";
}

/**
 * Replaces `#let name(...) = { ... }` function definitions with spaces of equal length
 * so template helper definitions are never mistaken for resume content while preserving offsets.
 */
function blankOutLetDefinitions(source: string): string {
  const chars = source.split("");
  const letRegex = /#let\s+[a-zA-Z0-9_-]+(?:\s*\([^)]*\))?\s*=\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = letRegex.exec(source)) !== null) {
    const startIdx = match.index;
    const braceStart = startIdx + match[0].length - 1;
    let depth = 0;
    let endIdx = braceStart;
    for (let i = braceStart; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
    for (let i = startIdx; i <= endIdx; i++) {
      if (chars[i] !== "\n") chars[i] = " ";
    }
  }

  return chars.join("");
}

function findBalancedCalls(source: string, fnName: string): Array<{ start: number; end: number; body: string }> {
  const results: Array<{ start: number; end: number; body: string }> = [];
  const callRegex = new RegExp(`#${fnName}\\s*\\(`, "gi");
  let match: RegExpExecArray | null;

  while ((match = callRegex.exec(source)) !== null) {
    const start = match.index;
    const openParen = start + match[0].length - 1;
    let depth = 0;
    let inString: string | null = null;
    let end = -1;

    for (let i = openParen; i < source.length; i++) {
      const ch = source[i];
      const prev = i > 0 ? source[i - 1] : "";
      if (inString) {
        if (ch === inString && prev !== "\\") {
          inString = null;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = ch;
        continue;
      }
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end > openParen) {
      results.push({
        start,
        end,
        body: source.slice(openParen + 1, end),
      });
    }
  }

  return results;
}

function extractNamedStringArg(body: string, argName: string): string | undefined {
  const regex = new RegExp(`\\b${argName}\\s*:\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const m = body.match(regex);
  if (!m) return undefined;
  const val = (m[1] ?? m[2] ?? "").trim();
  return val.length > 0 ? val : undefined;
}

function extractDetailsBracketBlock(body: string): string | undefined {
  const m = /\bdetails\s*:\s*\[/i.exec(body);
  if (!m) return undefined;
  const openBracket = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = openBracket; i < body.length; i++) {
    if (body[i] === "[") depth++;
    else if (body[i] === "]") {
      depth--;
      if (depth === 0) {
        return body.slice(openBracket + 1, i);
      }
    }
  }
  return undefined;
}

const EXPLICIT_SKILL_LINE_PREFIX =
  /^\s*[-•*]\s*(?:\*([A-Za-z0-9\s&/+_-]+):\*\s*|(Languages|Frameworks(?:\s*&\s*Libraries)?|Developer\s+Tools|Tools(?:\s*&\s*Infrastructure)?|Databases|Libraries|Platforms|Core\s+Competencies|Technical\s+Skills|Skills)\s*:\s*)/i;

function extractSkillsFromBulletLine(line: string, skillsSet: Set<string>, inSkillsSection: boolean): boolean {
  const hasExplicitSkillPrefix = EXPLICIT_SKILL_LINE_PREFIX.test(line);
  if (!inSkillsSection && !hasExplicitSkillPrefix) {
    return false;
  }

  const trimmed = line.trim();
  if (!trimmed.startsWith("-") && !trimmed.startsWith("•") && !hasExplicitSkillPrefix) {
    return false;
  }

  const cleanedSkillLine = trimmed
    .replace(/^[-•*#\s]+/, "")
    .replace(/^\*[^*]+:\*\s*/, "")
    .replace(
      /^(Languages|Frameworks(?:\s*&\s*Libraries)?|Developer\s+Tools|Tools(?:\s*&\s*Infrastructure)?|Databases|Libraries|Platforms|Core\s+Competencies|Technical\s+Skills|Skills)\s*:\s*/i,
      ""
    );

  const skillTokens = cleanedSkillLine
    .split(/[,;|•]/)
    .map((s) => s.replace(/[*_]/g, "").trim());

  for (const tok of skillTokens) {
    if (tok.length > 1 && tok.length < 35 && !/^#?(?:section|entry|set|let|show)\b/i.test(tok)) {
      const norm = normalizeSkillToken(tok);
      if (norm && !norm.startsWith("section ")) {
        skillsSet.add(norm);
      }
    }
  }
  return true;
}

/**
 * Strips inline Typst styling/layout directives from a rendered bullet line before metric extraction.
 */
function stripInlineTypstMarkup(bulletLine: string): string {
  return bulletLine
    .replace(/^\s*[-•]\s+/, "")
    .replace(/#(?:rgb|v|h|text|line|set|show|align|grid|block)\s*\([^)]*\)/gi, " ")
    .replace(/#link\s*\([^)]*\)\s*\[([^\]]*)\]/gi, "$1")
    .replace(/[*_]/g, "")
    .trim();
}

/**
 * Extracts structural facts (roles, companies, dates, metrics, skills) from Typst source.
 */
function extractFactsFromTypst(
  rawSource: string,
  employersMap: Map<string, FactEmployer>,
  titlesMap: Map<string, FactTitle>,
  dateRangesMap: Map<string, FactDateRange>,
  metricsList: FactMetric[],
  skillsSet: Set<string>
) {
  // 1. Strip comment lines and `#let ... = { ... }` definitions
  const uncommented = rawSource
    .split("\n")
    .map((line) => (line.trim().startsWith("//") ? "" : line))
    .join("\n");
  const source = blankOutLetDefinitions(uncommented);

  // 2. Discover section boundaries (`#section("...")` and `== Heading`)
  const sections: Array<{ index: number; kind: SectionKind }> = [];
  const sectionFnRegex = /#section\s*\(\s*["']([^"']+)["']\s*\)/gi;
  let secMatch: RegExpExecArray | null;
  while ((secMatch = sectionFnRegex.exec(source)) !== null) {
    sections.push({
      index: secMatch.index,
      kind: classifySectionTitle(secMatch[1]),
    });
  }

  const headingRegex = /^==+\s*(.+)$/gm;
  while ((secMatch = headingRegex.exec(source)) !== null) {
    sections.push({
      index: secMatch.index,
      kind: classifySectionTitle(secMatch[1]),
    });
  }
  sections.sort((a, b) => a.index - b.index);

  const getSectionAt = (offset: number): SectionKind => {
    let current: SectionKind = "unknown";
    for (const s of sections) {
      if (s.index <= offset) current = s.kind;
      else break;
    }
    return current;
  };

  // Track character ranges consumed by `#entry(...)` so we don't double-parse their lines
  const consumedRanges: Array<{ start: number; end: number }> = [];

  // 3. Parse `#entry(...)`, `#resume-entry(...)` (with subtitle/role), `#project-entry(...)`, and `#skill-line(...)`
  const entryCalls = [
    ...findBalancedCalls(source, "entry"),
    ...findBalancedCalls(source, "project-entry"),
  ];
  // Include `#resume-entry(...)` calls only when they carry `subtitle:` or `role:` (otherwise let legacy #resume-entry + bold-pair handler process them)
  for (const rc of findBalancedCalls(source, "resume-entry")) {
    if (extractNamedStringArg(rc.body, "subtitle") || extractNamedStringArg(rc.body, "role")) {
      entryCalls.push(rc);
    }
  }
  const eduKeywords = /\b(university|college|institute|school|academy|bachelor|master|b\.?s\.?|m\.?s\.?|ph\.?d)\b/i;

  for (const call of entryCalls) {
    consumedRanges.push({ start: call.start, end: call.end });
    const sectionKind = getSectionAt(call.start);

    const titleArg = extractNamedStringArg(call.body, "title");
    const roleArg =
      extractNamedStringArg(call.body, "role") ??
      extractNamedStringArg(call.body, "subtitle") ??
      extractNamedStringArg(call.body, "stack");
    const locationArg = extractNamedStringArg(call.body, "location");
    const dateArg = extractNamedStringArg(call.body, "date");
    const detailsBlock = extractDetailsBracketBlock(call.body);

    const isLikelyEducation =
      sectionKind === "education" ||
      (sectionKind === "unknown" &&
        ((titleArg && eduKeywords.test(titleArg)) || (roleArg && eduKeywords.test(roleArg))));

    const isExperienceEntry =
      sectionKind === "experience" ||
      (sectionKind === "unknown" && !isLikelyEducation && Boolean(titleArg || roleArg));

    let empNormalized: string | undefined;

    if (isExperienceEntry) {
      if (titleArg) {
        const normEmp = normalizeEmployer(titleArg);
        const aliases = extractEmployerAliases(titleArg);
        if (normEmp) {
          empNormalized = normEmp;
          if (!employersMap.has(normEmp)) {
            employersMap.set(normEmp, {
              raw: titleArg,
              normalized: normEmp,
              aliases,
              location: locationArg,
            });
          }
        }
      }

      if (roleArg) {
        const normTitle = normalizeTitle(roleArg);
        if (normTitle && !titlesMap.has(normTitle)) {
          titlesMap.set(normTitle, {
            raw: roleArg,
            normalized: normTitle,
            employerNormalized: empNormalized,
          });
        }
      }

      if (dateArg) {
        const parsed = parseDateRange(dateArg, empNormalized);
        const dateKey = `${empNormalized || ""}:${parsed.raw}`;
        if (parsed.raw && !dateRangesMap.has(dateKey)) {
          dateRangesMap.set(dateKey, parsed);
        }
      }
    }

    if (detailsBlock) {
      const detailLines = detailsBlock.split("\n");
      for (const dLine of detailLines) {
        const trimmed = dLine.trim();
        if (!trimmed.startsWith("-") && !trimmed.startsWith("•")) continue;

        if (sectionKind === "skills") {
          extractSkillsFromBulletLine(trimmed, skillsSet, true);
        } else if (!isLikelyEducation) {
          if (!extractSkillsFromBulletLine(trimmed, skillsSet, false)) {
            const cleanBullet = stripInlineTypstMarkup(trimmed);
            metricsList.push(...extractMetricsFromText(cleanBullet));
          }
        }
      }
    }
  }

  for (const skCall of findBalancedCalls(source, "skill-line")) {
    consumedRanges.push({ start: skCall.start, end: skCall.end });
    const itemsArg = extractNamedStringArg(skCall.body, "items");
    if (itemsArg) {
      extractSkillsFromBulletLine(`- ${itemsArg}`, skillsSet, true);
    }
  }

  // 4. Parse `#resume-entry(title:, location:, date:)` and standalone lines outside `#entry(...)`
  const isOffsetConsumed = (offset: number): boolean =>
    consumedRanges.some((r) => offset >= r.start && offset <= r.end);

  const resumeEntryRegex =
    /#resume-entry\s*\(\s*title:\s*["']([^"']+)["'](?:,\s*location:\s*["']([^"']+)["'])?(?:,\s*date:\s*["']([^"']+)["'])?/gi;
  let lastResumeEntryDate: FactDateRange | undefined;

  let lineOffset = 0;
  const lines = source.split("\n");
  for (const line of lines) {
    const currentLineStart = lineOffset;
    lineOffset += line.length + 1;

    if (isOffsetConsumed(currentLineStart)) continue;
    const sectionKind = getSectionAt(currentLineStart);
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check #resume-entry
    resumeEntryRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = resumeEntryRegex.exec(line)) !== null) {
      const title = match[1];
      const date = match[3];

      if (title && sectionKind !== "education") {
        const normTitle = normalizeTitle(title);
        if (normTitle && !titlesMap.has(normTitle)) {
          titlesMap.set(normTitle, { raw: title, normalized: normTitle });
        }
      }
      if (date && sectionKind !== "education") {
        const parsed = parseDateRange(date);
        lastResumeEntryDate = parsed;
        if (parsed.raw && !dateRangesMap.has(parsed.raw)) {
          dateRangesMap.set(parsed.raw, parsed);
        }
      }
    }

    // Check bold pairs: `*Software Engineer* | *Google*` or `*Google* -- *Software Engineer*`
    const isExplicitSkillBullet = EXPLICIT_SKILL_LINE_PREFIX.test(trimmed);
    const boldPairs = !isExplicitSkillBullet ? line.match(/\*([^*]+)\*/g) : null;
    if (boldPairs && boldPairs.length >= 2 && sectionKind !== "skills" && sectionKind !== "education") {
      const part1 = boldPairs[0].replace(/\*/g, "").trim();
      const part2 = boldPairs[1].replace(/\*/g, "").trim();

      const titleKeywords =
        /\b(engineer|developer|designer|manager|lead|director|architect|intern|specialist|consultant|analyst|scientist|associate|officer|vp|founder)\b/i;

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
        employersMap.set(normEmp, {
          raw: empRaw,
          normalized: normEmp,
          aliases: extractEmployerAliases(empRaw),
        });
      }
      if (normTitle && !titlesMap.has(normTitle)) {
        titlesMap.set(normTitle, {
          raw: titleRaw,
          normalized: normTitle,
          employerNormalized: normEmp || undefined,
        });
      }

      if (normEmp && lastResumeEntryDate && !lastResumeEntryDate.employerNormalized) {
        lastResumeEntryDate.employerNormalized = normEmp;
      }

      // Check if an inline date range is also present on the bold-pair line
      const remainder = line.replace(/\*[^*]+\*/g, " ");
      const inlineDateMatch = remainder.match(
        /\b((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d\d\s*[-–—]\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d\d|present|current|now))\b/i
      );
      if (inlineDateMatch) {
        const parsed = parseDateRange(inlineDateMatch[1], normEmp || undefined);
        const dateKey = `${normEmp || ""}:${parsed.raw}`;
        if (parsed.raw && !dateRangesMap.has(dateKey)) {
          dateRangesMap.set(dateKey, parsed);
        }
      }
      continue;
    }

    // Standalone bullet lines
    if (trimmed.startsWith("-") || trimmed.startsWith("•")) {
      if (sectionKind === "skills") {
        extractSkillsFromBulletLine(trimmed, skillsSet, true);
      } else if (sectionKind !== "education") {
        if (!extractSkillsFromBulletLine(trimmed, skillsSet, false)) {
          const cleanBullet = stripInlineTypstMarkup(trimmed);
          metricsList.push(...extractMetricsFromText(cleanBullet));
        }
      }
    }
  }
}
