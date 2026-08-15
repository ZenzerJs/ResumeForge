import { safeFetch } from "../http";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

export const ASHBY_CURATED_BOARDS = [
  { slug: "cohere", name: "Cohere" },
  { slug: "dropbox", name: "Dropbox" },
  { slug: "linear", name: "Linear" },
  { slug: "deel", name: "Deel" },
  { slug: "ramp", name: "Ramp" },
];

function isCanadianOrRemote(locationStr: string, isRemoteFlag?: boolean): boolean {
  if (isRemoteFlag) return true;
  const loc = (locationStr || "").toLowerCase();
  return (
    loc.includes("canada") ||
    loc.includes("toronto") ||
    loc.includes("vancouver") ||
    loc.includes("montreal") ||
    loc.includes("calgary") ||
    loc.includes("remote") ||
    loc.includes("anywhere") ||
    loc.includes("north america")
  );
}

export class AshbyConnector implements ConnectorClient {
  readonly id = "ashby" as const;
  readonly name = "Ashby Job Board API";

  async fetchJobs(params?: { boards?: string[] }): Promise<RawJobListing[]> {
    const targetBoards = params?.boards
      ? ASHBY_CURATED_BOARDS.filter((b) => params.boards!.includes(b.slug))
      : ASHBY_CURATED_BOARDS;

    const results: RawJobListing[] = [];

    for (const board of targetBoards) {
      try {
        const url = `https://api.ashbyhq.com/posting-api/job-board/${board.slug}?includeCompensation=true`;
        const res = await safeFetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        if (!data || !Array.isArray(data.jobs)) continue;

        for (const item of data.jobs) {
          const location = item.locationName || item.location || "Remote";
          const isRemote = Boolean(item.isRemote || location.toLowerCase().includes("remote"));
          const { html, text } = sanitizeJobPayload(item.descriptionHtml || item.descriptionPlain || "");

          let compMin: number | undefined;
          let compMax: number | undefined;
          let compCurrency: string = "CAD";

          if (item.compensation?.compensationTiers && Array.isArray(item.compensation.compensationTiers) && item.compensation.compensationTiers.length > 0) {
            const tier = item.compensation.compensationTiers[0];
            if (tier.minSalary) compMin = Math.round(tier.minSalary);
            if (tier.maxSalary) compMax = Math.round(tier.maxSalary);
            if (tier.currency) compCurrency = tier.currency;
          }

          results.push({
            externalId: `ashby_${board.slug}_${item.id}`,
            source: "ashby",
            companyName: board.name,
            title: item.title || "Software Engineer",
            location,
            isCanadianEligible: isCanadianOrRemote(location, isRemote),
            workplaceType: isRemote ? "remote" : "unspecified",
            descriptionHtml: html || `<p>${item.title}</p>`,
            descriptionPlain: text || item.descriptionPlain || item.title || "No description provided.",
            applyUrl: item.jobUrl || `https://jobs.ashbyhq.com/${board.slug}/${item.id}`,
            postedAt: item.publishedAt ? new Date(item.publishedAt) : null,
            compensation: compMin || compMax ? {
              currency: compCurrency,
              min: compMin,
              max: compMax,
              period: "yearly",
            } : undefined,
            metadata: {
              boardSlug: board.slug,
              ashbyId: item.id,
              department: item.department,
              team: item.team,
            },
          });
        }
      } catch (err) {
        console.error(`[Ashby] Failed board ${board.slug}:`, err);
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch("https://api.ashbyhq.com/posting-api/job-board/cohere");
      return res.ok;
    } catch {
      return false;
    }
  }
}
