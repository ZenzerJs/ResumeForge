import { safeFetch } from "../http";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

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

export class RemotiveConnector implements ConnectorClient {
  readonly id = "remotive" as const;
  readonly name = "Remotive Software Dev Feed";

  async fetchJobs(): Promise<RawJobListing[]> {
    const url = "https://remotive.com/api/remote-jobs?category=software-dev";

    try {
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const data = await res.json();
      if (!data || !Array.isArray(data.jobs)) return [];

      const listings: RawJobListing[] = [];

      for (const item of data.jobs) {
        const location = item.candidate_required_location || "Worldwide Remote";
        const isEligible = isCanadianOrWorldwide(location);
        const { html, text } = sanitizeJobPayload(item.description || "");

        listings.push({
          externalId: `remotive_${item.id}`,
          source: "remotive",
          companyName: item.company_name || "Remote Company",
          title: item.title || "Software Developer",
          location,
          isCanadianEligible: isEligible,
          workplaceType: "remote",
          descriptionHtml: html || `<p>${item.title}</p>`,
          descriptionPlain: text || item.title || "No description provided.",
          applyUrl: item.url,
          postedAt: item.publication_date ? new Date(item.publication_date) : null,
          metadata: {
            remotiveId: item.id,
            jobType: item.job_type,
            salaryString: item.salary,
            tags: item.tags,
          },
        });
      }

      return listings;
    } catch (err) {
      console.error("[Remotive] Fetch error:", err);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch("https://remotive.com/api/remote-jobs?limit=1");
      return res.ok;
    } catch {
      return false;
    }
  }
}
