import {
  FactDateRange,
  FactEmployer,
  FactMetric,
  FactTitle,
  ResumeFacts,
  TailoringValidationContext,
  VerifiedEvidenceRegistry,
} from "./types";
import {
   extractEmployerAliases,
  extractMetricsFromText,
  normalizeEmployer,
  normalizeSkillToken,
  normalizeTitle,
  parseDateRange,
} from "./normalize";
import { parseManagedResume } from "@/lib/typst/resume-document";

export interface VerifiedEvidenceInput {
  id: string;
  userId?: string | null;
  type: string;
  title: string;
  organization?: string | null;
  dates?: string | null;
  verifiedSummary: string;
  tags?: string[] | string;
  status: string;
  bullets?: Array<{
    id: string;
    evidenceId?: string;
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

export function isTailoringValidationContext(
  value: unknown
): value is TailoringValidationContext {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === 2 &&
    typeof (value as { revision?: unknown }).revision === "string" &&
    typeof (value as { facts?: unknown }).facts === "object" &&
    (value as { facts?: unknown }).facts !== null &&
    typeof (value as { masterBaseline?: unknown }).masterBaseline === "object" &&
    (value as { masterBaseline?: unknown }).masterBaseline !== null &&
    typeof (value as { registry?: unknown }).registry === "object" &&
    (value as { registry?: unknown }).registry !== null
  );
}

export function resolveValidationFacts(
  input: ResumeFacts | TailoringValidationContext
): ResumeFacts {
  return isTailoringValidationContext(input) ? input.facts : input;
}

function stableContextDigest(input: unknown): string {
  const text = JSON.stringify(input);
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193);
    h2 = Math.imul(h2 ^ ch, 0x01000193);
  }
  return `ctx_${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}

/**
 * Builds one versioned tailoring validation context combining the protected frozen master
 * baseline with current owned verified evidence/bullets without mutating the master snapshot.
 */
export function buildTailoringValidationContext(
  masterBaseline: ResumeFacts,
  evidenceBank: readonly VerifiedEvidenceInput[] = [],
  options?: {
    ownerId?: string;
    revision?: string;
    authoritativeEvidence?: boolean;
  }
): TailoringValidationContext {
  const verifiedItems: VerifiedEvidenceInput[] = [];
  const retiredIds = new Set<string>();
  const evidenceIds: string[] = [];
  const bulletIds: string[] = [];
  const bulletToEvidenceId: Record<string, string> = {};

  for (const item of evidenceBank) {
    const owned = options?.ownerId === undefined || item.userId === options.ownerId;
    if (!owned || item.status !== "verified") {
      retiredIds.add(item.id);
      for (const b of item.bullets || []) {
        retiredIds.add(b.id);
      }
      continue;
    }

    const verifiedBullets = (item.bullets || []).filter((b) => {
      const ok = b.verified && (b.evidenceId === undefined || b.evidenceId === item.id);
      if (!ok) retiredIds.add(b.id);
      return ok;
    });

    verifiedItems.push({ ...item, bullets: verifiedBullets });
    evidenceIds.push(item.id);
    for (const b of verifiedBullets) {
      bulletIds.push(b.id);
      bulletToEvidenceId[b.id] = item.id;
    }
  }

  const evidenceFacts = extractResumeFacts("", verifiedItems);

  const employersMap = new Map<string, FactEmployer>();
  for (const emp of masterBaseline.employers || []) {
    const key = emp.normalized || normalizeEmployer(emp.raw);
    if (!key) continue;
    employersMap.set(key, {
      ...emp,
      aliases: [...(emp.aliases || [])],
    });
  }
  for (const emp of evidenceFacts.employers) {
    const key = emp.normalized || normalizeEmployer(emp.raw);
    if (!key) continue;
    const existing = employersMap.get(key);
    if (!existing) {
      employersMap.set(key, { ...emp, aliases: [...(emp.aliases || [])] });
    } else {
      const mergedAliases = new Set([...(existing.aliases || []), ...(emp.aliases || [])]);
      existing.aliases = Array.from(mergedAliases);
    }
  }

  const titlesMap = new Map<string, FactTitle>();
  for (const t of [...(masterBaseline.titles || []), ...evidenceFacts.titles]) {
    const key = `${t.normalized}::${t.employerNormalized || ""}`;
    if (!titlesMap.has(key)) {
      titlesMap.set(key, { ...t });
    }
  }

  const dateRangesMap = new Map<string, FactDateRange>();
  for (const d of [...(masterBaseline.dateRanges || []), ...evidenceFacts.dateRanges]) {
    const key = `${d.employerNormalized || ""}::${d.raw}`;
    if (!dateRangesMap.has(key)) {
      dateRangesMap.set(key, { ...d });
    }
  }

  const seenMetrics = new Set<string>();
  const mergedMetrics: FactMetric[] = [];
  for (const m of [...(masterBaseline.metrics || []), ...evidenceFacts.metrics]) {
    const key = `${m.value}:${m.unit.toLowerCase()}:${m.subject || ""}`;
    if (!seenMetrics.has(key)) {
      seenMetrics.add(key);
      mergedMetrics.push({ ...m });
    }
  }

  const skillsSet = new Set<string>();
  for (const s of [...(masterBaseline.skills || []), ...evidenceFacts.skills]) {
    const norm = normalizeSkillToken(s);
    if (norm) skillsSet.add(norm);
  }

  const mergedEvidenceIds = new Set<string>();
  if (!options?.authoritativeEvidence) {
    for (const id of masterBaseline.evidenceIds || []) {
      if (!retiredIds.has(id)) mergedEvidenceIds.add(id);
    }
  }
  for (const id of evidenceIds) mergedEvidenceIds.add(id);
  for (const id of bulletIds) mergedEvidenceIds.add(id);

  const facts: ResumeFacts = {
    version: 1,
    snapshotAt: masterBaseline.snapshotAt,
    employers: Array.from(employersMap.values()),
    titles: Array.from(titlesMap.values()),
    dateRanges: Array.from(dateRangesMap.values()),
    metrics: mergedMetrics,
    skills: Array.from(skillsSet).sort(),
    evidenceIds: Array.from(mergedEvidenceIds),
  };

  const registry: VerifiedEvidenceRegistry = {
    evidenceIds: [...evidenceIds].sort(),
    bulletIds: [...bulletIds].sort(),
    bulletToEvidenceId,
  };

  const revision =
    options?.revision ??
    stableContextDigest({
      baseline: {
        employers: masterBaseline.employers,
        titles: masterBaseline.titles,
        dateRanges: masterBaseline.dateRanges,
        metrics: masterBaseline.metrics,
        skills: masterBaseline.skills,
        evidenceIds: masterBaseline.evidenceIds,
      },
      evidence: verifiedItems.map((item) => ({
        id: item.id,
        title: item.title,
        organization: item.organization ?? null,
        dates: item.dates ?? null,
        verifiedSummary: item.verifiedSummary,
        tags: parseArrayField(item.tags),
        bullets: (item.bullets || []).map((b) => ({
          id: b.id,
          text: b.text,
          technologies: parseArrayField(b.technologies),
        })),
      })),
    });

  return {
    version: 2,
    revision,
    masterBaseline: {
      ...masterBaseline,
      employers: (masterBaseline.employers || []).map((e) => ({ ...e, aliases: [...(e.aliases || [])] })),
      titles: (masterBaseline.titles || []).map((t) => ({ ...t })),
      dateRanges: (masterBaseline.dateRanges || []).map((d) => ({ ...d })),
      metrics: (masterBaseline.metrics || []).map((m) => ({ ...m })),
      skills: [...(masterBaseline.skills || [])],
      evidenceIds: [...(masterBaseline.evidenceIds || [])],
    },
    facts,
    registry,
    assembledAt: new Date().toISOString(),
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
 * Replaces `#let name(...) = ...` function/variable definitions with spaces of equal length
 * so template helper definitions are never mistaken for resume content while preserving offsets.
 */
