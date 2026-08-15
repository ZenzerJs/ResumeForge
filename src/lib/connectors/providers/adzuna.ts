import { safeFetch } from "../http";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

export class AdzunaCaConnector implements ConnectorClient {
  readonly id = "adzuna_ca" as const;
  readonly name = "Adzuna Canada API";

  private getCredentials(): { appId: string; appKey: string } | null {
    const appId = process.env.ADZUNA_APP_ID?.trim();
    const appKey = process.env.ADZUNA_APP_KEY?.trim();
    if (!appId || !appKey) return null;
    return { appId, appKey };
  }

  async fetchJobs(params?: { page?: number; query?: string }): Promise<RawJobListing[]> {
    const creds = this.getCredentials();
    if (!creds) {
      console.info("[AdzunaCA] Skipping: ADZUNA_APP_ID or ADZUNA_APP_KEY not set in environment.");
      return [];
    }

    const page = params?.page ?? 1;
    const what = encodeURIComponent(params?.query ?? "software developer");
    const url = `https://api.adzuna.com/v1/api/jobs/ca/search/${page}?app_id=${creds.appId}&app_key=${creds.appKey}&results_per_page=50&what=${what}`;

    try {
      const res = await safeFetch(url);
      if (!res.ok) return [];

      const data = await res.json();
      if (!data || !Array.isArray(data.results)) return [];

      const listings: RawJobListing[] = [];

      for (const item of data.results) {
        const company = item.company?.display_name || "Confidential";
        const location = item.location?.display_name || "Canada";
        const { html, text } = sanitizeJobPayload(item.description || "");
        const isRemote =
          (item.title && item.title.toLowerCase().includes("remote")) ||
          location.toLowerCase().includes("remote");

        listings.push({
          externalId: `adzuna_ca_${item.id}`,
          source: "adzuna_ca",
          companyName: company,
          title: item.title || "Software Developer",
          location,
          isCanadianEligible: true, // Adzuna CA endpoint is strictly Canadian
          workplaceType: isRemote ? "remote" : "unspecified",
          descriptionHtml: html || `<p>${item.description}</p>`,
          descriptionPlain: text || item.description || "No description provided.",
          applyUrl: item.redirect_url || `https://www.adzuna.ca/land/ad/${item.id}`,
          postedAt: item.created ? new Date(item.created) : null,
          compensation: item.salary_min || item.salary_max ? {
            currency: "CAD",
            min: item.salary_min ? Math.round(item.salary_min) : undefined,
            max: item.salary_max ? Math.round(item.salary_max) : undefined,
            period: "yearly",
          } : undefined,
          metadata: {
            adzunaId: item.id,
            category: item.category?.label,
            latitude: item.latitude,
            longitude: item.longitude,
          },
        });
      }

      return listings;
    } catch (err) {
      console.error("[AdzunaCA] Fetch error:", err);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    const creds = this.getCredentials();
    if (!creds) return false;
    try {
      const url = `https://api.adzuna.com/v1/api/jobs/ca/search/1?app_id=${creds.appId}&app_key=${creds.appKey}&results_per_page=1&what=developer`;
      const res = await safeFetch(url);
      return res.ok;
    } catch {
      return false;
    }
  }
}
