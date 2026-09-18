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
 * Normalizes job title strings.
 */
export function normalizeTitle(raw: string): string {
  return normalizeString(raw);
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
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Parses date string (e.g. "May 2022 - Aug 2023", "2021 - Present", "05/2020 - 12/2021") into FactDateRange.
 */
export function parseDateRange(raw: string): FactDateRange {
  const trimmed = raw.trim();
  const isCurrent = /\b(present|current|now)\b/i.test(trimmed);

  const parts = trimmed.split(/[-–—]|(?:\s+to\s+)/i).map((s) => s.trim());
  let startIso: string | undefined;
  let endIso: string | undefined;

  if (parts.length >= 1) {
    startIso = parseDatePart(parts[0]);
  }
  if (parts.length >= 2) {
    if (!isCurrent) {
      endIso = parseDatePart(parts[1]);
    }
  }

  return {
    raw: trimmed,
    startIso,
    endIso,
    isCurrent,
  };
}

function parseDatePart(part: string): string | undefined {
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

  // Pattern: "2023"
  const yearMatch = p.match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    return `${yearMatch[1]}-01`;
  }

  return undefined;
}

/**
 * Extracts quantitative metrics (numbers, %, $, time, scaling factors) from text.
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
    let suffix = raw.replace(/[0-9.,\s\$€£]/g, "").trim();

    let unit = suffix;
    if (isCurrency) {
      unit = suffix ? `$${suffix.toUpperCase()}` : "$";
    }

    const nonTrivialUnits = /^(%|[\$€£].*|x|ms|s|min|hr|hrs|qps|rps|tps|gb|tb|mb)$/i;
    const isTrivial = value >= 0 && value <= 10 && Number.isInteger(value) && !nonTrivialUnits.test(unit.trim());

    // Extract surrounding sentence context
    const startIdx = Math.max(0, (match.index || 0) - 20);
    const endIdx = Math.min(text.length, (match.index || 0) + raw.length + 20);
    const context = text.slice(startIdx, endIdx).trim();

    metrics.push({
      raw,
      value,
      unit,
      context,
      isTrivial,
    });
  }

  return metrics;
}
