import { parseJobDescription } from "@/lib/jd-parser/parser";
import type { ExtractFailureCode } from "@/lib/ingestion/types";

export type JobSourceType =
  | "ats_greenhouse"
  | "ats_lever"
  | "ats_ashby"
  | "pittcsc"
  | "adzuna"
  | "jobicy"
  | "indeed_official"
  | "user_paste"
  | "generic_url";

export type EmploymentType = "full_time" | "part_time" | "contract" | "intern" | "unknown";

export interface NormalizedLocation {
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lng?: number;
  isRemote?: boolean;
}

export interface NormalizedSalary {
  min?: number;
  max?: number;
  currency?: string;
  period?: "yearly" | "monthly" | "hourly" | "unknown";
}

export interface NormalizedJob {
  source: JobSourceType;
  sourceUrl: string | null;
  sourceJobId: string | null;
  title: string;
  company: string;
  locationRaw: string | null;
  location: NormalizedLocation | null;
  employmentType: EmploymentType;
  descriptionHtml: string | null;
  descriptionText: string;
  boilerplateText?: string | null;
  requirements: string[];
  niceToHaves: string[];
  skills: string[];
  domainTerms: string[];
  salary?: NormalizedSalary;
  postedAt?: string;
  raw: unknown;
  extractFailure?: ExtractFailureCode;
}

export interface NormalizeJobInput {
  source?: JobSourceType;
  sourceUrl?: string | null;
  sourceJobId?: string | null;
  title?: string;
  company?: string;
  locationRaw?: string | null;
  location?: NormalizedLocation | null;
  employmentType?: EmploymentType;
  descriptionHtml?: string | null;
  descriptionText: string;
  requirements?: string[];
  niceToHaves?: string[];
  skills?: string[];
  salary?: NormalizedSalary;
  postedAt?: string;
  raw?: unknown;
  extractFailure?: ExtractFailureCode;
}

const EEO_PATTERNS = [
  /equal opportunity employer[\s\S]*?(?:gender|race|veteran|disability|religion|sexual orientation)[^\n.]*[.]?/gi,
  /we are proud to be an equal opportunity[\s\S]*?(?:workplace|employer)[^\n.]*[.]?/gi,
  /diversity and inclusion are at the core[\s\S]*?[.]/gi,
  /all qualified applicants will receive consideration for employment without regard to[\s\S]*?[.]/gi,
  /accommodations are available on request for candidates[\s\S]*?[.]/gi,
];

const KNOWN_CANADIAN_CITIES: Record<string, { region: string; country: string; lat: number; lng: number }> = {
  toronto: { region: "ON", country: "Canada", lat: 43.6532, lng: -79.3832 },
  vancouver: { region: "BC", country: "Canada", lat: 49.2827, lng: -123.1207 },
  montreal: { region: "QC", country: "Canada", lat: 45.5017, lng: -73.5673 },
  ottawa: { region: "ON", country: "Canada", lat: 45.4215, lng: -75.6972 },
  calgary: { region: "AB", country: "Canada", lat: 51.0447, lng: -114.0719 },
  edmonton: { region: "AB", country: "Canada", lat: 53.5461, lng: -113.4938 },
  waterloo: { region: "ON", country: "Canada", lat: 43.4643, lng: -80.5204 },
  kitchener: { region: "ON", country: "Canada", lat: 43.4516, lng: -80.4925 },
  mississauga: { region: "ON", country: "Canada", lat: 43.589, lng: -79.6441 },
  halifax: { region: "NS", country: "Canada", lat: 44.6488, lng: -63.5752 },
  victoria: { region: "BC", country: "Canada", lat: 48.4284, lng: -123.3656 },
  quebec: { region: "QC", country: "Canada", lat: 46.8139, lng: -71.208 },
};

/**
 * Parses raw location string into structured city/region/country and remote status.
 */
