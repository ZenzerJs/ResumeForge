/**
 * Server and Client compatible helper utilities for job ingestion,
 * apply URL extraction, and Tier 1 placeholder detection.
 */

export function isPlaceholderDescription(rawDescription?: string | null): boolean {
  if (!rawDescription || !rawDescription.trim()) return true;
  const lower = rawDescription.toLowerCase().trim();
  if (
    rawDescription.startsWith("[Pending Import]") ||
    lower.includes("tier 1 bulk import") ||
    lower.includes("full job description not yet imported") ||
    lower.includes("apply at company site") ||
    lower.includes("view full details on company site")
  ) {
    return true;
  }

  // Detect empty Jina Reader proxy shell (Title:... URL Source:... Markdown Content:)
  if (/^#?[^\n]*\n*Title:[\s\S]*?Markdown Content:\s*$/i.test(rawDescription.trim())) {
    return true;
  }
  const withoutJina = rawDescription.replace(/^#?[^\n]*\n*Title:[\s\S]*?Markdown Content:\s*/i, "").trim();
  if (rawDescription.includes("Markdown Content:") && withoutJina.length < 60) {
    return true;
  }

  return false;
}

export function extractApplyUrlFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const match = notes.match(/Apply Link:\s*(https?:\/\/[^\s|]+)/i);
  return match ? match[1].trim() : "";
}

export function normalizeLocation(rawLocation?: string | null): string {
  if (!rawLocation || !rawLocation.trim()) return "";

  let loc = rawLocation.trim();

  // Strip leading "N locations" or "N Locations:" (e.g. "5 locationsAustin...")
  loc = loc.replace(/^\d+\s+locations?[:\s]*/i, "").trim();

  // Replace HTML tags (<br>, </p>, </li>, </div>) and bullets with semicolon
  loc = loc.replace(/<br\s*\/?>/gi, "; ");
  loc = loc.replace(/<\/(?:p|li|div|tr)>/gi, "; ");
  loc = loc.replace(/<[^>]+>/g, " ");
  loc = loc.replace(/[•·|\r\n]+/g, "; ");

  // Fix concatenated boundaries:
  // 1. State/province code (2 uppercase letters) directly followed by Uppercase+lowercase or abbreviations (e.g. "CANew York" -> "CA; New York", "WALA" -> "WA; LA")
  loc = loc.replace(/(,\s*[A-Z]{2})(?=[A-Z][a-z]|LA|SF|NYC)/g, "$1; ");

  // 2. Country / generic locations followed by Uppercase+lowercase (e.g. "UKCambridge", "CanadaVancouver", "RemoteNew York")
  loc = loc.replace(/(,\s*(?:USA|Canada|UK|Remote))(?=[A-Z][a-z])/gi, "$1; ");
  loc = loc.replace(/\b(USA|Canada|UK|Remote)(?=[A-Z][a-z])/gi, "$1; ");

  // 3. Common city abbreviations followed by city or preceded by lowercase (e.g. "SFBellevue", "LALos Gatos", "WashingtonLA")
  loc = loc.replace(/(LA|SF|NYC)(?=[A-Z][a-z])/g, "$1; ");
  loc = loc.replace(/([a-z])(?=LA|SF|NYC)/g, "$1; ");

  // Normalize whitespace around semicolons
  loc = loc.replace(/\s*;\s*/g, "; ").trim();
  loc = loc.replace(/;+/g, ";");
  loc = loc.replace(/^;\s*|\s*;$/g, "");

  // If already formatted like "... (+N more)", don't re-collapse
  if (/\(\+\d+\s+more\)$/i.test(loc)) {
    return loc;
  }

  // Split into individual locations, clean and deduplicate
  const parts = loc
    .split(";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^\d+\s+locations?$/i.test(p));

  // Deduplicate while preserving order (case-insensitive)
  const seen = new Set<string>();
  const uniqueParts: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      uniqueParts.push(part);
    }
  }

  if (uniqueParts.length === 0) return "";
  if (uniqueParts.length === 1) return uniqueParts[0];
  if (uniqueParts.length === 2) return `${uniqueParts[0]}; ${uniqueParts[1]}`;

  const moreCount = uniqueParts.length - 2;
  return `${uniqueParts[0]}; ${uniqueParts[1]} (+${moreCount} more)`;
}

