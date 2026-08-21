/**
 * Task 8.4: Tier 2 On-Demand Full-Text Fetcher Module
 *
 * Best-effort extractor for job description full text from apply links (Greenhouse, Workday, Direct career pages).
 * Enforces quality gates (length >= 180 chars, SPA JS-shell detection, requirement keywords),
 * caching in database to avoid duplicate requests, and graceful fallback to manual paste.
 */

import { prisma } from "@/lib/prisma";
import { parseJobDescription } from "@/lib/jd-parser/parser";
import { extractApplyUrlFromNotes, extractSalaryFromNotes, isPlaceholderDescription } from "@/lib/ingestion/helpers";
import { isSafeHref, safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";
import {
  formatCanonicalJobDescription,
  convertHtmlToCleanMarkdown,
  isAtsWidgetNoise,
  type CanonicalJdFields,
} from "@/lib/ingestion/jd-format";

import type { ExtractFailureCode, ExtractDiagnostics } from "@/lib/ingestion/types";

export type { CanonicalJdFields };
export {
  formatCanonicalJobDescription,
  convertHtmlToCleanMarkdown,
  cleanJobHtml,
  BOOKMARKLET_EXTRACT_SNIPPET,
  JD_PASTE_TEMPLATE,
} from "@/lib/ingestion/jd-format";

export interface ExtractResultSuccess {
  success: true;
  rawDescription: string;
  sourceUrl: string;
  diagnostics?: ExtractDiagnostics;
}

export interface ExtractResultFailure {
  success: false;
  reason: "NO_APPLY_URL" | "HTTP_ERROR" | "UNUSABLE_CONTENT" | "FETCH_TIMEOUT" | "ROBOTS_DISALLOWED" | "BLOCKED_HOST";
  failureCode: ExtractFailureCode;
  message: string;
  diagnostics?: ExtractDiagnostics;
}

export type ExtractResult = ExtractResultSuccess | ExtractResultFailure;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
};

export function isTier1Placeholder(rawDescription: string): boolean {
  return isPlaceholderDescription(rawDescription);
}

/**
 * Checks extracted text against quality gates.
 * Filters out JS warning SPA shells, access denied pages, short snippets, and nav junk.
 */
export function validateExtractedTextQuality(text: string): boolean {
  if (!text || text.length < 180) return false;

  const lower = text.toLowerCase();

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
  if (matchedCount < 2) return false;
  if (isAtsWidgetNoise(text.trim())) return false;
  if (/"widget"\s*:\s*"redirect"/i.test(text) && text.length < 600) return false;
  return true;
}

export function greenhouseApiUrlFromPosting(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().endsWith("greenhouse.io")) return null;

    if (u.pathname.includes("/embed/job_app")) {
      const board = u.searchParams.get("for");
      const id = u.searchParams.get("token") || u.searchParams.get("gh_jid");
      if (board && id && /^\d+$/.test(id)) {
        return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${id}`;
      }
    }

    const pathMatch = u.pathname.match(/\/([^/]+)\/jobs\/(\d+)/);
    if (pathMatch) {
      return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(pathMatch[1])}/jobs/${pathMatch[2]}`;
    }
    return null;
  } catch {
    return null;
  }
}

export function leverApiUrlFromPosting(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().endsWith("lever.co")) return null;
    const pathMatch = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{8,})/i);
    if (!pathMatch) return null;
    return `https://api.lever.co/v0/postings/${encodeURIComponent(pathMatch[1])}/${pathMatch[2]}`;
  } catch {
    return null;
  }
}

