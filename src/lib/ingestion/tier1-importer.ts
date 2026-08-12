/**
 * Task 8.2: Tier 1 Bulk Job Ingestion Module
 *
 * Configurable source parser for structured job listings (e.g. SimplifyJobs markdown & HTML tables).
 * Performs validation via CreateJobSchema, deduplication on re-import, and graceful skipping of malformed rows.
 */

import { prisma } from "@/lib/prisma";
import { CreateJobSchema } from "@/lib/jd-parser/types";
import { getImportAllowlist, isSafeHref, safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";

export const DEFAULT_SIMPLIFY_SOURCE_URL =
  process.env.SIMPLIFY_JOBS_URL ||
  "https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md";

export interface ParsedJobRow {
  company: string;
  roleTitle: string;
  location: string;
  applyUrl: string;
  datePosted: string;
}

export interface ImportTier1Input {
  tableMarkdown?: string;
  sourceUrl?: string;
  userId?: string;
}

export interface ImportTier1Result {
  success: boolean;
  createdCount: number;
  skippedCount: number;
  totalProcessed: number;
  data: any[];
  message?: string;
}

/**
 * Strips HTML tags, Markdown links/formatting, and emoji symbols.
 */
function cleanTextContent(cell: string): string {
  if (!cell) return "";
  let text = cell.trim();

  // Extract link text from markdown link [Text](url)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, "");

  // Remove bold / italic / emoji markers
  text = text.replace(/[\*_]{1,3}/g, "");
  text = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, ""); // strip emoji badges like 🔥

  return text.trim();
}

/**
 * Extracts candidate apply URL from HTML or Markdown link cell.
 * Prefers direct ATS links over generic tracker referral links.
 */
function extractLinkFromCell(cell: string): string {
  if (!cell) return "";

  // Extract all hrefs
  const hrefMatches = Array.from(cell.matchAll(/href=["'](https?:\/\/[^"']+)["']/g)).map((m) => m[1]);
  if (hrefMatches.length > 0) {
    // Prefer non-simplify referral link if direct ATS link exists
    const directAts = hrefMatches.find((h) => !h.includes("simplify.jobs/c/") && !h.includes("simplify.jobs/p/"));
    return directAts || hrefMatches[0];
  }

  const mdMatch = cell.match(/\[[^\]]+\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) return mdMatch[1];

  const rawUrlMatch = cell.match(/https?:\/\/[^\s|)]+/);
  if (rawUrlMatch) return rawUrlMatch[0];

  return "";
}

/**
 * Parses table content (supporting both Markdown pipe tables and HTML <table>/<tr> structures).
 */
export function parseMarkdownTable(content: string): ParsedJobRow[] {
  if (!content || !content.trim()) return [];

  const rows: ParsedJobRow[] = [];
  let lastCompany = "";

  // Check if content contains HTML table rows
  if (content.includes("<tr") && content.includes("<td")) {
    const trMatches = content.split(/<\/tr>/i);

    for (const trChunk of trMatches) {
      if (!trChunk.includes("<td")) continue;

      const tdMatches = trChunk.split(/<\/td>/i).map((td) => {
        const idx = td.indexOf("<td");
        return idx !== -1 ? td.slice(idx) : td;
      });

      const cells = tdMatches
        .map((td) => td.replace(/^<td[^>]*>/i, "").trim())
        .filter((c) => c.length > 0);

      if (cells.length < 2) continue;

      let company = cleanTextContent(cells[0]);

      // Handle sub-role row company inheritance symbol (↳)
      if (!company || company.includes("↳") || company === "↳") {
        company = lastCompany;
      } else {
        lastCompany = company;
      }

      const roleTitle = cleanTextContent(cells[1]);
      const location = cells[2] ? cleanTextContent(cells[2]) : "";
      const applyUrl = cells[3] ? extractLinkFromCell(cells[3]) : "";
      const datePosted = cells[4] ? cleanTextContent(cells[4]) : "";

      if (!company || !roleTitle || company.toLowerCase().includes("company")) continue;

      rows.push({
        company,
        roleTitle,
        location,
        applyUrl,
        datePosted,
      });
    }

    if (rows.length > 0) return rows;
  }

  // Fallback to Markdown pipe table parsing
  const lines = content.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line.startsWith("|")) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);

    if (cells.length < 2) continue;

    const firstCellLower = cells[0].toLowerCase();
    const secondCellLower = cells[1].toLowerCase();

    if (
      firstCellLower.includes("company") ||
      firstCellLower.includes("header") ||
      firstCellLower.includes("---") ||
      secondCellLower.includes("role") ||
      secondCellLower.includes("title") ||
      secondCellLower.includes("header") ||
      secondCellLower.includes("---")
    ) {
      continue;
    }

    let company = cleanTextContent(cells[0]);
    if (!company || company.includes("↳")) {
      company = lastCompany;
    } else {
      lastCompany = company;
    }

    const roleTitle = cleanTextContent(cells[1]);
    const location = cells[2] ? cleanTextContent(cells[2]) : "";
    const applyUrl = cells[3] ? extractLinkFromCell(cells[3]) : "";
    const datePosted = cells[4] ? cleanTextContent(cells[4]) : "";

    if (!company || !roleTitle) continue;

    rows.push({
      company,
      roleTitle,
      location,
      applyUrl,
      datePosted,
    });
  }

  return rows;
}

