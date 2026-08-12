/**
 * Task 8.4: Tier 2 On-Demand Full-Text Fetcher Module
 *
 * Best-effort extractor for job description full text from apply links (Greenhouse, Workday, Direct career pages).
 * Enforces quality gates (length >= 180 chars, SPA JS-shell detection, requirement keywords),
 * caching in database to avoid duplicate requests, and graceful fallback to manual paste.
 */

import { prisma } from "@/lib/prisma";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { extractApplyUrlFromNotes, isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { isSafeHref, safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";

export interface ExtractResultSuccess {
  success: true;
  rawDescription: string;
  sourceUrl: string;
}

export interface ExtractResultFailure {
  success: false;
  reason: "NO_APPLY_URL" | "HTTP_ERROR" | "UNUSABLE_CONTENT" | "FETCH_TIMEOUT";
  message: string;
}

export type ExtractResult = ExtractResultSuccess | ExtractResultFailure;

export function isTier1Placeholder(rawDescription: string): boolean {
  return isPlaceholderDescription(rawDescription);
}

/**
 * Strips HTML tags, converting headers and lists into clean markdown text.
 */
export function convertHtmlToCleanMarkdown(htmlContent: string): string {
  if (!htmlContent) return "";

  let text = htmlContent;

  // Replace block element tags with newlines
  text = text.replace(/<(h[1-6]|p|div|section|article|li|tr|br)[^>]*>/gi, "\n");
  text = text.replace(/<\/(h[1-6]|p|div|section|article|li|tr)>/gi, "\n");

  // Format list items as bullets
  text = text.replace(/<li[^>]*>\s*/gi, "\n- ");

  // Strip remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x2B;/g, "+");

  // Normalize excessive spacing
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.join("\n\n");
}

/**
 * Checks extracted text against quality gates.
 * Filters out JS warning SPA shells, access denied pages, short snippets, and nav junk.
 */
export function validateExtractedTextQuality(text: string): boolean {
  if (!text || text.length < 180) return false;

  const lower = text.toLowerCase();

  // Known SPA shell / anti-bot / error strings
  const invalidSubstrings = [
    "javascript is required",
    "please enable javascript",
    "enable javascript to view",
    "checking your browser",
    "access denied",
    "403 forbidden",
    "404 not found",
    "page not found",
    "enable cookies to continue",
  ];

  for (const inv of invalidSubstrings) {
    if (lower.includes(inv)) return false;
  }

  // Mandatory requirement substance keywords (must contain at least 2)
  const substanceKeywords = [
    "experience",
    "skills",
    "qualification",
    "responsibilities",
    "requirements",
    "engineer",
    "developer",
    "intern",
    "work",
    "team",
    "role",
    "ability",
    "degree",
    "python",
    "java",
    "c++",
    "software",
  ];

  const matchedCount = substanceKeywords.filter((kw) => lower.includes(kw)).length;
  return matchedCount >= 2;
}

/**
 * Extracts full job description text from posting URL using JSON-LD schema or main HTML body parsing.
 */
export async function extractFullTextFromUrl(url: string): Promise<ExtractResult> {
  if (!url || !isSafeHref(url)) {
    return {
      success: false,
      reason: "NO_APPLY_URL",
      message: "No valid HTTP apply link available for this job posting.",
    };
  }

  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      return {
        success: false,
        reason: "HTTP_ERROR",
        message: `Posting URL returned HTTP status ${res.status}.`,
      };
    }

    const html = await res.text();

    // Strategy 1: Schema.org JobPosting JSON-LD extraction
    const jsonLdMatches = Array.from(
      html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
    );

    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match[1].trim());
        const target = Array.isArray(json)
          ? json.find((item) => item["@type"] === "JobPosting")
          : json["@type"] === "JobPosting"
          ? json
          : null;

        if (target && target.description && typeof target.description === "string") {
          const cleanDesc = convertHtmlToCleanMarkdown(target.description);
          if (validateExtractedTextQuality(cleanDesc)) {
            return {
              success: true,
              rawDescription: cleanDesc,
              sourceUrl: url,
            };
          }
        }
      } catch {
        // Continue to next match or HTML body strategy
      }
    }

    // Strategy 2: HTML body main content container extraction
    let sanitizedHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<form[\s\S]*?<\/form>/gi, "");

    const cleanBody = convertHtmlToCleanMarkdown(sanitizedHtml);

    if (validateExtractedTextQuality(cleanBody)) {
      return {
        success: true,
        rawDescription: cleanBody,
        sourceUrl: url,
      };
    }

    return {
      success: false,
      reason: "UNUSABLE_CONTENT",
      message:
        "Could not extract usable job description text automatically (page may require JavaScript rendering or logins).",
    };
  } catch (err: unknown) {
    if (err instanceof UnsafeUrlError) {
      return {
        success: false,
        reason: "NO_APPLY_URL",
        message: err.message,
      };
    }
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      return {
        success: false,
        reason: "FETCH_TIMEOUT",
        message: "Job description fetch timed out (8s limit exceeded).",
      };
    }
    return {
      success: false,
      reason: "HTTP_ERROR",
      message: err instanceof Error ? err.message : "Failed to reach job posting URL.",
    };
  }
}

/**
 * On-demand Tier 2 fetch and database cache handler.
 */
export async function fetchAndCacheJobFullText(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return {
      success: false,
      error: "Job record not found.",
      cached: false,
    };
  }

  // Cache hit check: if description is already non-placeholder, return immediately
  if (!isTier1Placeholder(job.rawDescription)) {
    return {
      success: true,
      data: job,
      cached: true,
    };
  }

  const applyUrl = extractApplyUrlFromNotes(job.notes);

  if (!applyUrl) {
    return {
      success: false,
      error: "No valid apply URL found for this job posting.",
      fallbackToManual: true,
      data: job,
      cached: false,
    };
  }

  const extractRes = await extractFullTextFromUrl(applyUrl);

  if (!extractRes.success) {
    return {
      success: false,
      error: extractRes.message,
      fallbackToManual: true,
      data: job,
      cached: false,
    };
  }

  // Re-extract requirements using deterministic parser
  const reqs = parseJobDescription(extractRes.rawDescription);

  const updatedNotes = job.notes
    ? job.notes.includes("Tier 2 Fetched")
      ? job.notes
      : `${job.notes} | Tier 2 Fetched`
    : "Tier 2 Fetched";

  const updatedJob = await prisma.job.update({
    where: { id: jobId },
    data: {
      rawDescription: extractRes.rawDescription,
      extractedRequirements: JSON.stringify(reqs),
      notes: updatedNotes,
    },
  });

  return {
    success: true,
    data: updatedJob,
    cached: false,
  };
}
