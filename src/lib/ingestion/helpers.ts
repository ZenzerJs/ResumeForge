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

export function extractSalaryFromNotes(notes?: string | null): string | null {
  if (!notes) return null;
  const match = notes.match(/Salary:\s*([^|]+)/i);
  return match ? match[1].trim() : null;
}