/**
 * Bulk imports Tier 1 job metadata records into SQLite database.
 * Deduplicates against existing jobs and sets placeholder rawDescription.
 */
export async function importTier1Jobs(input: ImportTier1Input = {}): Promise<ImportTier1Result> {
  let tableText = input.tableMarkdown;

  if (!tableText && (input.sourceUrl || DEFAULT_SIMPLIFY_SOURCE_URL)) {
    const targetUrl = input.sourceUrl || DEFAULT_SIMPLIFY_SOURCE_URL;
    try {
      const res = await safeFetch(
        targetUrl,
        { headers: { Accept: "text/plain, text/markdown, */*" } },
        { allowedHosts: getImportAllowlist(), timeoutMs: 15000 }
      );
      if (res.ok) {
        tableText = await res.text();
      }
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        return {
          success: false,
          createdCount: 0,
          skippedCount: 0,
          totalProcessed: 0,
          data: [],
          message: err.message,
        };
      }
      console.warn(`Failed to fetch Tier 1 jobs from source URL (${targetUrl}):`, err);
    }
  }

  if (!tableText) {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      data: [],
      message: "No markdown table content or reachable source URL provided for Tier 1 import.",
    };
  }

  const parsedRows = parseMarkdownTable(tableText);

  if (parsedRows.length === 0) {
    return {
      success: false,
      createdCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      data: [],
      message: "No parseable job listing rows were found in the source content.",
    };
  }

  let createdCount = 0;
  let skippedCount = 0;

  const existingJobs = await prisma.job.findMany({
    where: input.userId ? { userId: input.userId } : undefined,
    select: { company: true, roleTitle: true, notes: true },
  });

  const isExistingDuplicate = (company: string, roleTitle: string, location: string) =>
    existingJobs.some((job) => {
      if (job.company !== company || job.roleTitle !== roleTitle) return false;
      if (!location) return true;
      return !job.notes || job.notes.includes(`Location: ${location}`);
    });

  const seenInBatch = new Set<string>();
  const payloads: Array<{
    company: string;
    roleTitle: string;
    rawDescription: string;
    source: string;
    notes: string;
    extractedRequirements: string;
    userId?: string;
  }> = [];

  for (const row of parsedRows) {
    const batchKey = `${row.company}::${row.roleTitle}::${row.location}`;
    if (seenInBatch.has(batchKey) || isExistingDuplicate(row.company, row.roleTitle, row.location)) {
      skippedCount++;
      continue;
    }
    seenInBatch.add(batchKey);

    const applyUrl = isSafeHref(row.applyUrl) ? row.applyUrl : "";
    const placeholderDescription = `[Pending Import] Full job description text not yet fetched from posting page for ${row.company} — ${row.roleTitle}${row.location ? ` (${row.location})` : ""}. Navigate to the Tailor workspace to paste the complete job description text.`;

    const validatedInput = CreateJobSchema.parse({
      company: row.company,
      roleTitle: row.roleTitle,
      rawDescription: placeholderDescription,
      source: "simplify-jobs",
    });

    const notesInfo = [
      `Tier 1 Bulk Import`,
      row.location ? `Location: ${row.location}` : null,
      applyUrl ? `Apply Link: ${applyUrl}` : null,
      row.datePosted ? `Posted: ${row.datePosted}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    payloads.push({
      company: validatedInput.company || row.company,
      roleTitle: validatedInput.roleTitle || row.roleTitle,
      rawDescription: validatedInput.rawDescription,
      source: "simplify-jobs",
      notes: notesInfo,
      extractedRequirements: JSON.stringify({
        requiredSkills: [],
        preferredSkills: [],
        domainTerms: [],
      }),
      ...(input.userId ? { userId: input.userId } : {}),
    });
  }

  if (payloads.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.job.createMany({ data: payloads });
    });
  }

  createdCount = payloads.length;
  const createdJobs =
    payloads.length === 0
      ? []
      : await prisma.job.findMany({
          where: {
            OR: payloads.map((p) => ({
              company: p.company,
              roleTitle: p.roleTitle,
              notes: p.notes,
            })),
          },
          orderBy: { createdAt: "desc" },
          take: payloads.length,
        });

  return {
    success: true,
    createdCount,
    skippedCount,
    totalProcessed: parsedRows.length,
    data: createdJobs,
    message: `Tier 1 bulk import completed: ${createdCount} jobs created, ${skippedCount} existing jobs skipped.`,
  };
}