export function extractLocationFromNotes(notes?: string | null): string {
  if (!notes) return "";

  const segments = notes.split("|").map((s) => s.trim()).filter(Boolean);
  const locIdx = segments.findIndex((s) => /^location:\s*/i.test(s));

  if (locIdx === -1) {
    const match = notes.match(/Location:\s*([^|]+)/i);
    return match ? normalizeLocation(match[1]) : "";
  }

  const rawLocationParts: string[] = [segments[locIdx].replace(/^location:\s*/i, "").trim()];

  // Look ahead for continuation segments across pipes
  const knownFieldHeader = /^(?:Apply(?:\s*Link)?|Date\s*Posted|Posted|Salary|Tier\s*\d+|Workplace|Status|Source|Company|Role)\s*:/i;
  for (let i = locIdx + 1; i < segments.length; i++) {
    const seg = segments[i];
    if (
      knownFieldHeader.test(seg) ||
      seg.toLowerCase().includes("tier 2 fetched") ||
      seg.toLowerCase().includes("tier 1 bulk import")
    ) {
      break;
    }
    rawLocationParts.push(seg);
  }

  return normalizeLocation(rawLocationParts.join("; "));
}

export type WorkplaceFilter = "all" | "remote" | "hybrid" | "onsite";

export function isWorkplaceFilter(value: string | null | undefined): value is WorkplaceFilter {
  return value === "all" || value === "remote" || value === "hybrid" || value === "onsite";
}

export function matchesWorkplaceFilter(
  notes: string | null | undefined,
  workplace: WorkplaceFilter,
): boolean {
  if (workplace === "all") return true;
  const loc = extractLocationFromNotes(notes).toLowerCase();
  const hay = `${loc} ${(notes ?? "").toLowerCase()}`;
  const remote = /\bremote\b/.test(hay);
  const hybrid = /\bhybrid\b/.test(hay);
  if (workplace === "remote") return remote;
  if (workplace === "hybrid") return hybrid;
  return !remote && !hybrid && loc.length > 0;
}

export function extractPostingDateFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const match = notes.match(/(?:Date )?Posted:\s*([^|]+)/i);
  return match ? match[1].trim() : "";
}