export function parseLocation(rawLoc: string | null | undefined): NormalizedLocation | null {
  if (!rawLoc || !rawLoc.trim()) return null;

  const text = rawLoc.trim();
  const lower = text.toLowerCase();

  const isRemote =
    lower.includes("remote") ||
    lower.includes("anywhere") ||
    lower.includes("work from home") ||
    lower.includes("virtual") ||
    lower.includes("telecommute");

  for (const [cityKey, data] of Object.entries(KNOWN_CANADIAN_CITIES)) {
    if (lower.includes(cityKey)) {
      return {
        city: cityKey.charAt(0).toUpperCase() + cityKey.slice(1),
        region: data.region,
        country: data.country,
        lat: data.lat,
        lng: data.lng,
        isRemote,
      };
    }
  }

  // Generic comma-separated parsing (e.g. "Seattle, WA, USA")
  const parts = text.split(/,\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts[0],
      region: parts[1],
      country: parts[2] || (parts[1].length === 2 ? "USA" : undefined),
      isRemote,
    };
  }

  return {
    city: text,
    isRemote,
  };
}

/**
 * Infers employment type from title, description, and source metadata.
 */
export function inferEmploymentType(title: string, desc: string): EmploymentType {
  const combined = `${title} ${desc}`.toLowerCase();

  if (
    combined.includes("intern") ||
    combined.includes("co-op") ||
    combined.includes("internship") ||
    combined.includes("student developer")
  ) {
    return "intern";
  }

  if (
    combined.includes("contract") ||
    combined.includes("contractor") ||
    combined.includes("freelance") ||
    combined.includes("temporary")
  ) {
    return "contract";
  }

  if (combined.includes("part-time") || combined.includes("part time")) {
    return "part_time";
  }

  if (
    combined.includes("full-time") ||
    combined.includes("full time") ||
    combined.includes("permanent")
  ) {
    return "full_time";
  }

  return "unknown";
}

/**
 * Strips common boilerplate (EEO statements, company diversity declarations)
 * from description text into a separate metadata field.
 */
export function stripBoilerplate(text: string): { cleanText: string; boilerplate: string | null } {
  if (!text) return { cleanText: "", boilerplate: null };

  let cleanText = text;
  const removedParts: string[] = [];

  for (const pattern of EEO_PATTERNS) {
    const matches = cleanText.match(pattern);
    if (matches) {
      removedParts.push(...matches);
      cleanText = cleanText.replace(pattern, "\n");
    }
  }

  // Remove multiple blank lines
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  return {
    cleanText,
    boilerplate: removedParts.length > 0 ? removedParts.join("\n\n") : null,
  };
}

/**
 * Universal Normalizer function.
 * Every job input (ATS feed, API sync, URL fetch, or user paste) passes through here.
 */
export function normalizeJob(input: NormalizeJobInput): NormalizedJob {
  const { cleanText, boilerplate } = stripBoilerplate(input.descriptionText || "");

  // Run deterministic parser to ensure requirements are always populated
  const parsed = parseJobDescription(cleanText);

  const title = input.title || parsed.roleTitle || "Untitled Role";
  const company = input.company || parsed.company || "Unknown Company";
  const location = input.location || parseLocation(input.locationRaw || parsed.location);
  const employmentType = input.employmentType || inferEmploymentType(title, cleanText);

  const requirements =
    input.requirements && input.requirements.length > 0
      ? input.requirements
      : parsed.requiredSkills;

  const niceToHaves =
    input.niceToHaves && input.niceToHaves.length > 0
      ? input.niceToHaves
      : parsed.preferredSkills;

  const skills = Array.from(new Set([...requirements, ...niceToHaves]));

  return {
    source: input.source || (input.sourceUrl ? "generic_url" : "user_paste"),
    sourceUrl: input.sourceUrl || null,
    sourceJobId: input.sourceJobId || null,
    title,
    company,
    locationRaw: input.locationRaw || (location?.city ? `${location.city}${location.region ? `, ${location.region}` : ""}` : null),
    location,
    employmentType,
    descriptionHtml: input.descriptionHtml || null,
    descriptionText: cleanText,
    boilerplateText: boilerplate,
    requirements,
    niceToHaves,
    skills,
    domainTerms: parsed.domainTerms,
    salary: input.salary,
    postedAt: input.postedAt,
    raw: input.raw ?? null,
    extractFailure: input.extractFailure,
  };
}
