/**
 * Server and Client compatible helper utilities for job ingestion,
 * apply URL extraction, and Tier 1 placeholder detection.
 */

export function isPlaceholderDescription(rawDescription?: string | null): boolean {
  if (!rawDescription || !rawDescription.trim()) return true;
  const lower = rawDescription.toLowerCase().trim();
  return (
    rawDescription.startsWith("[Pending Import]") ||
    lower.includes("tier 1 bulk import") ||
    lower.includes("full job description not yet imported") ||
    lower.includes("apply at company site") ||
    lower.includes("view full details on company site")
  );
}

export function extractApplyUrlFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const match = notes.match(/Apply Link:\s*(https?:\/\/[^\s|]+)/i);
  return match ? match[1].trim() : "";
}

export function extractLocationFromNotes(notes?: string | null): string {
  if (!notes) return "";
  const match = notes.match(/Location:\s*([^|]+)/i);
  return match ? match[1].trim() : "";
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
    .replace(/&nbsp;/gi, " ");
  if (!textToScan) return null;

  const hourlyMatch = textToScan.match(
    /\$(\d+(?:\.\d{1,2})?)\s*(?:-\s*\$?(\d+(?:\.\d{1,2})?))?\s*(?:\/|\s*per\s*)(?:hr|hour|h)\b/i
  );
  if (hourlyMatch) {
    const min = hourlyMatch[1];
    const max = hourlyMatch[2];
    return max ? `$${min}-$${max}/hr` : `$${min}/hr`;
  }

  const amount = "(\\d{1,3}(?:,\\d{3})+|\\d{4,7}|\\d{2,3}\\s*k)";
  const labeled = textToScan.match(
    new RegExp(
      `(?:base\\s+salary|salary(?:\\s+range)?|compensation(?:\\s+range)?)\\s*[:\\-–]\\s*\\$?\\s*${amount}(?:\\s*[-–—]\\s*\\$?\\s*${amount})?`,
      "i"
    )
  );
  if (labeled) {
    const min = formatSalaryFigure(labeled[1]);
    const max = labeled[2] ? formatSalaryFigure(labeled[2]) : null;
    return max && max !== min ? `${min}-${max}` : min;
  }

  const yearlyMatch = textToScan.match(
    new RegExp(`\\$${amount}(?:\\s*[-–—]\\s*\\$?${amount})?`, "i")
  );
  if (yearlyMatch) {
    const min = formatSalaryFigure(yearlyMatch[1]);
    const max = yearlyMatch[2] ? formatSalaryFigure(yearlyMatch[2]) : null;
    return max && max !== min ? `${min}-${max}` : min;
  }

  return null;
}

function formatSalaryFigure(raw: string): string {
  const compact = raw.replace(/[$,\s]/g, "").toLowerCase();
  if (compact.endsWith("k")) {
    return `$${compact}`;
  }
  const n = Number(compact);
  if (Number.isFinite(n)) {
    return `$${n.toLocaleString("en-US")}`;
  }
  return `$${raw.replace(/^\$/, "").trim()}`;
}
