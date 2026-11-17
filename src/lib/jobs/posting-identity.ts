import {
  extractApplyUrlFromNotes,
  extractLocationFromNotes,
  isPlaceholderDescription,
  normalizeLocation,
} from "@/lib/ingestion/helpers";

const TRACKING_QUERY_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "ref",
  "referer",
  "referrer",
  "source",
  "src",
  "gh_src",
  "lever-source",
  "lever-origin",
  "ashby_src",
  "fbclid",
  "gclid",
  "msclkid",
  "trk",
  "tracking",
  "s",
  "si",
  "share",
  "se",
  "v",
]);

const REQUISITION_QUERY_PARAMS = [
  "gh_jid",
  "ashby_jid",
  "jobid",
  "job_id",
  "reqid",
  "req_id",
  "requisitionid",
  "postingid",
  "jk",
  "jid",
  "vacancyid",
  "positionid",
  "adid",
  "id",
];

const GENERIC_PATH_SEGMENTS = new Set([
  "",
  "jobs",
  "job",
  "careers",
  "career",
  "openings",
  "opening",
  "positions",
  "position",
  "apply",
  "application",
  "search",
  "opportunities",
  "opportunity",
  "hiring",
  "join",
  "join-us",
  "work-with-us",
  "about",
  "en",
  "en-us",
  "en-ca",
  "ca",
  "us",
  "all",
  "index",
  "engineering",
  "students",
  "internships",
  "university",
  "early-career",
]);

const REQUISITION_PARENT_SEGMENTS = new Set([
  "jobs",
  "job",
  "postings",
  "posting",
  "positions",
  "position",
  "openings",
  "opening",
  "requisition",
  "requisitions",
  "careers",
  "search",
  "ad",
  "l",
  "remote-jobs",
  "job-listings",
  "opportunity",
  "opportunities",
  "role",
  "roles",
  "listing",
  "listings",
  "detail",
  "details",
]);

const BROAD_REGION_LOCATIONS = new Set([
  "canada",
  "usa",
  "united states",
  "us",
  "north america",
  "americas",
  "worldwide",
  "anywhere",
  "global",
  "remote",
]);

const UNSPECIFIED_LOCATIONS = new Set([
  "",
  "unspecified",
  "unknown",
  "location unlisted",
  "n/a",
  "na",
  "none",
]);

