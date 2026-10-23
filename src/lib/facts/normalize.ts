import { FactDateRange, FactMetric } from "./types";

/**
 * Strips accents, lowercases, collapses whitespace, and trims.
 */
export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalizes employer names for deterministic matching.
 * Strips common legal suffixes and cleans punctuation.
 */
export function normalizeEmployer(raw: string): string {
  const base = normalizeString(raw).replace(/\./g, "");
  return base
    .replace(/\b(inc|incorporated|llc|corp|corporation|ltd|limited|co|company|technologies|tech|labs|group)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts normalized employer aliases (e.g., parenthetical acronyms or slash-separated names).
 */
export function extractEmployerAliases(raw: string): string[] {
  const aliases = new Set<string>();
  const primary = normalizeEmployer(raw);
  if (primary) aliases.add(primary);

  const parenMatch = raw.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = normalizeEmployer(parenMatch[1]);
    if (inside) aliases.add(inside);
    const outside = normalizeEmployer(raw.replace(/\([^)]*\)/g, ""));
    if (outside) aliases.add(outside);
  }

  return Array.from(aliases);
}

/**
 * Normalizes job title strings.
 */
export function normalizeTitle(raw: string): string {
  return normalizeString(raw);
}

export const LEVEL_MARKERS = new Set([
  "intern",
  "internship",
  "coop",
  "junior",
  "associate",
  "trainee",
  "apprentice",
]);

export const SENIORITY_TOKENS = new Set([
  "senior",
  "staff",
  "principal",
  "lead",
  "director",
  "vp",
  "president",
  "head",
  "chief",
  "architect",
  "manager",
  "distinguished",
  "fellow",
  "ii",
  "iii",
  "iv",
  "v",
]);

/**
 * Tokenizes a title into canonical word tokens (normalizing co-op -> coop, sr -> senior, jr -> junior).
 */