export function extractSalaryFromNotes(notes?: string | null, rawDescription?: string | null): string | null {
  if (notes) {
    const match = notes.match(/Salary:\s*([^|]+)/i);
    if (match && match[1].trim() && match[1].trim().toLowerCase() !== "no salary listed") {
      return match[1].trim();
    }
  }

  const textToScan = [notes, rawDescription]
    .filter(Boolean)
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&(?:mdash|ndash);|&#821[12];/gi, " - ");
  if (!textToScan) return null;

  // 1. Explicit hourly rates with /hr or per hour: e.g. "$42.00 to $55.00 per hour", "$35 - 48/hr", "$45.00/hr", "CA$42/hr", "$20.00 - 23.00 Hourly", "$45/hr - $65/hr"
  const hourlyExplicitRegex = /(?:(CA\$|C\$|US\$|USD|\$)\s*)(\d+(?:\.\d{1,2})?)\s*(?:\/(?:hr|hour|h)\s*)?(?:(?:\s*[-–—]\s*|\s+(?:to|through)\s+)(?:(CA\$|C\$|US\$|USD|\$)\s*)?(\d+(?:\.\d{1,2})?))?\s*(?:(CAD|USD)\s*)?(?:\/|\s*(?:per|an|p\/)\s*|\s+)(?:hr|hour|hours|hourly|h)\b/i;
  const hourlyMatch = textToScan.match(hourlyExplicitRegex);
  if (hourlyMatch) {
    const p1 = hourlyMatch[1] || "$";
    const min = hourlyMatch[2];
    const max = hourlyMatch[4];
    const numMin = Number(min);
    if (numMin >= 10 && numMin <= 250) {
      const currency = p1.toUpperCase().includes("CA") ? "CA$" : "$";
      if (max && max !== min && Number(max) <= 250) {
        return `${currency}${min}-${currency !== "$" ? currency : "$"}${max}/hr`;
      }
      return `${currency}${min}/hr`;
    }
  }

  // 1b. Labeled hourly rates with intervening words:
  // e.g., "Hourly compensation for applicant is: $50.00", "The hourly rate for our interns is 38 USD - 94 USD", "hourly rate for this position is between $19.32 - $25.30"
  const labeledHourlyRegex = /(?:hourly\s+(?:rate|pay|wage|compensation)|hourly\s+compensation\s+for\s+[^:\n]{1,40}|rate\s+for\s+(?:this\s+position|our\s+interns|this\s+role)|intern\s+(?:pay|rate|wage|compensation)|base\s+hourly(?:\s+rate|\s+pay)?)[^$\d\n]{0,60}(?:(CA\$|C\$|US\$|USD|\$)\s*)(\d+(?:\.\d{1,2})?)(?![kK])(?:\s*(?:USD|CAD))?(?:\s*(?:[-–—]|to|through)\s*(?:(CA\$|C\$|US\$|USD|\$)\s*)?(\d+(?:\.\d{1,2})?)(?![kK])(?:\s*(?:USD|CAD))?)?/i;
  const labeledHourly = textToScan.match(labeledHourlyRegex);
  if (labeledHourly) {
    const numMin = Number(labeledHourly[2]);
    const numMax = labeledHourly[4] ? Number(labeledHourly[4]) : null;
    if (numMin >= 10 && numMin <= 250) {
      const min = labeledHourly[2];
      const max = labeledHourly[4];
      const p = labeledHourly[1] || "$";
      const currency = p.toUpperCase().includes("CA") ? "CA$" : "$";
      if (max && max !== min && numMax !== null && numMax <= 250) {
        return `${currency}${min}-${currency !== "$" ? currency : "$"}${max}/hr`;
      }
      return `${currency}${min}/hr`;
    }
  }

  // 2. Monthly / Weekly / Bi-weekly ranges / stipends: e.g., "$6,500 - $8,000/month", "$3,000 - $4,000 bi-weekly", "$2,000/week"
  const monthlyRegex = /(?:(CA\$|C\$|US\$|USD|\$)\s*)?(\d{1,3}(?:,\d{3})+|\d{4,5}|\d{1,2}\s*k)\s*(?:(?:\s*[-–—]\s*|\s+(?:to|through)\s+)(?:(CA\$|C\$|US\$|USD|\$)\s*)?(\d{1,3}(?:,\d{3})+|\d{4,5}|\d{1,2}\s*k))?\s*(?:(CAD|USD)\s*)?(?:\/|\s*(?:per|a)\s*)(mo|month|bi-weekly|biweekly|wk|week)\b/i;
  const monthlyMatch = textToScan.match(monthlyRegex);
  if (monthlyMatch) {
    const p = monthlyMatch[1] || "$";
    const currency = p.toUpperCase().includes("CA") ? "CA$" : "$";
    const min = formatSalaryFigure(monthlyMatch[2], currency);
    const max = monthlyMatch[4] ? formatSalaryFigure(monthlyMatch[4], currency) : null;
    const unit = monthlyMatch[6].toLowerCase();
    const period = unit.includes("bi") ? "/bi-weekly" : unit.includes("w") ? "/week" : "/month";
    return max && max !== min ? `${min}-${max}${period}` : `${min}${period}`;
  }

  // 3. Labeled annual or hourly ranges: e.g., "base salary: $110,000 to $145,000", "Salary Range: $16.48 - $28.84", "Expected Salary Range: $20.00 - $40.00"
  const amountPattern = "(\\d{2,3}\\s*k|\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?)";
  const currPrefix = "(CA\\$|C\\$|US\\$|USD\\s*|\\$)";
  const currSuffix = "(?:\\s*(CAD|USD))";

  const labeledGeneralRegex = new RegExp(
    `(?:base\\s+salary|salary(?:\\s+range)?|compensation(?:\\s+range)?|pay(?:\\s+range)?|hiring\\s+range|target\\s+pay(?:\\s+range)?)\\s*(?:for\\s+this\\s+role\\s*|in\\s+[^:\n]{1,30})?(?:is|between|:|-|–|—|\\*|\\s)*` +
    `(?:${currPrefix}\\s*)?${amountPattern}\\s*` +
    `(?:${currSuffix})?\\s*` +
    `(?:(?:[-–—]|\\bto\\b|\\bthrough\\b)\\s*(?:${currPrefix}\\s*)?${amountPattern}\\s*(?:${currSuffix})?)?`,
    "i"
  );

  const labeled = textToScan.match(labeledGeneralRegex);
  if (labeled) {
    const rawP1 = labeled[1]?.trim() || "";
    const rawVal1 = labeled[2];
    const s1 = labeled[3]?.trim() || "";
    const rawP2 = labeled[4]?.trim() || "";
    const rawVal2 = labeled[5];
    const s2 = labeled[6]?.trim() || "";

    const isCAD = /CA\$|C\$|CAD/i.test(`${rawP1} ${s1} ${rawP2} ${s2}`);
    let pref = "$";
    if (/CA\$/i.test(rawP1) || /CA\$/i.test(rawP2)) pref = "CA$";
    else if (/C\$/i.test(rawP1) || /C\$/i.test(rawP2)) pref = "C$";
    const suff = isCAD && pref === "$" ? " CAD" : "";

    const isHourlyDecimals = rawVal1.includes(".") || (rawVal2 && rawVal2.includes("."));
    const num1 = Number(rawVal1.replace(/[,\s]/g, "").replace(/k$/i, "000"));
    const num2 = rawVal2 ? Number(rawVal2.replace(/[,\s]/g, "").replace(/k$/i, "000")) : null;

    // If it's an intern/hourly figure with decimals or explicit low range e.g. $16.48 - $28.84, $20.00 - $40.00
    if (num1 >= 10 && num1 <= 250 && (!num2 || num2 <= 250) && (isHourlyDecimals || /\b(?:hourly|per\s+hour)\b/i.test(textToScan))) {
      const min = `${pref}${rawVal1}`;
      const max = rawVal2 ? `${pref}${rawVal2}` : null;
      return max && max !== min ? `${min}-${max}${suff}/hr` : `${min}${suff}/hr`;
    }

    if (num1 >= 1000 && num1 < 2000000) {
      const min = formatSalaryFigure(rawVal1, pref);
      const max = rawVal2 ? formatSalaryFigure(rawVal2, pref) : null;
      if (max && max !== min) {
        return `${min}-${max}${suff}`;
      }
      return `${min}${suff}`;
    }
  }

  // 4. Currency-prefixed ranges in text: e.g. "CA$95K–CA$115K", "C$85,000 - C$105,000", "USD 120,000 - 160,000", "$120,000 - 160,000"
  const annualAmountPattern = "(\\d{2,3}\\s*k|\\d{1,3}(?:,\\d{3})+|\\d{4,7})";
  const currencyRangeRegex = new RegExp(
    `(?:(CA\\$|C\\$|US\\$|USD\\s*|\\$)\\s*)${annualAmountPattern}\\s*` +
    `(?:${currSuffix})?\\s*` +
    `(?:(?:[-–—]|\\bto\\b|\\bthrough\\b)\\s*(?:${currPrefix}\\s*)?${annualAmountPattern}\\s*(?:${currSuffix})?)`,
    "i"
  );
  const curRange = textToScan.match(currencyRangeRegex);
  if (curRange) {
    const rawP1 = curRange[1]?.trim() || "";
    const rawVal1 = curRange[2];
    const s1 = curRange[3]?.trim() || "";
    const rawP2 = curRange[4]?.trim() || "";
    const rawVal2 = curRange[5];
    const s2 = curRange[6]?.trim() || "";

    const isCAD = /CA\$|C\$|CAD/i.test(`${rawP1} ${s1} ${rawP2} ${s2}`);
    let pref = "$";
    if (/CA\$/i.test(rawP1) || /CA\$/i.test(rawP2)) pref = "CA$";
    else if (/C\$/i.test(rawP1) || /C\$/i.test(rawP2)) pref = "C$";
    const suff = isCAD && pref === "$" ? " CAD" : "";

    const num1 = Number(rawVal1.replace(/[,\s]/g, "").replace(/k$/i, "000"));
    if (num1 >= 1000 && num1 < 2000000) {
      // Exclude funding rounds / series / valuation / 401(k)
      const matchIndex = curRange.index ?? 0;
      const context = textToScan.slice(Math.max(0, matchIndex - 40), matchIndex + curRange[0].length + 40).toLowerCase();
      if (!context.includes("raised") && !context.includes("series") && !context.includes("valuation") && !context.includes("worth over") && !context.includes("401(k)") && !context.includes("401k")) {
        const min = formatSalaryFigure(rawVal1, pref);
        const max = rawVal2 ? formatSalaryFigure(rawVal2, pref) : null;
        if (max && max !== min) {
          return `${min}-${max}${suff}`;
        }
        return `${min}${suff}`;
      }
    }
  }

  // 5. Standalone $amount (legacy fallback)
  const yearlyMatch = textToScan.match(
    new RegExp(`\\$${annualAmountPattern}(?:\\s*[-–—]\\s*\\$?${annualAmountPattern})?`, "i")
  );
  if (yearlyMatch) {
    const num1 = Number(yearlyMatch[1].replace(/[,\s]/g, "").replace(/k$/i, "000"));
    if (num1 >= 1000 && num1 < 2000000) {
      const matchIndex = yearlyMatch.index ?? 0;
      const context = textToScan.slice(Math.max(0, matchIndex - 40), matchIndex + yearlyMatch[0].length + 40).toLowerCase();
      if (!context.includes("raised") && !context.includes("series") && !context.includes("valuation") && !context.includes("worth over") && !context.includes("401(k)") && !context.includes("401k")) {
        const min = formatSalaryFigure(yearlyMatch[1]);
        const max = yearlyMatch[2] ? formatSalaryFigure(yearlyMatch[2]) : null;
        return max && max !== min ? `${min}-${max}` : min;
      }
    }
  }

  return null;
}

function formatSalaryFigure(raw: string, defaultCurrency = "$"): string {
  const compact = raw.replace(/[$,\s]/g, "").toLowerCase();
  if (compact.endsWith("k")) {
    return `${defaultCurrency}${compact}`;
  }
  const n = Number(compact);
  if (Number.isFinite(n)) {
    return `${defaultCurrency}${n.toLocaleString("en-US")}`;
  }
  return `${defaultCurrency}${raw.replace(/^\$/, "").trim()}`;
}