function normalizeTextToken(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHost(hostname: string): string {
  const lower = hostname.toLowerCase().replace(/^www\./, "");
  if (lower === "job-boards.greenhouse.io" || lower === "job-boards.eu.greenhouse.io") {
    return "boards.greenhouse.io";
  }
  return lower;
}

/**
 * Extracts a canonical key for URLs that identify a specific job requisition.
 * Generic careers/jobs landing URLs (e.g. `https://example.com/jobs`) return `null`
 * so distinct roles sharing a generic landing page are never falsely collapsed.
 */
export function extractRequisitionUrl(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const host = normalizeHost(parsed.hostname);
  let cleanPath = parsed.pathname.replace(/\/+$/, "");

  if (host === "jobs.lever.co") {
    cleanPath = cleanPath.replace(/\/apply$/i, "");
  } else if (host === "jobs.ashbyhq.com") {
    cleanPath = cleanPath.replace(/\/application$/i, "");
  }

  const reqPairs: Array<[string, string]> = [];
  for (const [key, value] of parsed.searchParams.entries()) {
    const lowerKey = key.toLowerCase();
    if (TRACKING_QUERY_PARAMS.has(lowerKey)) continue;
    const cleanVal = value.trim();
    if (!cleanVal) continue;
    if (REQUISITION_QUERY_PARAMS.includes(lowerKey)) {
      reqPairs.push([lowerKey, cleanVal.toLowerCase()]);
    }
  }

  if (reqPairs.length > 0) {
    reqPairs.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const query = reqPairs.map(([k, v]) => `${k}=${v}`).join("&");
    return `${host}${cleanPath.toLowerCase() || "/"}?${query}`;
  }

  const segments = cleanPath.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const lastSegment = segments[segments.length - 1]!.toLowerCase();
  const parentSegment = segments.length >= 2 ? segments[segments.length - 2]!.toLowerCase() : "";

  if (GENERIC_PATH_SEGMENTS.has(lastSegment)) {
    return null;
  }

  // Board root without posting ID (e.g. boards.greenhouse.io/stripe, jobs.lever.co/spotify)
  if (
    (host === "boards.greenhouse.io" || host === "jobs.lever.co" || host === "jobs.ashbyhq.com") &&
    segments.length < 2
  ) {
    return null;
  }

  const hasDigitOrUuid = /\d/.test(lastSegment) || /^[0-9a-f-]{8,}$/i.test(lastSegment);
  const underRequisitionParent = REQUISITION_PARENT_SEGMENTS.has(parentSegment);
  const hasSpecificSlug = segments.length >= 2 && (hasDigitOrUuid || underRequisitionParent || lastSegment.length >= 12);

  if (!hasSpecificSlug && !hasDigitOrUuid) {
    return null;
  }

  return `${host}/${segments.map((s) => s.toLowerCase()).join("/")}`;
}

export function normalizePostingLocation(rawLocation?: string | null): string {
  const normalized = normalizeLocation(rawLocation) || (rawLocation ?? "").trim();
  return normalized
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPrimaryCity(normLoc: string): string {
  if (!normLoc) return "";
  const firstPlace = normLoc.split(";")[0]?.split(",")[0]?.trim() ?? "";
  return firstPlace
    .replace(/\b(remote|hybrid|on-site|onsite|canada|usa)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function arePostingLocationsCompatible(
  locA?: string | null,
  locB?: string | null
): boolean {
  const normA = normalizePostingLocation(locA);
  const normB = normalizePostingLocation(locB);

  if (UNSPECIFIED_LOCATIONS.has(normA) || UNSPECIFIED_LOCATIONS.has(normB)) {
    return true;
  }
  if (normA === normB) return true;

  if (BROAD_REGION_LOCATIONS.has(normA) || BROAD_REGION_LOCATIONS.has(normB)) {
    return true;
  }

  const cityA = extractPrimaryCity(normA);
  const cityB = extractPrimaryCity(normB);
  if (cityA && cityB) {
    return cityA === cityB;
  }

  return normA.includes(normB) || normB.includes(normA);
}

export function extractPostingRefLabel(
  applyUrl?: string | null,
  externalId?: string | null
): string | null {
  if (applyUrl) {
    try {
      const url = new URL(applyUrl);
      for (const param of REQUISITION_QUERY_PARAMS) {
        const val = url.searchParams.get(param) ?? url.searchParams.get(param.toUpperCase());
        if (val && val.trim()) {
          return `Req #${val.trim().slice(0, 10)}`;
        }
      }
      const segments = url.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
      const filtered = segments.filter(
        (seg) => seg.toLowerCase() !== "apply" && seg.toLowerCase() !== "application"
      );
      const tail = filtered.at(-1);
      if (tail && !GENERIC_PATH_SEGMENTS.has(tail.toLowerCase())) {
        const shortTail = tail.length > 10 ? tail.slice(0, 8) : tail;
        return `Req #${shortTail}`;
      }
    } catch {
      // Ignore malformed URLs and fall back to externalId.
    }
  }

  if (externalId && externalId.trim()) {
    const parts = externalId.trim().split("_");
    const tail = parts.at(-1) ?? externalId.trim();
    const shortTail = tail.length > 10 ? tail.slice(0, 8) : tail;
    return `ID #${shortTail}`;
  }

  return null;
}

const AUTO_IMPORT_NOTE_SEGMENT_RE =
  /^(?:tier\s*\d+\s*bulk\s*import|ingested\s+from\s+.+|(?:location|workplace|apply(?:\s*link)?|(?:date\s*)?posted|salary|status|source|external\s*id|requisition\s*id|tier\s*\d+[^:]*)\s*:.*)$/i;

export function hasUserAuthoredNotes(notes?: string | null): boolean {
  if (!notes || !notes.trim()) return false;
  const segments = notes
    .split(/[|\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return segments.some(
    (seg) =>
      !AUTO_IMPORT_NOTE_SEGMENT_RE.test(seg) &&
      !seg.toLowerCase().includes("tier 2 fetched")
  );
}

export interface TrackerDedupeCandidate {
  id: string;
  userId?: string | null;
  company?: string | null;
  roleTitle?: string | null;
  source?: string | null;
  status?: string | null;
  appliedAt?: Date | string | null;
  appliedVariantId?: string | null;
  notes?: string | null;
  rawDescription?: string | null;
  requirementsStatus?: string | null;
  createdAt?: Date | string;
  applications?: unknown[];
  variants?: unknown[];
  coverLetters?: unknown[];
  patchProposalBatches?: unknown[];
}

export function hasJobSavedApplicationHistory(job: TrackerDedupeCandidate): boolean {
  if (job.applications && job.applications.length > 0) return true;
  if (job.status && job.status !== "SAVED") return true;
  if (job.appliedAt) return true;
  if (job.appliedVariantId) return true;
  if (job.variants && job.variants.length > 0) return true;
  if (job.coverLetters && job.coverLetters.length > 0) return true;
  if (job.patchProposalBatches && job.patchProposalBatches.length > 0) return true;
  if (hasUserAuthoredNotes(job.notes)) return true;
  return false;
}

function trackerCandidateRank(job: TrackerDedupeCandidate): number {
  let score = 0;
  if (hasJobSavedApplicationHistory(job)) score += 1000;
  if (job.rawDescription !== undefined && !isPlaceholderDescription(job.rawDescription)) {
    score += 100;
  }
  if (job.requirementsStatus === "ready") score += 20;
  if (job.userId) score += 10;
  return score;
}

function compareTrackerCandidate(a: TrackerDedupeCandidate, b: TrackerDedupeCandidate): number {
  const rankDiff = trackerCandidateRank(a) - trackerCandidateRank(b);
  if (rankDiff !== 0) return rankDiff;
  const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return timeA - timeB;
}

/**
 * Collapses duplicate Job rows that represent the same source posting before paging/counts,
 * while strictly preserving separate rows whenever both carry saved application history
 * (applications, notes, statuses, variants, cover letters, or proposal batches) or when
 * requisition-bearing URLs or locations identify distinct postings.
 */
export function collapseDuplicateTrackerJobs<T extends TrackerDedupeCandidate>(rows: T[]): T[] {
  interface Entry {
    row: T;
    reqUrl: string | null;
    location: string;
    companyTitleKey: string | null;
    hasHistory: boolean;
  }

  const entries: Entry[] = [];
  const byReqUrl = new Map<string, number[]>();
  const byCompanyTitle = new Map<string, number[]>();

  for (const row of rows) {
    const applyUrl = extractApplyUrlFromNotes(row.notes);
    const reqUrl = extractRequisitionUrl(applyUrl);
    const location = extractLocationFromNotes(row.notes);
    const normCompany = normalizeTextToken(row.company);
    const normTitle = normalizeTextToken(row.roleTitle);
    const companyTitleKey = normCompany && normTitle ? `${normCompany}::${normTitle}` : null;
    const hasHistory = hasJobSavedApplicationHistory(row);

    let matchedIndex: number | null = null;

    if (reqUrl) {
      const candidates = byReqUrl.get(reqUrl) ?? [];
      for (const idx of candidates) {
        const existing = entries[idx]!;
        if (existing.hasHistory && hasHistory) continue;
        if (!arePostingLocationsCompatible(existing.location, location)) continue;
        matchedIndex = idx;
        break;
      }
    }

    if (matchedIndex === null && companyTitleKey) {
      const candidates = byCompanyTitle.get(companyTitleKey) ?? [];
      for (const idx of candidates) {
        const existing = entries[idx]!;
        if (existing.hasHistory && hasHistory) continue;
        if (reqUrl && existing.reqUrl && reqUrl !== existing.reqUrl) continue;
        if (!arePostingLocationsCompatible(existing.location, location)) continue;
        // Without a shared requisition URL, only collapse identical company+title+location
        // when at least one side lacks a requisition URL and neither side conflicts.
        if (reqUrl || existing.reqUrl) continue;
        matchedIndex = idx;
        break;
      }
    }

    if (matchedIndex !== null) {
      const existing = entries[matchedIndex]!;
      if (compareTrackerCandidate(row, existing.row) > 0) {
        entries[matchedIndex] = {
          row,
          reqUrl: reqUrl ?? existing.reqUrl,
          location: location || existing.location,
          companyTitleKey: companyTitleKey ?? existing.companyTitleKey,
          hasHistory: hasHistory || existing.hasHistory,
        };
      }
      continue;
    }

    const newIdx = entries.length;
    entries.push({ row, reqUrl, location, companyTitleKey, hasHistory });
    if (reqUrl) {
      const list = byReqUrl.get(reqUrl) ?? [];
      list.push(newIdx);
      byReqUrl.set(reqUrl, list);
    }
    if (companyTitleKey) {
      const list = byCompanyTitle.get(companyTitleKey) ?? [];
      list.push(newIdx);
      byCompanyTitle.set(companyTitleKey, list);
    }
  }

  return entries.map((e) => e.row);
}

export interface IngestedDedupeCandidate {
  id: string;
  externalId: string;
  source: string;
  companyName: string;
  title: string;
  location: string;
  applyUrl: string;
  trackedJobId?: string | null;
  blendedScore?: number;
  postedAt?: Date | string | null;
  createdAt?: Date | string;
  hasParsedRequirements?: boolean;
}

function ingestedCandidateRank(item: IngestedDedupeCandidate): number {
  let score = 0;
  if (item.trackedJobId) score += 1000;
  if (item.hasParsedRequirements) score += 100;
  score += Math.round(item.blendedScore ?? 0);
  return score;
}

function compareIngestedCandidate(a: IngestedDedupeCandidate, b: IngestedDedupeCandidate): number {
  const rankDiff = ingestedCandidateRank(a) - ingestedCandidateRank(b);
  if (rankDiff !== 0) return rankDiff;
  const timeA = new Date(a.postedAt || a.createdAt || 0).getTime();
  const timeB = new Date(b.postedAt || b.createdAt || 0).getTime();
  return timeA - timeB;
}

/**
 * Collapses duplicate IngestedJob rows representing the same source posting
 * before sorting, paging, and total count calculation in `/api/connectors/jobs`.
 */
export function collapseDuplicateIngestedJobs<T extends IngestedDedupeCandidate>(rows: T[]): T[] {
  interface Entry {
    row: T;
    stableKey: string;
    reqUrl: string | null;
    companyTitleKey: string | null;
  }

  const entries: Entry[] = [];
  const byStableKey = new Map<string, number[]>();
  const byReqUrl = new Map<string, number[]>();
  const byCompanyTitle = new Map<string, number[]>();

  for (const row of rows) {
    const sourceNorm = row.source.trim().toLowerCase();
    const extNorm = row.externalId.trim().toLowerCase();
    const stableKey = sourceNorm && extNorm ? `${sourceNorm}::${extNorm}` : "";
    const reqUrl = extractRequisitionUrl(row.applyUrl);
    const normCompany = normalizeTextToken(row.companyName);
    const normTitle = normalizeTextToken(row.title);
    const companyTitleKey = normCompany && normTitle ? `${normCompany}::${normTitle}` : null;

    let matchedIndex: number | null = null;

    if (stableKey) {
      const candidates = byStableKey.get(stableKey) ?? [];
      for (const idx of candidates) {
        const existing = entries[idx]!;
        if (reqUrl && existing.reqUrl && reqUrl !== existing.reqUrl) continue;
        if (!arePostingLocationsCompatible(existing.row.location, row.location)) continue;
        matchedIndex = idx;
        break;
      }
    }

    if (matchedIndex === null && reqUrl) {
      const candidates = byReqUrl.get(reqUrl) ?? [];
      for (const idx of candidates) {
        const existing = entries[idx]!;
        if (
          sourceNorm === existing.row.source.trim().toLowerCase() &&
          extNorm &&
          existing.row.externalId.trim().toLowerCase() &&
          extNorm !== existing.row.externalId.trim().toLowerCase()
        ) {
          continue;
        }
        if (!arePostingLocationsCompatible(existing.row.location, row.location)) continue;
        matchedIndex = idx;
        break;
      }
    }

    if (matchedIndex === null && companyTitleKey && !reqUrl) {
      const candidates = byCompanyTitle.get(companyTitleKey) ?? [];
      for (const idx of candidates) {
        const existing = entries[idx]!;
        if (existing.reqUrl) continue;
        // Different externalIds from the same source with generic URLs remain distinct postings.
        if (
          sourceNorm === existing.row.source.trim().toLowerCase() &&
          extNorm !== existing.row.externalId.trim().toLowerCase()
        ) {
          continue;
        }
        if (!arePostingLocationsCompatible(existing.row.location, row.location)) continue;
        matchedIndex = idx;
        break;
      }
    }

    if (matchedIndex !== null) {
      const existing = entries[matchedIndex]!;
      if (compareIngestedCandidate(row, existing.row) > 0) {
        entries[matchedIndex] = {
          row,
          stableKey: stableKey || existing.stableKey,
          reqUrl: reqUrl ?? existing.reqUrl,
          companyTitleKey: companyTitleKey ?? existing.companyTitleKey,
        };
      }
      continue;
    }

    const newIdx = entries.length;
    entries.push({ row, stableKey, reqUrl, companyTitleKey });
    if (stableKey) {
      const list = byStableKey.get(stableKey) ?? [];
      list.push(newIdx);
      byStableKey.set(stableKey, list);
    }
    if (reqUrl) {
      const list = byReqUrl.get(reqUrl) ?? [];
      list.push(newIdx);
      byReqUrl.set(reqUrl, list);
    }
    if (companyTitleKey) {
      const list = byCompanyTitle.get(companyTitleKey) ?? [];
      list.push(newIdx);
      byCompanyTitle.set(companyTitleKey, list);
    }
  }

  return entries.map((e) => e.row);
}

export function buildTrackerDisambiguators(
  jobs: Array<{
    id: string;
    company?: string | null;
    roleTitle?: string | null;
    source?: string | null;
    status?: string | null;
    notes?: string | null;
    variants?: Array<{ id: string; variantTitle: string }>;
  }>
): Map<string, string> {
  const result = new Map<string, string>();
  const groups = new Map<string, typeof jobs>();

  for (const job of jobs) {
    const key = `${normalizeTextToken(job.company)}::${normalizeTextToken(job.roleTitle)}`;
    if (!normalizeTextToken(job.roleTitle)) continue;
    const list = groups.get(key) ?? [];
    list.push(job);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const locations = group.map((g) => normalizePostingLocation(extractLocationFromNotes(g.notes)));
    const uniqueNonEmptyLocs = new Set(locations.filter(Boolean));
    const allHaveUniqueLocs =
      uniqueNonEmptyLocs.size === group.length && locations.every(Boolean);
    if (allHaveUniqueLocs) continue;

    const refs = group.map((g) => extractPostingRefLabel(extractApplyUrlFromNotes(g.notes)));
    const uniqueRefs = new Set(refs.filter(Boolean));

    for (let i = 0; i < group.length; i++) {
      const job = group[i]!;
      const ref = refs[i];
      if (ref && uniqueRefs.size > 1) {
        result.set(job.id, ref);
        continue;
      }
      const variantTitle = job.variants?.[0]?.variantTitle;
      if (variantTitle) {
        result.set(job.id, variantTitle);
        continue;
      }
      const sources = new Set(group.map((g) => (g.source || "").toLowerCase()));
      if (sources.size > 1 && job.source) {
        result.set(job.id, job.source);
        continue;
      }
      if (hasUserAuthoredNotes(job.notes)) {
        result.set(job.id, "Custom notes");
        continue;
      }
      result.set(job.id, `Entry ${i + 1}`);
    }
  }

  return result;
}

export function buildDiscoverDisambiguators(
  jobs: Array<{
    id: string;
    externalId: string;
    source: string;
    companyName: string;
    title: string;
    location: string;
    workplaceType?: string;
    applyUrl: string;
  }>
): Map<string, string> {
  const result = new Map<string, string>();
  const groups = new Map<string, typeof jobs>();

  for (const job of jobs) {
    const key = `${normalizeTextToken(job.companyName)}::${normalizeTextToken(job.title)}`;
    if (!normalizeTextToken(job.title)) continue;
    const list = groups.get(key) ?? [];
    list.push(job);
    groups.set(key, list);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const locations = group.map((g) => normalizePostingLocation(g.location));
    const uniqueLocs = new Set(locations.filter(Boolean));
    if (uniqueLocs.size === group.length && locations.every(Boolean)) continue;

    const refs = group.map((g) => extractPostingRefLabel(g.applyUrl, g.externalId));
    const uniqueRefs = new Set(refs.filter(Boolean));

    for (let i = 0; i < group.length; i++) {
      const job = group[i]!;
      const ref = refs[i];
      if (ref && uniqueRefs.size > 1) {
        result.set(job.id, ref);
        continue;
      }
      const workplaces = new Set(group.map((g) => g.workplaceType || ""));
      if (workplaces.size > 1 && job.workplaceType && job.workplaceType !== "UNSPECIFIED") {
        result.set(job.id, job.workplaceType.toLowerCase());
        continue;
      }
      result.set(job.id, `Listing ${i + 1}`);
    }
  }

  return result;
}
