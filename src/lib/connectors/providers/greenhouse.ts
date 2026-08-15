import { safeFetch } from "../http";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

export const GREENHOUSE_CURATED_BOARDS = [
  { slug: "shopify", name: "Shopify" },
  { slug: "wealthsimple", name: "Wealthsimple" },
  { slug: "1password", name: "1Password" },
  { slug: "ada", name: "Ada" },
  { slug: "clio", name: "Clio" },
  { slug: "bench", name: "Bench" },
  { slug: "koho", name: "KOHO" },
  { slug: "relationalai", name: "RelationalAI" },
];

function isCanadianOrRemote(locationStr: string): boolean {
  const loc = locationStr.toLowerCase();
  if (
    loc.includes("canada") ||
    loc.includes("toronto") ||
    loc.includes("vancouver") ||
    loc.includes("montreal") ||
    loc.includes("ottawa") ||
    loc.includes("calgary") ||
    loc.includes("edmonton") ||
    loc.includes("waterloo") ||
    loc.includes("remote") ||
    loc.includes("anywhere") ||
    loc.includes("americas") ||
    loc.includes("north america")
  ) {
    return true;
  }
  return false;
}

export class GreenhouseConnector implements ConnectorClient {
  readonly id = "greenhouse" as const;
  readonly name = "Greenhouse Boards API";

  async fetchJobs(params?: { boards?: string[] }): Promise<RawJobListing[]> {
    const targetBoards = params?.boards
      ? GREENHOUSE_CURATED_BOARDS.filter((b) => params.boards!.includes(b.slug))
      : GREENHOUSE_CURATED_BOARDS;

    const results: RawJobListing[] = [];

    for (const board of targetBoards) {
      try {
        const url = `https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs?content=true`;
        const res = await safeFetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        if (!data || !Array.isArray(data.jobs)) continue;

        for (const item of data.jobs) {
          const location = item.location?.name || "Canada / Remote";
          const { html, text } = sanitizeJobPayload(item.content || "");
          const isRemote =
            location.toLowerCase().includes("remote") ||
            (item.title && item.title.toLowerCase().includes("remote"));

          results.push({
            externalId: `gh_${board.slug}_${item.id}`,
            source: "greenhouse",
            companyName: board.name,
            title: item.title || "Software Engineer",
            location,
            isCanadianEligible: isCanadianOrRemote(location),
            workplaceType: isRemote ? "remote" : "unspecified",
            descriptionHtml: html || `<p>${item.title}</p>`,
            descriptionPlain: text || item.title || "No description provided.",
            applyUrl: item.absolute_url,
            postedAt: item.updated_at ? new Date(item.updated_at) : null,
            metadata: {
              boardSlug: board.slug,
              greenhouseJobId: item.id,
              internalJobId: item.internal_job_id,
            },
          });
        }
      } catch (err) {
        // Continue to other boards if one fails
        console.error(`[Greenhouse] Failed board ${board.slug}:`, err);
      }
    }

    return results;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch("https://boards-api.greenhouse.io/v1/boards/shopify/jobs");
      return res.ok;
    } catch {
      return false;
    }
  }
}
