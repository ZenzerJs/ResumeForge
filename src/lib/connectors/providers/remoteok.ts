import { safeFetch } from "../http";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

const TECH_TAGS = new Set([
  "dev",
  "engineer",
  "software",
  "developer",
  "frontend",
  "backend",
  "fullstack",
  "typescript",
  "javascript",
  "python",
  "react",
  "node",
  "golang",
  "rust",
  "aws",
  "cloud",
  "data",
  "ai",
  "machine learning",
]);

function isCanadianOrWorldwide(locationStr: string): boolean {
  const loc = (locationStr || "").toLowerCase();
  return (
    loc.includes("canada") ||
    loc.includes("worldwide") ||
    loc.includes("anywhere") ||
    loc.includes("north america") ||
    loc.includes("americas") ||
    loc === ""
  );
}

export class RemoteOkConnector implements ConnectorClient {
  readonly id = "remoteok" as const;
  readonly name = "RemoteOK API";

  async fetchJobs(): Promise<RawJobListing[]> {
    const url = "https://remoteok.com/api";

    try {
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const data = await res.json();
      if (!Array.isArray(data)) return [];

      const listings: RawJobListing[] = [];

      for (const item of data) {
        // Skip metadata banner item
        if (!item || !item.id || !item.position) continue;

        // Filter for tech-relevant postings
        const tags: string[] = Array.isArray(item.tags)
          ? item.tags.map((t: string) => String(t).toLowerCase())
          : [];
        const isTech =
          tags.some((t) => TECH_TAGS.has(t)) ||
          item.position.toLowerCase().includes("engineer") ||
          item.position.toLowerCase().includes("developer");

        if (!isTech) continue;

        const location = item.location || "Worldwide Remote";
        const isEligible = isCanadianOrWorldwide(location);
        const { html, text } = sanitizeJobPayload(item.description || "");

        const minSalary = typeof item.salary_min === "number" && item.salary_min > 0 ? Math.round(item.salary_min) : undefined;
        const maxSalary = typeof item.salary_max === "number" && item.salary_max > 0 ? Math.round(item.salary_max) : undefined;

        listings.push({
          externalId: `remoteok_${item.id}`,
          source: "remoteok",
          companyName: item.company || "Remote Company",
          title: item.position || "Software Engineer",
          location,
          isCanadianEligible: isEligible,
          workplaceType: "remote",
          descriptionHtml: html || `<p>${item.position}</p>`,
          descriptionPlain: text || item.position || "No description provided.",
          applyUrl: item.url ? (item.url.startsWith("http") ? item.url : `https://remoteok.com${item.url}`) : `https://remoteok.com/l/${item.id}`,
          postedAt: item.date ? new Date(item.date) : item.epoch ? new Date(item.epoch * 1000) : null,
          compensation: minSalary || maxSalary ? {
            currency: "USD",
            min: minSalary,
            max: maxSalary,
            period: "yearly",
          } : undefined,
          metadata: {
            remoteOkId: item.id,
            tags: item.tags,
          },
        });
      }

      return listings;
    } catch (err) {
      console.error("[RemoteOK] Fetch error:", err);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch("https://remoteok.com/api");
      return res.ok;
    } catch {
      return false;
    }
  }
}