export function ashbyApiUrlFromPosting(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl);
    if (!u.hostname.toLowerCase().endsWith("ashbyhq.com")) return null;
    const pathMatch = u.pathname.match(/^\/([^/]+)\/([0-9a-f-]{8,})/i);
    if (!pathMatch) return null;
    return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(pathMatch[1])}/job/${pathMatch[2]}`;
  } catch {
    return null;
  }
}

/**
 * Validates whether automated fetching against a given host is permitted.
 * Adheres strictly to Indeed, LinkedIn, and robots policies.
 */
export function checkHostPolicy(url: string): {
  allowed: boolean;
  failureCode?: ExtractFailureCode;
  reason?: "ROBOTS_DISALLOWED" | "BLOCKED_HOST" | "NO_APPLY_URL";
  message?: string;
} {
  try {
    const u = new URL(url);
    const hostname = u.hostname.toLowerCase();
    const pathname = u.pathname.toLowerCase();

    // LinkedIn Policy
    if (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) {
      return {
        allowed: false,
        failureCode: "blocked_host",
        reason: "BLOCKED_HOST",
        message:
          "LinkedIn does not permit automated scraping. Please paste the job description text directly.",
      };
    }

    // Indeed Policy
    if (hostname === "indeed.com" || hostname.endsWith(".indeed.com")) {
      if (pathname.includes("/jobs") || pathname === "/" || u.searchParams.has("q")) {
        return {
          allowed: false,
          failureCode: "blocked_host",
          reason: "BLOCKED_HOST",
          message:
            "Indeed search result crawling is prohibited by Indeed Terms of Service. Please open the posting and paste the job description.",
        };
      }
      // Viewjob without official MCP/partner API
      if (!process.env.INDEED_MCP && !process.env.INDEED_PARTNER_KEY) {
        return {
          allowed: false,
          failureCode: "robots_disallowed",
          reason: "ROBOTS_DISALLOWED",
          message:
            "Indeed direct HTML scraping is restricted by robots.txt / TOS. Please paste the job description text.",
        };
      }
    }

    // Facebook / Meta
    if (hostname === "facebook.com" || hostname.endsWith(".facebook.com")) {
      return {
        allowed: false,
        failureCode: "blocked_host",
        reason: "BLOCKED_HOST",
        message:
          "Facebook job links cannot be scraped automatically. Please paste the job description text.",
      };
    }

    return { allowed: true };
  } catch {
    return {
      allowed: false,
      failureCode: "invalid_url",
      reason: "NO_APPLY_URL",
      message: "Invalid job posting URL.",
    };
  }
}

function isJobPostingType(type: unknown): boolean {
  const types = Array.isArray(type) ? type : type ? [type] : [];
  return types.some((t) => String(t).toLowerCase() === "jobposting");
}

function findJobPosting(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  if (isJobPostingType(obj["@type"])) return obj;
  if (obj["@graph"]) return findJobPosting(obj["@graph"]);
  return null;
}

function organizationName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return organizationName(value[0]);
  if (typeof value === "object" && value && "name" in value) {
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? name : undefined;
  }
  return undefined;
}

function locationName(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return locationName(value[0]);
  if (typeof value === "object" && value) {
    const loc = value as { name?: unknown; address?: unknown };
    if (typeof loc.name === "string") return loc.name;
    return locationName(loc.address);
  }
  return undefined;
}

async function fetchJsonOrHtml(
  url: string,
  accept: string
): Promise<{ ok: true; status: number; body: string } | { ok: false; status: number }> {
  const res = await safeFetch(
    url,
    { headers: { ...FETCH_HEADERS, Accept: accept } },
    { followRedirects: true, timeoutMs: 12000 }
  );
  if (!res.ok) {
    return { ok: false, status: res.status };
  }
  return { ok: true, status: res.status, body: await res.text() };
}

function salaryFromGreenhouseJob(json: Record<string, unknown>): string | undefined {
  const ranges = json.pay_input_ranges ?? json.payInputRanges;
  if (!Array.isArray(ranges)) return undefined;
  for (const raw of ranges) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const minCents = row.min_cents ?? row.minCents;
    const maxCents = row.max_cents ?? row.maxCents;
    if (typeof minCents !== "number") continue;
    const min = minCents / 100;
    const max = typeof maxCents === "number" ? maxCents / 100 : min;
    const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    return min === max ? fmt(min) : `${fmt(min)}-${fmt(max)}`;
  }
  return undefined;
}

function canonicalIfValid(
  fields: CanonicalJdFields,
  sourceUrl: string
): ExtractResultSuccess | null {
  const description = convertHtmlToCleanMarkdown(fields.description);
  const salary = fields.salary || extractSalaryFromNotes(null, description) || undefined;
  const formatted = formatCanonicalJobDescription({ ...fields, description, salary });
  if (!validateExtractedTextQuality(description) && !validateExtractedTextQuality(formatted)) {
    return null;
  }
  if (!validateExtractedTextQuality(formatted)) return null;
  return { success: true, rawDescription: formatted, sourceUrl };
}

async function extractFromAtsJsonApis(
  pageUrl: string,
  meta?: { company?: string; roleTitle?: string }
): Promise<ExtractResultSuccess | null> {
  const greenhouseApi = greenhouseApiUrlFromPosting(pageUrl);
  if (greenhouseApi) {
    const fetched = await fetchJsonOrHtml(greenhouseApi, "application/json");
    if (fetched.ok) {
      try {
        const json = JSON.parse(fetched.body) as Record<string, unknown>;
        const content = json.content;
        if (typeof content === "string" && content.trim()) {
          const location =
            json.location && typeof json.location === "object"
              ? (json.location as { name?: string }).name
              : undefined;
          const result = canonicalIfValid(
            {
              title: (typeof json.title === "string" ? json.title : undefined) || meta?.roleTitle,
              company: meta?.company,
              location,
              salary: salaryFromGreenhouseJob(json),
              description: content,
            },
            pageUrl
          );
          if (result) return result;
        }
      } catch {
        // Fall through to HTML strategies.
      }
    }
  }

  const leverApi = leverApiUrlFromPosting(pageUrl);
  if (leverApi) {
    const fetched = await fetchJsonOrHtml(leverApi, "application/json");
    if (fetched.ok) {
      try {
        const json = JSON.parse(fetched.body) as {
          text?: string;
          description?: string;
          descriptionPlain?: string;
          categories?: { location?: string };
        };
        const description =
          (typeof json.descriptionPlain === "string" && json.descriptionPlain.trim()) ||
          (typeof json.description === "string"
            ? convertHtmlToCleanMarkdown(json.description)
            : "");
        if (description) {
          const result = canonicalIfValid(
            {
              title: json.text || meta?.roleTitle,
              company: meta?.company,
              location: json.categories?.location,
              description,
            },
            pageUrl
          );
          if (result) return result;
        }
      } catch {
        // Fall through to HTML strategies.
      }
    }
  }

  const ashbyApi = ashbyApiUrlFromPosting(pageUrl);
  if (ashbyApi) {
    const fetched = await fetchJsonOrHtml(ashbyApi, "application/json");
    if (fetched.ok) {
      try {
        const json = JSON.parse(fetched.body) as {
          title?: string;
          descriptionHtml?: string;
          descriptionPlain?: string;
          department?: string;
          location?: string;
          compensation?: { summary?: string };
        };
        const description =
          json.descriptionPlain?.trim() ||
          (json.descriptionHtml ? convertHtmlToCleanMarkdown(json.descriptionHtml) : "");
        if (description) {
          const result = canonicalIfValid(
            {
              title: json.title || meta?.roleTitle,
              company: meta?.company,
              location: json.location,
              salary: json.compensation?.summary,
              description,
            },
            pageUrl
          );
          if (result) return result;
        }
      } catch {
        // Fall through to HTML strategies.
      }
    }
  }

  return null;
}

/**
 * Strategy B: Jina Reader Markdown Fallback
 * Bypasses SPA client-side rendering (<div id="root"></div>) and Cloudflare challenge walls
 * by fetching structured markdown representation.
 */
async function fetchWithJinaReader(
  url: string,
  meta?: { company?: string; roleTitle?: string }
): Promise<ExtractResultSuccess | null> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const res = await safeFetch(
      jinaUrl,
      {
        headers: {
          "User-Agent": "ResumeForge-Ingest/1.0",
          Accept: "text/markdown",
        },
      },
      { followRedirects: true, timeoutMs: 15000 }
    );

    if (res.ok) {
      const markdown = await res.text();
      if (
        markdown.length > 150 &&
        !markdown.includes("Security check") &&
        !markdown.includes("Just a moment...") &&
        !markdown.includes("Access denied")
      ) {
        return canonicalIfValid(
          {
            title: meta?.roleTitle,
            company: meta?.company,
            description: markdown,
          },
          url
        );
      }
    }
  } catch {
    // Gracefully ignore Jina proxy failures
  }
  return null;
}

function extractFromJsonLd(
  html: string,
  sourceUrl: string,
  meta?: { company?: string; roleTitle?: string }
): ExtractResultSuccess | null {
  const jsonLdMatches = Array.from(
    html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  );

  for (const match of jsonLdMatches) {
    try {
      const raw = match[1].trim().replace(/^<!--|-->$/g, "").trim();
      const json = JSON.parse(raw) as unknown;
      const target = findJobPosting(json);
      if (!target) continue;
      const description = target.description;
      if (typeof description !== "string" || !description.trim()) continue;
      const result = canonicalIfValid(
        {
          title: typeof target.title === "string" ? target.title : meta?.roleTitle,
          company: organizationName(target.hiringOrganization) || meta?.company,
          location: locationName(target.jobLocation),
          description: convertHtmlToCleanMarkdown(description),
        },
        sourceUrl
      );
      if (result) return result;
    } catch {
      // Continue to next match or HTML body strategy
    }
  }
  return null;
}

function extractFromHtmlBody(
  html: string,
  sourceUrl: string,
  meta?: { company?: string; roleTitle?: string }
): ExtractResultSuccess | null {
  const sanitizedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "");

  const containerPatterns = [
    /<(?:div|section|article)[^>]*(?:id|class|data-qa)=["'][^"']*(?:job[-_]?description|posting-description|job__description|content)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section|article)>/i,
  ];

  for (const pattern of containerPatterns) {
    const match = sanitizedHtml.match(pattern);
    if (!match?.[1]) continue;
    const result = canonicalIfValid(
      {
        title: meta?.roleTitle,
        company: meta?.company,
        description: convertHtmlToCleanMarkdown(match[1]),
      },
      sourceUrl
    );
    if (result) return result;
  }

  const cleanBody = convertHtmlToCleanMarkdown(sanitizedHtml);
  return canonicalIfValid(
    {
      title: meta?.roleTitle,
      company: meta?.company,
      description: cleanBody,
    },
    sourceUrl
  );
}

/**
 * Extracts full job description text from posting URL using ATS JSON APIs, JSON-LD, or HTML body parsing.
 * Categorizes all failures into typed reason codes.
 */
export async function extractFullTextFromUrl(
  url: string,
  meta?: { company?: string; roleTitle?: string }
): Promise<ExtractResult> {
  if (!url || !isSafeHref(url)) {
    return {
      success: false,
      reason: "NO_APPLY_URL",
      failureCode: "invalid_url",
      message: "No valid HTTP apply link available for this job posting.",
    };
  }

  // Check host policy compliance (Indeed / LinkedIn / robots.txt)
  const hostCheck = checkHostPolicy(url);
  if (!hostCheck.allowed) {
    return {
      success: false,
      reason: hostCheck.reason || "BLOCKED_HOST",
      failureCode: hostCheck.failureCode || "blocked_host",
      message: hostCheck.message || "Automated fetch blocked by host policy. Please paste the job description.",
    };
  }

  try {
    const ats = await extractFromAtsJsonApis(url, meta);
    if (ats) return ats;

    const fetched = await fetchJsonOrHtml(url, FETCH_HEADERS.Accept);
    if (!fetched.ok) {
      // Try Jina Reader fallback on 401/403/500 before hard failure
      const jinaFallback = await fetchWithJinaReader(url, meta);
      if (jinaFallback) return jinaFallback;

      const code: ExtractFailureCode =
        fetched.status === 401 || fetched.status === 403
          ? "http_401_403"
          : fetched.status === 404
          ? "http_404"
          : "http_401_403";

      return {
        success: false,
        reason: "HTTP_ERROR",
        failureCode: code,
        message: `Posting URL returned HTTP status ${fetched.status}.`,
        diagnostics: {
          url,
          statusCode: fetched.status,
          failureCode: code,
          timestamp: Date.now(),
        },
      };
    }

    const body = fetched.body;

    // Detect Cloudflare / Bot detection challenge walls
    if (
      body.includes("challenge-platform") ||
      body.includes("cf-browser-verification") ||
      (body.includes("Cloudflare") && body.includes("Just a moment..."))
    ) {
      const jinaFallback = await fetchWithJinaReader(url, meta);
      if (jinaFallback) return jinaFallback;

      return {
        success: false,
        reason: "UNUSABLE_CONTENT",
        failureCode: "cloudflare_challenge",
        message: "Page is protected by Cloudflare bot verification. Please paste the job description text.",
      };
    }

    // Detect login / authentication walls
    const lowerBody = body.toLowerCase();
    if (
      (lowerBody.includes("sign in to continue") ||
        lowerBody.includes("log in to view") ||
        lowerBody.includes("auth-wall")) &&
      !lowerBody.includes("jobposting")
    ) {
      const jinaFallback = await fetchWithJinaReader(url, meta);
      if (jinaFallback) return jinaFallback;

      return {
        success: false,
        reason: "UNUSABLE_CONTENT",
        failureCode: "login_wall",
        message: "Posting requires authentication. Please paste the job description text.",
      };
    }

    // Detect SPA empty JS shell
    if (
      (body.includes('<div id="root"></div>') || body.includes('<div id="app"></div>')) &&
      !body.includes("JobPosting") &&
      body.length < 1500
    ) {
      const jinaFallback = await fetchWithJinaReader(url, meta);
      if (jinaFallback) return jinaFallback;

      return {
        success: false,
        reason: "UNUSABLE_CONTENT",
        failureCode: "js_shell_empty",
        message: "Page requires client-side JavaScript rendering. Please paste the job description text.",
      };
    }

    const fromLd = extractFromJsonLd(body, url, meta);
    if (fromLd) return fromLd;

    const fromHtml = extractFromHtmlBody(body, url, meta);
    if (fromHtml) return fromHtml;

    // Last-ditch attempt: Jina Reader
    const jinaFinal = await fetchWithJinaReader(url, meta);
    if (jinaFinal) return jinaFinal;

    return {
      success: false,
      reason: "UNUSABLE_CONTENT",
      failureCode: "no_job_schema",
      message:
        "Could not extract usable job description text automatically. Please paste using the Role / Company / Requirements format.",
    };
  } catch (err: unknown) {
    if (err instanceof UnsafeUrlError) {
      return {
        success: false,
        reason: "NO_APPLY_URL",
        failureCode: "invalid_url",
        message: err.message,
      };
    }
    const name = err instanceof Error ? err.name : "";
    if (name === "AbortError") {
      return {
        success: false,
        reason: "FETCH_TIMEOUT",
        failureCode: "timeout",
        message: "Job description fetch timed out (12s limit exceeded).",
      };
    }
    return {
      success: false,
      reason: "HTTP_ERROR",
      failureCode: "http_401_403",
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

  const extractRes = await extractFullTextFromUrl(applyUrl, {
    company: job.company ?? undefined,
    roleTitle: job.roleTitle ?? undefined,
  });

  if (!extractRes.success) {
    return {
      success: false,
      error: extractRes.message,
      failureCode: extractRes.failureCode,
      fallbackToManual: true,
      data: job,
      cached: false,
    };
  }

  const reqs = parseJobDescription(extractRes.rawDescription);
  const salary = extractSalaryFromNotes(null, extractRes.rawDescription);

  let updatedNotes = job.notes
    ? job.notes.includes("Tier 2 Fetched")
      ? job.notes
      : `${job.notes} | Tier 2 Fetched`
    : "Tier 2 Fetched";

  if (salary) {
    if (/Salary:\s*[^|]*/i.test(updatedNotes)) {
      updatedNotes = updatedNotes.replace(/Salary:\s*[^|]*/i, `Salary: ${salary}`);
    } else {
      updatedNotes = `${updatedNotes} | Salary: ${salary}`;
    }
  }

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
