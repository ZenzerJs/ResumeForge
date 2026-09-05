import { safeFetch } from "../http";
import { filterInternshipListings } from "../internship-filter";
import { sanitizeJobPayload } from "../sanitize";
import { ConnectorClient, RawJobListing } from "../types";

export const LEVER_CURATED_BOARDS = [
  { slug: "spotify", name: "Spotify" },
  { slug: "palantir", name: "Palantir" },
  { slug: "wealthfront", name: "Wealthfront" },
  { slug: "rover", name: "Rover" },
];

function isCanadianOrRemote(locationStr: string): boolean {
  const loc = locationStr.toLowerCase();
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

export class LeverConnector implements ConnectorClient {
  readonly id = "lever" as const;
  readonly name = "Lever Postings API";

  async fetchJobs(params?: { boards?: string[]; includeAllRoles?: boolean }): Promise<RawJobListing[]> {
    const targetBoards = params?.boards
      ? LEVER_CURATED_BOARDS.filter((b) => params.boards!.includes(b.slug))
      : LEVER_CURATED_BOARDS;

    const results: RawJobListing[] = [];

    for (const board of targetBoards) {
      try {
        const url = `https://api.lever.co/v0/postings/${board.slug}?mode=json`;
        const res = await safeFetch(url);
        if (!res.ok) continue;

        const data = await res.json();
        if (!Array.isArray(data)) continue;

        for (const item of data) {
          const location = item.categories?.location || "Canada / Remote";
          const rawCombinedHtml = `${item.description || ""}<br/>${item.additional || ""}`;
          const { html, text } = sanitizeJobPayload(rawCombinedHtml);
          const isRemote =
            location.toLowerCase().includes("remote") ||
            item.categories?.workplaceType === "remote" ||
            (item.text && item.text.toLowerCase().includes("remote"));

          results.push({
            externalId: `lever_${board.slug}_${item.id}`,
            source: "lever",
            companyName: board.name,
            title: item.text || "Software Engineer",
            location,
            isCanadianEligible: isCanadianOrRemote(location),
            workplaceType: isRemote ? "remote" : "unspecified",
            descriptionHtml: html || `<p>${item.text}</p>`,
            descriptionPlain: text || item.descriptionPlain || item.text || "No description provided.",
            applyUrl: item.hostedUrl || item.applyUrl || `https://jobs.lever.co/${board.slug}/${item.id}`,
            postedAt: item.createdAt ? new Date(item.createdAt) : null,
            metadata: {
              boardSlug: board.slug,
              leverId: item.id,
              commitment: item.categories?.commitment,
              team: item.categories?.team,
            },
          });
        }
      } catch (err) {
        console.error(`[Lever] Failed board ${board.slug}:`, err);
      }
    }

    return filterInternshipListings(results, { includeAllRoles: params?.includeAllRoles });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await safeFetch("https://api.lever.co/v0/postings/spotify?mode=json");
      return res.ok;
    } catch {
      return false;
    }
  }
}
