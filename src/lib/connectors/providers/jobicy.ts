import { safeFetch } from "../http";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

export class JobicyConnector implements ConnectorClient {
  readonly id = "jobicy" as const;
  readonly name = "Jobicy Canada Remote Feed";

  async fetchJobs(params?: { count?: number }): Promise<RawJobListing[]> {
    const count = params?.count ?? 50;
    const url = `https://jobicy.com/api/v2/remote-jobs?count=${count}&geo=canada&industry=dev`;

    try {
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const data = await res.json();
      if (!data || !Array.isArray(data.jobs)) return [];

      const listings: RawJobListing[] = [];

      for (const item of data.jobs) {
        const { html, text } = sanitizeJobPayload(item.jobDescription || item.jobExcerpt || "");
        const minSalary = typeof item.annualSalaryMin === "number" ? item.annualSalaryMin : undefined;
        const maxSalary = typeof item.annualSalaryMax === "number" ? item.annualSalaryMax : undefined;

        listings.push({
          externalId: `jobicy_${item.id}`,
          source: "jobicy",
          companyName: item.companyName || "Remote Tech",
          title: item.jobTitle || "Software Engineer",
          location: item.jobGeo || "Canada / Remote",
          isCanadianEligible: true, // Filtered with geo=canada
          workplaceType: "remote",
          descriptionHtml: html || `<p>${item.jobTitle}</p>`,
          descriptionPlain: text || item.jobTitle || "No description provided.",
          applyUrl: item.url,
          postedAt: item.pubDate ? new Date(item.pubDate) : null,
          compensation: minSalary || maxSalary ? {
            currency: item.salaryCurrency || "CAD",
            min: minSalary,
            max: maxSalary,
            period: "yearly",
          } : undefined,
          metadata: {
            jobicyId: item.id,
            jobType: item.jobType,
            jobLevel: item.jobLevel,
          },
        });
      }

      return listings;
    } catch (err) {
      console.error("[Jobicy] Fetch error:", err);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch("https://jobicy.com/api/v2/remote-jobs?count=1&geo=canada&industry=dev");
      return res.ok;
    } catch {
      return false;
    }
  }
}
