/**
 * Server and Client compatible helper utilities for job ingestion,
 * apply URL extraction, and Tier 1 placeholder detection.
 */

export function isPlaceholderDescription(rawDescription: string): boolean {
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

  const textToScan = [notes, rawDescription].filter(Boolean).join(" ");
  if (!textToScan) return null;

  // Hourly wage pattern: e.g., $35/hr, $40 - $50/hour, $25.50 / hr, $60/h
  const hourlyMatch = textToScan.match(/\$(\d+(?:\.\d{1,2})?)\s*(?:-\s*\$?(\d+(?:\.\d{1,2})?))?\s*(?:\/|\s*per\s*)(?:hr|hour|h)\b/i);
  if (hourlyMatch) {
    const min = hourlyMatch[1];
    const max = hourlyMatch[2];
    return max ? `$${min}-$${max}/hr` : `$${min}/hr`;
  }

  // Yearly salary pattern: e.g., $100k - $150k, $120,000/yr
  const yearlyMatch = textToScan.match(/\$(\d{2,3}(?:,\d{3})?|\d{2,3}k)\s*(?:-\s*\$?(\d{2,3}(?:,\d{3})?|\d{2,3}k))?\s*(?:\/|\s*per\s*)?(?:yr|year|annually)?\b/i);
  if (yearlyMatch) {
    const min = yearlyMatch[1];
    const max = yearlyMatch[2];
    return max ? `$${min}-$${max}` : `$${min}`;
  }

  return null;
}