export function tokenizeTitle(rawOrNormalized: string): string[] {
  const canonical = normalizeTitle(rawOrNormalized)
    .replace(/\bco-op\b/g, "coop")
    .replace(/\bsr\b/g, "senior")
    .replace(/\bjr\b/g, "junior")
    .replace(/[-./]/g, " ");
  return canonical
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Checks whether a candidate title is a valid non-inflated subset of a master title:
 * 1. Candidate tokens must be a subset of master tokens (nothing added, preventing seniority or scope inflation).
 * 2. Level markers (intern, co-op, junior, associate) present in master cannot be dropped in candidate.
 */
export function isCandidateTitleAllowedByMaster(
  candidateTitle: string,
  masterTitle: string
): { allowed: boolean; reason?: "added_seniority" | "dropped_level_marker" | "added_tokens" } {
  const candTokens = tokenizeTitle(candidateTitle);
  const masterTokens = tokenizeTitle(masterTitle);
  if (candTokens.length === 0 || masterTokens.length === 0) {
    return { allowed: false, reason: "added_tokens" };
  }

  const masterSet = new Set(masterTokens);
  const candSet = new Set(candTokens);

  // Check for added seniority tokens first for specific error messaging
  for (const tok of candTokens) {
    if (!masterSet.has(tok) && SENIORITY_TOKENS.has(tok)) {
      return { allowed: false, reason: "added_seniority" };
    }
  }

  // Every candidate token must exist in master tokens
  for (const tok of candTokens) {
    if (!masterSet.has(tok)) {
      return { allowed: false, reason: "added_tokens" };
    }
  }

  // Level markers present in master cannot be dropped
  for (const tok of masterTokens) {
    if (LEVEL_MARKERS.has(tok) && !candSet.has(tok)) {
      return { allowed: false, reason: "dropped_level_marker" };
    }
  }

  return { allowed: true };
}

/**
 * Canonicalizes skill keywords and aliases.
 */
export function normalizeSkillToken(raw: string): string {
  const clean = raw.trim().toLowerCase();
  const map: Record<string, string> = {
    "c++": "cpp",
    "c#": "csharp",
    "node.js": "nodejs",
    node: "nodejs",
    "react.js": "react",
    reactjs: "react",
    "vue.js": "vue",
    vuejs: "vue",
    "next.js": "nextjs",
    nextjs: "nextjs",
    postgres: "postgresql",
    "postgres sql": "postgresql",
    golang: "go",
    k8s: "kubernetes",
    "amazon web services": "aws",
    "google cloud platform": "gcp",
    "google cloud": "gcp",
    typescript: "typescript",
    ts: "typescript",
    javascript: "javascript",
    js: "javascript",
    python3: "python",
  };
  return map[clean] || normalizeString(clean);
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Parses date string (e.g. "May 2022 - Aug 2023", "Jun 2024 – Present", "05/2020 - 12/2021") into FactDateRange.
 * Normalizes en-dash, em-dash, "Present", and "Current".
 */
export function parseDateRange(raw: string, employerNormalized?: string): FactDateRange {
  const normalizedRaw = raw
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\b(current|now)\b/gi, "Present")
    .replace(/\s+/g, " ")
    .trim();
  const isCurrent = /\bpresent\b/i.test(normalizedRaw);

  const parts = normalizedRaw.split(/[-]|(?:\s+to\s+)/i).map((s) => s.trim()).filter(Boolean);
  let startIso: string | undefined;
  let endIso: string | undefined;

  if (parts.length >= 1) {
    startIso = parseDatePart(parts[0], "start");
  }
  if (parts.length >= 2) {
    if (!isCurrent) {
      endIso = parseDatePart(parts[1], "end");
    }
  } else if (parts.length === 1 && startIso && !isCurrent) {
    // Single year or month-year (e.g. "Graduated May 2025" or "2024")
    endIso = parseDatePart(parts[0], "end");
  }

  return {
    raw: raw.trim(),
    startIso,
    endIso,
    isCurrent,
    employerNormalized,
  };
}

function parseDatePart(part: string, bound: "start" | "end"): string | undefined {
  if (!part) return undefined;
  const p = part.trim().toLowerCase();

  // Pattern: "May 2023" or "May, 2023"
  const wordYearMatch = p.match(/([a-z]+)[,\s]+(\d{4})/i);
  if (wordYearMatch) {
    const monthName = wordYearMatch[1];
    const year = wordYearMatch[2];
    const monthNum = MONTH_MAP[monthName];
    if (monthNum) {
      return `${year}-${String(monthNum).padStart(2, "0")}`;
    }
  }

  // Pattern: "05/2023" or "05-2023"
  const numYearMatch = p.match(/(\d{1,2})[\/\-](\d{4})/);
  if (numYearMatch) {
    const month = String(parseInt(numYearMatch[1], 10)).padStart(2, "0");
    const year = numYearMatch[2];
    return `${year}-${month}`;
  }

  // Pattern: "2023" (year-only defaults to 01 for start, 12 for end so months within that year are contained)
  const yearMatch = p.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-${bound === "end" ? "12" : "01"}`;
  }

  return undefined;
}

/**
 * Checks whether a candidate date range is contained within a master date range.
 * Candidate range can narrow (start >= master.start, end <= master.end), never widen or shift.
 * Extending "Present" beyond a master with a bounded end date is forbidden.
 */
export function isDateRangeContained(cand: FactDateRange, master: FactDateRange): boolean {
  if (!cand.startIso || !master.startIso) return false;

  // Candidate cannot start earlier than master
  if (cand.startIso < master.startIso) {
    // Allow year-only candidate start (YYYY-01) when it matches master's start year and candidate has no explicit month
    const candHasExplicitMonth = /[a-z]{3,}|\d{1,2}[\/\-]\d{4}/i.test(cand.raw.split(/[-–—]|to/i)[0] || "");
    const sameStartYear = cand.startIso.slice(0, 4) === master.startIso.slice(0, 4);
    if (!(!candHasExplicitMonth && sameStartYear)) {
      return false;
    }
  }

  // If candidate claims ongoing ("Present"), master must also be ongoing ("Present")
  if (cand.isCurrent) {
    return Boolean(master.isCurrent);
  }

  // If master is ongoing ("Present"), any candidate endIso >= candidate startIso is contained
  if (master.isCurrent) {
    return !cand.endIso || cand.endIso >= cand.startIso;
  }

  // Both have bounded end dates: candidate cannot end after master
  if (!master.endIso) return false;
  if (!cand.endIso) return false;

  if (cand.endIso > master.endIso) {
    const parts = cand.raw.split(/[-–—]|to/i);
    const endPart = parts[1] || parts[0] || "";
    const candEndHasExplicitMonth = /[a-z]{3,}|\d{1,2}[\/\-]\d{4}/i.test(endPart);
    const sameEndYear = cand.endIso.slice(0, 4) === master.endIso.slice(0, 4);
    if (!(!candEndHasExplicitMonth && sameEndYear)) {
      return false;
    }
  }

  return true;
}

const SUBJECT_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "by",
  "from",
  "across",
  "over",
  "under",
  "within",
  "through",
  "into",
  "during",
  "while",
  "and",
  "or",
  "but",
  "as",
  "than",
  "that",
  "which",
  "who",
  "when",
  "where",
  "reducing",
  "increasing",
  "improving",
  "achieving",
  "resulting",
  "saving",
  "cutting",
  "boosting",
  "serving",
  "handling",
  "processing",
  "supporting",
  "generating",
  "delivering",
  "maintaining",
  "per",
]);

const SUBJECT_MODIFIERS = new Set([
  "daily",
  "monthly",
  "weekly",
  "annual",
  "yearly",
  "hourly",
  "active",
  "concurrent",
  "total",
  "global",
  "new",
  "unique",
  "registered",
  "paid",
  "enterprise",
  "production",
  "internal",
  "external",
  "initial",
  "average",
  "avg",
  "peak",
  "max",
  "min",
  "p95",
  "p99",
  "api",
  "web",
  "mobile",
  "cloud",
  "code",
  "page",
  "load",
  "response",
  "dashboard",
]);

/**
 * Simple deterministic English singularizer for metric subject nouns.
 */
export function singularizeSubject(word: string): string {
  const w = word.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  if (!w) return "";
  if (w.endsWith("ies") && w.length > 4) {
    return `${w.slice(0, -3)}y`;
  }
  if (
    w.endsWith("ses") ||
    w.endsWith("xes") ||
    w.endsWith("zes") ||
    w.endsWith("ches") ||
    w.endsWith("shes")
  ) {
    return w.slice(0, -2);
  }
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is") && w.length > 3) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Extracts a normalized singularized trailing noun subject immediately following a metric.
 * Handles rates like "10M requests/day" -> "request".
 * Returns undefined when no noun phrase immediately follows the metric (e.g. "reduced latency by 40%").
 */
export function extractTrailingSubject(afterText: string): string | undefined {
  if (!afterText) return undefined;

  // Strip leading rate slash if directly attached to unit, or keep noun before /day
  const cleaned = afterText
    .replace(/^\s*\/(?:day|sec|s|hr|hour|min|mo|month|yr|year|wk|week)\b/i, " ")
    .trim();

  if (!cleaned) return undefined;
  // Stop at sentence/clause punctuation
  const firstClause = cleaned.split(/[.,;:()\[\]|—–-]/)[0]?.trim() || "";
  if (!firstClause) return undefined;

  const rawWords = firstClause
    .split(/\s+/)
    .map((w) => w.replace(/\/(?:day|sec|s|hr|hour|min|mo|month|yr|year|wk|week)$/i, ""))
    .map((w) => w.replace(/[^a-zA-Z]/g, "").toLowerCase())
    .filter(Boolean);

  if (rawWords.length === 0) return undefined;

  // If the first word after the metric is a stopword/preposition/conjunction, there is no trailing subject
  if (SUBJECT_STOPWORDS.has(rawWords[0])) {
    return undefined;
  }

  // Skip up to 2 adjective modifiers to reach the head noun
  let idx = 0;
  while (idx < rawWords.length - 1 && idx < 2 && SUBJECT_MODIFIERS.has(rawWords[idx])) {
    if (SUBJECT_STOPWORDS.has(rawWords[idx + 1])) break;
    idx++;
  }

  const candidateNoun = rawWords[idx];
  if (!candidateNoun || SUBJECT_STOPWORDS.has(candidateNoun) || candidateNoun.length < 2) {
    return undefined;
  }

  return singularizeSubject(candidateNoun);
}

/**
 * Resolves the canonical singularized subject for a FactMetric, supporting both extracted `subject`
 * and pre-constructed test fixtures where `context` holds a short subject label.
 */
export function resolveMetricSubject(metric: FactMetric): string | undefined {
  if (metric.subject) return singularizeSubject(metric.subject);

  if (metric.unit && /^(users|engineers)$/i.test(metric.unit)) {
    return singularizeSubject(metric.unit);
  }

  const ctx = (metric.context || "").trim();
  if (!ctx) return undefined;

  const rawIdx = ctx.toLowerCase().indexOf(metric.raw.toLowerCase());
  if (rawIdx >= 0) {
    const after = ctx.slice(rawIdx + metric.raw.length);
    return extractTrailingSubject(after);
  }

  // Short fixture context (e.g. context: "requests")
  const words = ctx.split(/\s+/).filter(Boolean);
  if (words.length === 1 && /^[a-zA-Z]+$/.test(words[0])) {
    return singularizeSubject(words[0]);
  }

  return undefined;
}

/**
 * Extracts quantitative metrics (numbers, %, $, time, scaling factors) from rendered text.
 * Integers between 0 and 10 without units are classified as trivial (not inflating claims).
 */
export function extractMetricsFromText(text: string): FactMetric[] {
  const metrics: FactMetric[] = [];
  if (!text) return metrics;

  // Regex with longer units prioritized in alternation
  const metricRegex = /(?:[\$€£]\s*)?\b\d+(?:,\d{3})*(?:\.\d+)?\s*(?:engineers|users|req\/s|sec|min|hrs|ms|qps|rps|tps|gb|tb|mb|hr|k|m|b|s|x|%|[\$€£])?\+?/gi;

  const matches = text.matchAll(metricRegex);

  for (const match of matches) {
    const raw = match[0].trim();
    if (!raw || /^(19\d\d|20\d\d)$/.test(raw)) {
      // Exclude standalone 4-digit years (e.g. 2023)
      continue;
    }

    const cleanNumStr = raw.replace(/[^0-9.]/g, "");
    if (!cleanNumStr) continue;
    const value = parseFloat(cleanNumStr);
    if (Number.isNaN(value)) continue;

    const isCurrency = /[\$€£]/.test(raw);
    const suffix = raw.replace(/[0-9.,\s\$€£+]/g, "").trim();

    let unit = suffix;
    if (isCurrency) {
      unit = suffix ? `$${suffix.toUpperCase()}` : "$";
    }

    const nonTrivialUnits = /^(%|[\$€£].*|x|k|m|b|ms|s|sec|min|hr|hrs|qps|rps|tps|req\/s|gb|tb|mb)$/i;
    const isTrivial = value >= 0 && value <= 10 && Number.isInteger(value) && !nonTrivialUnits.test(unit.trim());

    const matchStart = match.index || 0;
    const matchEnd = matchStart + match[0].length;

    // Extract surrounding sentence context
    const startIdx = Math.max(0, matchStart - 20);
    const endIdx = Math.min(text.length, matchEnd + 25);
    const context = text.slice(startIdx, endIdx).trim();

    // Extract trailing subject noun
    const afterSlice = text.slice(matchEnd, matchEnd + 45);
    const subject =
      /^(users|engineers)$/i.test(unit)
        ? singularizeSubject(unit)
        : extractTrailingSubject(afterSlice);

    metrics.push({
      raw,
      value,
      unit,
      context,
      subject,
      isTrivial,
    });
  }

  return metrics;
}