function blankOutLetDefinitions(source: string): string {
  const chars = source.split("");
  const letRegex = /#let\s+[a-zA-Z0-9_-]+(?:\s*\([^)]*\))?\s*=\s*/g;
  let match: RegExpExecArray | null;

  while ((match = letRegex.exec(source)) !== null) {
    const startIdx = match.index;
    const rhsStart = startIdx + match[0].length;
    let endIdx = rhsStart;

    if (source[rhsStart] === "{") {
      let depth = 0;
      for (let i = rhsStart; i < source.length; i++) {
        if (source[i] === "{") depth++;
        else if (source[i] === "}") {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    } else {
      let parenDepth = 0;
      let bracketDepth = 0;
      let braceDepth = 0;
      let inString: string | null = null;
      for (let i = rhsStart; i < source.length; i++) {
        const ch = source[i];
        const prev = i > 0 ? source[i - 1] : "";
        if (inString) {
          if (ch === inString && prev !== "\\") inString = null;
          endIdx = i;
          continue;
        }
        if (ch === '"' || ch === "'") {
          inString = ch;
          endIdx = i;
          continue;
        }
        if (ch === "(") parenDepth++;
        else if (ch === ")") parenDepth = Math.max(0, parenDepth - 1);
        else if (ch === "[") bracketDepth++;
        else if (ch === "]") bracketDepth = Math.max(0, bracketDepth - 1);
        else if (ch === "{") braceDepth++;
        else if (ch === "}") braceDepth = Math.max(0, braceDepth - 1);
        else if (ch === "\n" && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
          endIdx = i - 1;
          break;
        }
        endIdx = i;
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

function cleanTypstInlineValue(raw: string): string {
  let text = raw.trim();
  // Unwrap outer/inline Typst formatting helpers repeatedly
  for (let pass = 0; pass < 4; pass++) {
    const next = text
      .replace(/#(?:align|text|block|box)\s*\([^)]*\)\s*\[([\s\S]*?)\]/gi, "$1")
      .replace(/#(?:strong|emph|box|upper|lower)\s*\[([\s\S]*?)\]/gi, "$1")
      .replace(/#(?:strong|emph|upper|lower)\s*\(\s*(?:"([^"]*)"|'([^']*)'|\[([\s\S]*?)\])\s*\)/gi, "$1$2$3")
      .replace(/#link\s*\([^)]*\)\s*\[([\s\S]*?)\]/gi, "$1")
      .replace(/#(?:v|h|line|set|show)\s*\([^)]*\)/gi, " ");
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/#sym\.dot\b/g, "|")
    .replace(/\\([\\#\[\]*_@$<>`~/=+^&-])/g, "$1")
    .replace(/[*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractBalancedBrackets(input: string, openBracketIdx: number): { content: string; endIdx: number } | null {
  if (input[openBracketIdx] !== "[") return null;
  let depth = 0;
  for (let i = openBracketIdx; i < input.length; i++) {
    if (input[i] === "\\") {
      i++;
      continue;
    }
    if (input[i] === "[") depth++;
    else if (input[i] === "]") {
      depth--;
      if (depth === 0) {
        return { content: input.slice(openBracketIdx + 1, i), endIdx: i };
      }
    }
  }
  return null;
}

function extractNamedStringArg(body: string, argName: string): string | undefined {
  const stringRegex = new RegExp(`\\b${argName}\\s*:\\s*(?:"([^"]*)"|'([^']*)')`, "i");
  const m = body.match(stringRegex);
  if (m) {
    const val = cleanTypstInlineValue(m[1] ?? m[2] ?? "");
    return val.length > 0 ? val : undefined;
  }

  const bracketPrefix = new RegExp(`\\b${argName}\\s*:\\s*\\[`, "i");
  const bm = bracketPrefix.exec(body);
  if (bm) {
    const openBracket = bm.index + bm[0].length - 1;
    const extracted = extractBalancedBrackets(body, openBracket);
    if (extracted) {
      const val = cleanTypstInlineValue(extracted.content);
      return val.length > 0 ? val : undefined;
    }
  }
  return undefined;
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
  /^\s*(?:[-•*]\s*)?(?:\*([A-Za-z0-9\s&/+_-]+):\*\s*|\*([A-Za-z0-9\s&/+_-]+)\*\s*:\s*|(Languages|Frameworks(?:\s*&\s*Libraries)?|Developer\s+Tools|Tools(?:\s*&\s*Infrastructure)?|Databases|Libraries|Platforms|Core\s+Competencies|Technical\s+Skills|Skills)\s*:\s*)/i;

function unwrapTypstLineForExtraction(rawLine: string): string {
  let text = rawLine.trim();
  for (let pass = 0; pass < 4; pass++) {
    const next = text
      .replace(/^#(?:block|align|text|box)\s*(?:\([^)]*\))?\s*\[([\s\S]*)\]$/i, "$1")
      .replace(/#strong\s*\[([^\]]*)\]/gi, "*$1*")
      .replace(/#emph\s*\[([^\]]*)\]/gi, "_$1_")
      .replace(/#(?:strong|emph)\s*\(\s*(?:"([^"]*)"|'([^']*)')\s*\)/gi, "*$1$2*")
      .replace(/#link\s*\([^)]*\)\s*\[([^\]]*)\]/gi, "$1")
      .trim();
    if (next === text) break;
    text = next;
  }
  return text
    .replace(/#(?:block|grid|v|h|text|line|align|set|let|show)\s*\([^)]*\)/gi, " ")
    .replace(/\\([\\#\[\]*_@$<>`~/=+^&-])/g, "$1")
    .trim();
}

function extractSkillsFromBulletLine(line: string, skillsSet: Set<string>, inSkillsSection: boolean): boolean {
  const rawTrimmed = line.trim();
  if (
    /^=+/.test(rawTrimmed) ||
    /^#(?:section|entry|resume-entry|project-entry|skill-line|set|let|show|v|h|line|grid|page|par|list)\b/i.test(
      rawTrimmed
    )
  ) {
    return false;
  }

  const normalizedLine = unwrapTypstLineForExtraction(rawTrimmed);
  if (!normalizedLine) return false;

  const hasExplicitSkillPrefix = EXPLICIT_SKILL_LINE_PREFIX.test(normalizedLine);
  if (!inSkillsSection && !hasExplicitSkillPrefix) {
    return false;
  }

  const trimmed = normalizedLine.trim();
  if (
    !inSkillsSection &&
    !trimmed.startsWith("-") &&
    !trimmed.startsWith("•") &&
    !hasExplicitSkillPrefix
  ) {
    return false;
  }

  if (
    inSkillsSection &&
    (/^=+/.test(trimmed) ||
      /^#?(?:section|entry|resume-entry|project-entry|skill-line|set|let|show|block|grid|v|h|text|line|align)\s*(?:\(|:|$)/i.test(
        trimmed
      ))
  ) {
    return false;
  }

  const cleanedSkillLine = trimmed
    .replace(/^[-•*#\s]+/, "")
    .replace(/^\*[^*]+:\*\s*/, "")
    .replace(/^\*[^*]+\*\s*:\s*/, "")
    .replace(
      /^(Languages|Frameworks(?:\s*&\s*Libraries)?|Developer\s+Tools|Tools(?:\s*&\s*Infrastructure)?|Databases|Libraries|Platforms|Core\s+Competencies|Technical\s+Skills|Skills)\s*:\s*/i,
      ""
    )
    .replace(/^[A-Za-z0-9\s&/+_-]{1,30}:\s*/, (match) => (inSkillsSection ? "" : match));

  const skillTokens = cleanedSkillLine
    .split(/[,;|•]/)
    .map((s) => s.replace(/[*_]/g, "").trim());

  let added = false;
  for (const tok of skillTokens) {
    if (
      tok.length > 1 &&
      tok.length < 35 &&
      !/^#?(?:section|entry|set|let|show|block|grid|v|h|text|line|align)\b/i.test(tok) &&
      !/\b(?:above|below|row-gutter|columns|breakable|sticky)\s+\d/i.test(tok)
    ) {
      const norm = normalizeSkillToken(tok);
      if (
        norm &&
        !norm.startsWith("section ") &&
        !norm.startsWith("block ") &&
        !norm.startsWith("grid ") &&
        !/\b(?:above|below)\s+\d/i.test(norm)
      ) {
        skillsSet.add(norm);
        added = true;
      }
    }
  }
  return added || hasExplicitSkillPrefix;
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
 * Extracts top-level bracket cells `[...]` inside a `#grid(...)` body.
 */
function extractGridBracketCells(gridBody: string): string[] {
  const cells: string[] = [];
  for (let i = 0; i < gridBody.length; i++) {
    if (gridBody[i] === "\\") {
      i++;
      continue;
    }
    if (gridBody[i] === "[") {
      const extracted = extractBalancedBrackets(gridBody, i);
      if (extracted) {
        const cleaned = cleanTypstInlineValue(extracted.content);
        cells.push(cleaned);
        i = extracted.endIdx;
      }
    }
  }
  return cells;
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
  const eduKeywords = /\b(university|college|institute|school|academy|bachelor|master|b\.?s\.?|m\.?s\.?|ph\.?d)\b/i;
  const titleKeywords =
    /\b(engineer|developer|designer|manager|lead|director|architect|intern|specialist|consultant|analyst|scientist|associate|officer|vp|founder|role|head|chief|administrator|coordinator|researcher|fellow|instructor|professor)\b/i;

  const recordExperienceEntry = (
    titleArg?: string,
    roleArg?: string,
    locationArg?: string,
    dateArg?: string
  ) => {
    let empRaw = titleArg?.trim();
    let roleRaw = roleArg?.trim();

    if (empRaw && !roleRaw) {
      const splitParts = empRaw
        .split(/\s*(?:—|–|--|\||(?:\s+@\s+)|(?:\s+at\s+))\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);
      if (splitParts.length >= 2) {
        if (titleKeywords.test(splitParts[0]) && !titleKeywords.test(splitParts[1])) {
          roleRaw = splitParts[0];
          empRaw = splitParts[1];
        } else {
          empRaw = splitParts[0];
          roleRaw = splitParts[1];
        }
      }
    } else if (empRaw && roleRaw && titleKeywords.test(empRaw) && !titleKeywords.test(roleRaw)) {
      const tmp = empRaw;
      empRaw = roleRaw;
      roleRaw = tmp;
    }

    let empNormalized: string | undefined;
    if (empRaw) {
      const normEmp = normalizeEmployer(empRaw);
      const aliases = extractEmployerAliases(empRaw);
      if (normEmp) {
        empNormalized = normEmp;
        if (!employersMap.has(normEmp)) {
          employersMap.set(normEmp, {
            raw: empRaw,
            normalized: normEmp,
            aliases,
            location: locationArg,
          });
        }
      }
    }

    if (roleRaw) {
      const normTitle = normalizeTitle(roleRaw);
      if (normTitle && !titlesMap.has(normTitle)) {
        titlesMap.set(normTitle, {
          raw: roleRaw,
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
  };

  // 0. If valid V2 managed resume metadata is present, extract structured blocks first
  const managed = parseManagedResume(rawSource);
  if (managed) {
    for (const sec of managed.document.sections) {
      const sectionKind = classifySectionTitle(sec.heading.text);
      const blocks = sec.blocks;
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.kind === "entry-title") {
          let roleText: string | undefined;
          let locText: string | undefined;
          let dateText: string | undefined;
          while (
            i + 1 < blocks.length &&
            ["entry-role", "entry-location", "entry-date"].includes(blocks[i + 1].kind)
          ) {
            const next = blocks[++i];
            if (next.kind === "entry-role" && !roleText) roleText = next.text;
            else if (next.kind === "entry-location" && !locText) locText = next.text;
            else if (next.kind === "entry-date" && !dateText) dateText = next.text;
          }
          const isLikelyEducation =
            sectionKind === "education" ||
            (sectionKind === "unknown" &&
              (eduKeywords.test(block.text) || Boolean(roleText && eduKeywords.test(roleText))));
          if (sectionKind === "experience" || (sectionKind === "unknown" && !isLikelyEducation)) {
            recordExperienceEntry(block.text, roleText, locText, dateText);
          }
        } else if (block.kind === "skill") {
          extractSkillsFromBulletLine(block.text, skillsSet, true);
        } else if (block.kind === "bullet" && sectionKind !== "education") {
          if (!extractSkillsFromBulletLine(block.text, skillsSet, sectionKind === "skills")) {
            metricsList.push(...extractMetricsFromText(stripInlineTypstMarkup(block.text)));
          }
        }
      }
    }
  }

  // 1. Strip comment lines and `#let ... = ...` definitions
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

  // 3b. Parse standalone V2 `#grid(...)` entry headers (outside `#entry` / `#let` definitions)
  const datePattern =
    /\b((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d\d(?:\s*[-–—]\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d\d|present|current|now))?)\b/i;

  for (const gridCall of findBalancedCalls(source, "grid")) {
    if (consumedRanges.some((r) => gridCall.start >= r.start && gridCall.end <= r.end)) {
      continue;
    }
    consumedRanges.push({ start: gridCall.start, end: gridCall.end });
    const sectionKind = getSectionAt(gridCall.start);
    if (sectionKind === "education" || sectionKind === "skills" || sectionKind === "projects") {
      continue;
    }
    const cells = extractGridBracketCells(gridCall.body).filter(Boolean);
    if (cells.length === 0) continue;

    let dateCell: string | undefined;
    for (let i = cells.length - 1; i >= 0; i--) {
      const dm = cells[i].match(datePattern);
      if (dm) {
        dateCell = dm[1];
        break;
      }
    }

    if (cells.length >= 3) {
      // Standard 2x2 grid: [title/company, location, role/subtitle, date]
      const c0 = cells[0];
      const c1 = cells[1];
      const c2 = cells[2];
      const isLikelyEdu = eduKeywords.test(c0) || eduKeywords.test(c2);
      if (!isLikelyEdu && (sectionKind === "experience" || sectionKind === "unknown")) {
        recordExperienceEntry(c0, c2, datePattern.test(c1) ? undefined : c1, dateCell);
      }
    } else if (cells.length === 2) {
      const c0 = cells[0];
      const c1 = cells[1];
      if (!eduKeywords.test(c0) && (sectionKind === "experience" || sectionKind === "unknown")) {
        recordExperienceEntry(c0, datePattern.test(c1) ? undefined : c1, undefined, dateCell);
      }
    } else if (cells.length === 1) {
      const c0 = cells[0];
      if (!eduKeywords.test(c0) && (sectionKind === "experience" || sectionKind === "unknown")) {
        recordExperienceEntry(c0, undefined, undefined, dateCell);
      }
    }
  }

  // 4. Parse `#resume-entry(title:, location:, date:)` and standalone lines outside `#entry(...)`
  const isOffsetConsumed = (offset: number): boolean =>
    consumedRanges.some((r) => offset >= r.start && offset <= r.end);

  const resumeEntryRegex =
    /#resume-entry\s*\(\s*title:\s*["']([^"']+)["'](?:,\s*location:\s*["']([^"']+)["'])?(?:,\s*date:\s*["']([^"']+)["'])?/gi;
  let lastResumeEntryDate: FactDateRange | undefined;
  let pendingBlockEmployer: string | undefined;

  let lineOffset = 0;
  const lines = source.split("\n");
  for (const line of lines) {
    const currentLineStart = lineOffset;
    lineOffset += line.length + 1;

    if (isOffsetConsumed(currentLineStart)) continue;
    const sectionKind = getSectionAt(currentLineStart);
    const rawTrimmed = line.trim();
    if (!rawTrimmed) continue;
    const trimmed = unwrapTypstLineForExtraction(rawTrimmed);
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
    const boldPairs = !isExplicitSkillBullet ? trimmed.match(/\*([^*]+)\*/g) : null;

    if (boldPairs && boldPairs.length >= 2 && sectionKind !== "skills" && sectionKind !== "education") {
      const part1 = boldPairs[0].replace(/\*/g, "").trim();
      const part2 = boldPairs[1].replace(/\*/g, "").trim();

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
      const remainder = trimmed.replace(/\*[^*]+\*/g, " ");
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

    // Check single-bold `*Role* — Company`, `=== Role — Company`, or V2 `#block(...)[...]` experience lines
    const isSubheadingLine = /^===+\s+/.test(trimmed);
    const isV2BlockLine = /^#block\s*\(/i.test(rawTrimmed);
    if (
      !isExplicitSkillBullet &&
      !trimmed.startsWith("-") &&
      !trimmed.startsWith("•") &&
      ((boldPairs && boldPairs.length === 1) || isSubheadingLine || (sectionKind === "experience" && isV2BlockLine)) &&
      (sectionKind === "experience" ||
        (sectionKind === "unknown" && titleKeywords.test(trimmed) && !eduKeywords.test(trimmed)))
    ) {
      const inlineDateMatch = trimmed.match(
        /\b((?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d\d\s*[-–—]\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d\d|present|current|now))\b/i
      );
      const withoutDate = trimmed
        .replace(/^===+\s*/, "")
        .replace(
          /\s*(?:\(\s*)?\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d\d\s*[-–—]\s*(?:(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+)?(?:19|20)\d\d|present|current|now)\b(?:\s*\))?/gi,
          ""
        )
        .replace(/[\s|—–-]+$/, "")
        .trim();

      const segments = withoutDate
        .replace(/[*_]/g, "")
        .split(/\s*(?:—|–|--|\||(?:\s+-\s+)|(?:\s+@\s+)|(?:\s+at\s+))\s*/i)
        .map((s) => s.trim())
        .filter(Boolean);

      if (segments.length >= 2) {
        const part1 = segments[0];
        const part2 = segments[1];
        const leadingBold = /^\s*\*[^*]+\*/.test(withoutDate);

        let titleRaw = leadingBold ? part1 : part2;
        let empRaw = leadingBold ? part2 : part1;

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
        if (inlineDateMatch) {
          const parsed = parseDateRange(inlineDateMatch[1], normEmp || undefined);
          const dateKey = `${normEmp || ""}:${parsed.raw}`;
          if (parsed.raw && !dateRangesMap.has(dateKey)) {
            dateRangesMap.set(dateKey, parsed);
          }
        }
        pendingBlockEmployer = normEmp || undefined;
        continue;
      } else if (segments.length === 1 && sectionKind === "experience" && isV2BlockLine) {
        const single = segments[0];
        if (titleKeywords.test(single) && !eduKeywords.test(single)) {
          const normTitle = normalizeTitle(single);
          if (normTitle && !titlesMap.has(normTitle)) {
            titlesMap.set(normTitle, {
              raw: single,
              normalized: normTitle,
              employerNormalized: pendingBlockEmployer,
            });
          }
          if (inlineDateMatch) {
            const parsed = parseDateRange(inlineDateMatch[1], pendingBlockEmployer);
            const dateKey = `${pendingBlockEmployer || ""}:${parsed.raw}`;
            if (parsed.raw && !dateRangesMap.has(dateKey)) {
              dateRangesMap.set(dateKey, parsed);
            }
          }
        } else if (!eduKeywords.test(single)) {
          const normEmp = normalizeEmployer(single);
          if (normEmp) {
            pendingBlockEmployer = normEmp;
            if (!employersMap.has(normEmp)) {
              employersMap.set(normEmp, {
                raw: single,
                normalized: normEmp,
                aliases: extractEmployerAliases(single),
              });
            }
          }
          if (inlineDateMatch) {
            const parsed = parseDateRange(inlineDateMatch[1], normEmp || undefined);
            const dateKey = `${normEmp || ""}:${parsed.raw}`;
            if (parsed.raw && !dateRangesMap.has(dateKey)) {
              dateRangesMap.set(dateKey, parsed);
            }
          }
        }
        continue;
      }
    }

    // Standalone bullet lines or plain skill lines under `== Skills`
    if (sectionKind === "skills" && !/^=+/.test(trimmed)) {
      extractSkillsFromBulletLine(trimmed, skillsSet, true);
    } else if (trimmed.startsWith("-") || trimmed.startsWith("•") || isExplicitSkillBullet) {
      if (sectionKind !== "education") {
        if (!extractSkillsFromBulletLine(trimmed, skillsSet, false)) {
          const cleanBullet = stripInlineTypstMarkup(trimmed);
          metricsList.push(...extractMetricsFromText(cleanBullet));
        }
      }
    }
  }
}
