import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { activeStore } from "@/lib/db-mock";
import { computeIngestedJobEnrichment } from "@/lib/connectors/enrichment";
import { createJob, getJobsList } from "@/lib/db/jobs";
import { upsertApplication } from "@/lib/db/applications";
import { GET as connectorsJobsGET } from "@/app/api/connectors/jobs/route";
import { GET as jobsGET } from "@/app/api/jobs/route";
import { authedRequest, createTestUser } from "./helpers/auth";
import {
  arePostingLocationsCompatible,
  buildDiscoverDisambiguators,
  buildTrackerDisambiguators,
  collapseDuplicateIngestedJobs,
  collapseDuplicateTrackerJobs,
  extractRequisitionUrl,
  hasJobSavedApplicationHistory,
} from "@/lib/jobs/posting-identity";
import {
  canAutoHydrateTrackerJobs,
  type JobItem,
} from "@/components/tracker/tracker-feed";
import { JobListRow } from "@/components/tracker/job-list-row";
import { TrackerSubNav } from "@/components/tracker/tracker-sub-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/tracker",
}));

const ROOT = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("Tracker UX Remediation & Deduplication", () => {
  beforeEach(() => {
    activeStore.ingestedJob = [];
    activeStore.job = [];
    activeStore.jobApplication = [];
    activeStore.applicationEvent = [];
    activeStore.resume = [];
    activeStore.resumeVariant = [];
    activeStore.coverLetter = [];
    activeStore.patchProposalBatch = [];
    activeStore.user = [];
    activeStore.evidenceItem = [];
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("1. Tracker controls, Kanban fluid layout, sub-nav, and typography", () => {
    it("uses explicit h-11 (py-0 leading-normal), shortened mobile location placeholder, and DESIGN.md text scale in tracker-feed.tsx", () => {
      const src = readProjectFile("src/components/tracker/tracker-feed.tsx");
      expect(src).toContain("h-11 py-0 leading-normal");
      expect(src).not.toContain("text-[12.5px]");
      expect(src).toContain('placeholder="City (Toronto)"');
      expect(src).toContain("xl:grid xl:grid-cols-5 xl:overflow-x-visible xl:snap-none");
      expect(src).toContain(
        "xl:w-full xl:max-w-none xl:min-w-0 xl:shrink xl:snap-align-none"
      );
    });

    it("renders compact <640px labels, scroll-fade affordance, and aligned tab indicator in tracker-sub-nav.tsx", () => {
      const src = readProjectFile("src/components/tracker/tracker-sub-nav.tsx");
      expect(src).toContain("tracker-sub-nav-scroll-fade");
      expect(src).toContain("ResizeObserver");
      expect(src).toContain("scrollIntoView");

      const html = renderToStaticMarkup(React.createElement(TrackerSubNav));
      expect(html).toContain('data-testid="tracker-tab-feed"');
      expect(html).toContain('data-testid="tracker-tab-all"');
      expect(html).toContain('data-testid="tracker-tab-applied"');
      expect(html).toContain('data-testid="tracker-tab-saved"');
      expect(html).toContain('data-testid="tracker-tab-outcomes"');
      expect(html).toContain('data-testid="tracker-sub-nav-indicator"');
      expect(html).toContain(">Discover<");
      expect(html).toContain(">All<");
      expect(html).toContain("Applied");
      expect(html).toContain("Saved");
      expect(html).toContain("Outcomes");
    });

    it("uses text-body-dense in job-list-row.tsx and preserves distinct /tailor?jobId links and disambiguators", () => {
      const rowSrc = readProjectFile("src/components/tracker/job-list-row.tsx");
      expect(rowSrc).not.toContain("text-[13.5px]");
      expect(rowSrc).toContain("text-body-dense");

      const jobA: JobItem = {
        id: "job-alpha-1",
        company: "Acme Corp",
        roleTitle: "Software Engineer",
        source: "greenhouse",
        status: "SAVED",
        createdAt: "2026-11-17T00:00:00.000Z",
        notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/101",
        extractedRequirements: { requiredSkills: [], preferredSkills: [], domainTerms: [] },
      };
      const jobB: JobItem = {
        id: "job-beta-2",
        company: "Acme Corp",
        roleTitle: "Software Engineer",
        source: "greenhouse",
        status: "SAVED",
        createdAt: "2026-11-17T00:00:00.000Z",
        notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/202",
        extractedRequirements: { requiredSkills: [], preferredSkills: [], domainTerms: [] },
      };

      const disambig = buildTrackerDisambiguators([jobA, jobB]);
      expect(disambig.get(jobA.id)).toBe("Req #101");
      expect(disambig.get(jobB.id)).toBe("Req #202");

      const htmlA = renderToStaticMarkup(
        React.createElement(JobListRow, {
          job: jobA,
          isSelected: true,
          isUpdatingStatus: false,
          isFetchingFullText: false,
          disambiguator: disambig.get(jobA.id),
          onSelect: () => {},
          onStatusChange: () => {},
          onFetchFullText: () => {},
          onDelete: () => {},
          onToggleNotes: () => {},
        })
      );
      const htmlB = renderToStaticMarkup(
        React.createElement(JobListRow, {
          job: jobB,
          isSelected: false,
          isUpdatingStatus: false,
          isFetchingFullText: false,
          disambiguator: disambig.get(jobB.id),
          onSelect: () => {},
          onStatusChange: () => {},
          onFetchFullText: () => {},
          onDelete: () => {},
          onToggleNotes: () => {},
        })
      );

      expect(htmlA).toContain("text-body-dense");
      expect(htmlA).toContain("/tailor?jobId=job-alpha-1");
      expect(htmlA).toContain("Req #101");
      expect(htmlB).toContain("/tailor?jobId=job-beta-2");
      expect(htmlB).toContain("Req #202");
    });
  });

  describe("2. Hydration auth gating", () => {
    it("blocks POST /api/jobs/hydrate until authentication is resolved and never fires for self-hosted guests or demo guests", () => {
      // Pending auth must block hydration
      expect(
        canAutoHydrateTrackerJobs({ isLoading: false, isDemoMode: false, authStatus: "pending" })
      ).toBe(false);

      // Signed-out self-hosted guest (DEMO_MODE=false) must trigger zero hydrate requests
      expect(
        canAutoHydrateTrackerJobs({ isLoading: false, isDemoMode: false, authStatus: "guest" })
      ).toBe(false);

      // Public-demo guest (DEMO_MODE=true) must trigger zero hydrate requests
      expect(
        canAutoHydrateTrackerJobs({ isLoading: false, isDemoMode: true, authStatus: "guest" })
      ).toBe(false);
      expect(
        canAutoHydrateTrackerJobs({ isLoading: false, isDemoMode: true, authStatus: "authenticated" })
      ).toBe(false);

      // Loading list must wait
      expect(
        canAutoHydrateTrackerJobs({ isLoading: true, isDemoMode: false, authStatus: "authenticated" })
      ).toBe(false);

      // Eligible signed-in user in self-hosted mode allows hydration
      expect(
        canAutoHydrateTrackerJobs({ isLoading: false, isDemoMode: false, authStatus: "authenticated" })
      ).toBe(true);

      const src = readProjectFile("src/components/tracker/tracker-feed.tsx");
      expect(src).toContain("canAutoHydrateTrackerJobs({ isLoading, isDemoMode, authStatus })");
      expect(src).toContain("fetchSessionUser()");
    });
  });

  describe("3. Posting identity, requisition URL extraction, and feed deduplication", () => {
    it("extracts requisition-bearing URLs while returning null for generic careers/jobs URLs", () => {
      expect(
        extractRequisitionUrl("https://job-boards.greenhouse.io/stripe/jobs/555123?utm_source=x&gh_src=y")
      ).toBe("boards.greenhouse.io/stripe/jobs/555123");
      expect(
        extractRequisitionUrl("https://boards.greenhouse.io/stripe/jobs/555123/")
      ).toBe("boards.greenhouse.io/stripe/jobs/555123");
      expect(
        extractRequisitionUrl("https://jobs.lever.co/spotify/abc-123-def/apply?lever-source=web")
      ).toBe("jobs.lever.co/spotify/abc-123-def");
      expect(
        extractRequisitionUrl("https://stripe.com/jobs/search?gh_jid=998877&utm_medium=social")
      ).toBe("stripe.com/jobs/search?gh_jid=998877");

      // Generic landing URLs must not match as requisition-bearing
      expect(extractRequisitionUrl("https://example.com/jobs")).toBeNull();
      expect(extractRequisitionUrl("https://acme.com/careers")).toBeNull();
      expect(extractRequisitionUrl("https://boards.greenhouse.io/stripe")).toBeNull();
    });

    it("compares locations compatibly across formatting differences while keeping distinct cities separate", () => {
      expect(arePostingLocationsCompatible("Toronto, ON", "Toronto, Ontario")).toBe(true);
      expect(arePostingLocationsCompatible("Toronto, ON", "")).toBe(true);
      expect(arePostingLocationsCompatible("Toronto, ON", "Canada")).toBe(true);
      expect(arePostingLocationsCompatible("Toronto, ON", "Vancouver, BC")).toBe(false);
      expect(arePostingLocationsCompatible("San Jose, CA", "Seattle, WA")).toBe(false);
    });

    it("collapses duplicate Tracker source postings before paging/counts while preserving separate saved history and distinct same-title postings", async () => {
      const { user, cookie } = await createTestUser();

      // 1 duplicate source posting (2 untouched rows sharing requisition URL)
      await createJob({
        userId: user.id,
        company: "Stripe",
        roleTitle: "Platform Engineer",
        rawDescription: "[Pending Import] Full job description text not yet fetched.",
        source: "simplify-jobs",
        notes:
          "Tier 1 Bulk Import | Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/stripe/jobs/7001?utm_source=gh",
      });
      const savedDup = await prisma.job.create({
        data: {
          userId: user.id,
          company: "Stripe",
          roleTitle: "Platform Engineer",
          rawDescription: "Full description requiring TypeScript and Go.",
          source: "greenhouse",
          notes:
            "Ingested from GREENHOUSE | Location: Toronto, ON | Apply Link: https://job-boards.greenhouse.io/stripe/jobs/7001",
        },
      });
      await upsertApplication(user.id, savedDup.id, { status: "APPLIED" });

      // 2 distinct same-title postings (different requisition IDs and/or locations)
      const distinctA = await createJob({
        userId: user.id,
        company: "Acme",
        roleTitle: "Software Engineer",
        rawDescription: "Full description Toronto team.",
        source: "pasted",
        notes: "Location: Toronto, ON | Apply Link: https://boards.greenhouse.io/acme/jobs/111",
      });
      const distinctB = await createJob({
        userId: user.id,
        company: "Acme",
        roleTitle: "Software Engineer",
        rawDescription: "Full description Vancouver team.",
        source: "pasted",
        notes: "Location: Vancouver, BC | Apply Link: https://boards.greenhouse.io/acme/jobs/222",
      });

      const listRes = await jobsGET(
        authedRequest("http://localhost:3000/api/jobs?limit=40&page=1", { method: "GET" }, cookie)
      );
      expect(listRes.status).toBe(200);
      const listJson = await listRes.json();

      // 4 rows in DB -> 1 duplicate collapsed -> 3 visible & total=3
      expect(listJson.meta.total).toBe(3);
      expect(listJson.meta.counts).toEqual({ applied: 1, interviewing: 0 });
      const returnedIds = (listJson.data as Array<{ id: string }>).map((j) => j.id);
      expect(returnedIds).toContain(savedDup.id);
      expect(returnedIds).toContain(distinctA.id);
      expect(returnedIds).toContain(distinctB.id);

      // Separately saved applications/notes/statuses/variants on same URL must BOTH be preserved
      const sep1 = await createJob({
        userId: user.id,
        company: "Cohere",
        roleTitle: "ML Engineer",
        rawDescription: "PyTorch and TypeScript.",
        notes:
          "Location: Toronto, ON | Apply Link: https://jobs.ashbyhq.com/cohere/req-999 | Applied via referral",
      });
      const sep2 = await createJob({
        userId: user.id,
        company: "Cohere",
        roleTitle: "ML Engineer",
        rawDescription: "PyTorch and TypeScript.",
        notes:
          "Location: Toronto, ON | Apply Link: https://jobs.ashbyhq.com/cohere/req-999 | Second team follow-up",
      });
      await upsertApplication(user.id, sep1.id, { status: "APPLIED" });
      await upsertApplication(user.id, sep2.id, { status: "INTERVIEWING" });

      expect(hasJobSavedApplicationHistory({ ...sep1, status: "APPLIED" })).toBe(true);
      const cohereList = await getJobsList({ userId: user.id, q: "Cohere" });
      expect(cohereList.meta.total).toBe(2);
      expect(cohereList.meta.counts).toEqual({ applied: 2, interviewing: 1 });
      expect(cohereList.data.map((d) => d.id)).toEqual(expect.arrayContaining([sep1.id, sep2.id]));

      // Newly pasted SAVED personal job (no requisition URL) must stay visible alongside an earlier APPLIED job with the same company/title
      const olderAppliedPasted = await createJob({
        userId: user.id,
        company: "Stripe",
        roleTitle: "Staff Software Engineer",
        rawDescription: "TypeScript, Node.js, Distributed Systems",
        source: "pasted",
      });
      await upsertApplication(user.id, olderAppliedPasted.id, { status: "APPLIED" });

      const newerSavedPasted = await createJob({
        userId: user.id,
        company: "Stripe",
        roleTitle: "Staff Software Engineer",
        rawDescription: "TypeScript, Node.js, Distributed Systems",
        source: "pasted",
      });

      const stripeStaffList = await getJobsList({
        userId: user.id,
        q: "Staff Software Engineer",
      });
      const stripeIds = stripeStaffList.data.map((d) => d.id);
      expect(stripeIds).toContain(olderAppliedPasted.id);
      expect(stripeIds).toContain(newerSavedPasted.id);
    });

    it("preserves both rows in collapseDuplicateTrackerJobs when both carry variants or notes, and collapses untouched duplicates", () => {
      const untouchedDup = {
        id: "dup-untouched",
        company: "Linear",
        roleTitle: "Product Engineer",
        notes: "Tier 1 Bulk Import | Location: Remote | Apply Link: https://jobs.ashbyhq.com/linear/abc-123",
        rawDescription: "[Pending Import]",
        status: "SAVED",
        createdAt: "2026-11-16T00:00:00.000Z",
      };
      const withVariant = {
        id: "dup-with-variant",
        company: "Linear",
        roleTitle: "Product Engineer",
        notes: "Ingested from ASHBY | Location: Remote | Apply Link: https://jobs.ashbyhq.com/linear/abc-123/application",
        rawDescription: "Build fast UI with TypeScript.",
        status: "SAVED",
        variants: [{ id: "var-1", variantTitle: "Linear UI Cut" }],
        createdAt: "2026-11-15T00:00:00.000Z",
      };

      const collapsed = collapseDuplicateTrackerJobs([untouchedDup, withVariant]);
      expect(collapsed).toHaveLength(1);
      expect(collapsed[0]!.id).toBe("dup-with-variant");

      const secondWithNotes = {
        id: "dup-with-notes",
        company: "Linear",
        roleTitle: "Product Engineer",
        notes: "Location: Remote | Apply Link: https://jobs.ashbyhq.com/linear/abc-123 | Recruiter screen scheduled",
        rawDescription: "Build fast UI with TypeScript.",
        status: "SAVED",
        createdAt: "2026-11-17T00:00:00.000Z",
      };
      const preserved = collapseDuplicateTrackerJobs([withVariant, secondWithNotes]);
      expect(preserved).toHaveLength(2);
    });

    it("collapses duplicate IngestedJob postings in /api/connectors/jobs before paging/counts while keeping distinct same-title postings", async () => {
      const now = new Date();
      const enrich = computeIngestedJobEnrichment({
        description: "Required: TypeScript, React",
        location: "Toronto, ON",
      });

      // Duplicate pair 1: same Greenhouse requisition ingested twice (different sources / tracking params)
      await prisma.ingestedJob.create({
        data: {
          id: "ing-dup-1",
          fingerprint: "fp-ing-dup-1",
          externalId: "gh_stripe_800",
          source: "GREENHOUSE",
          companyName: "Stripe",
          title: "Frontend Engineer",
          location: "Toronto, ON",
          workplaceType: "HYBRID",
          isCanadianEligible: true,
          description: "Required: TypeScript, React",
          descriptionHtml: "<p>Required: TypeScript, React</p>",
          applyUrl: "https://boards.greenhouse.io/stripe/jobs/800?utm_source=gh",
          postedAt: now,
          createdAt: now,
          lat: enrich.lat,
          lng: enrich.lng,
          cityNorm: enrich.cityNorm,
          parsedRequirements: enrich.parsedRequirements,
        },
      });
      await prisma.ingestedJob.create({
        data: {
          id: "ing-dup-2",
          fingerprint: "fp-ing-dup-2",
          externalId: "adzuna_800",
          source: "ADZUNA_CA",
          companyName: "Stripe",
          title: "Frontend Engineer (Toronto)",
          location: "Toronto, Ontario",
          workplaceType: "HYBRID",
          isCanadianEligible: true,
          description: "Required: TypeScript, React",
          descriptionHtml: "<p>Required: TypeScript, React</p>",
          applyUrl: "https://job-boards.greenhouse.io/stripe/jobs/800",
          postedAt: new Date(now.getTime() - 1000),
          createdAt: new Date(now.getTime() - 1000),
          lat: enrich.lat,
          lng: enrich.lng,
          cityNorm: enrich.cityNorm,
          parsedRequirements: enrich.parsedRequirements,
        },
      });

      // Two distinct same-title postings in the same city with different requisition IDs
      await prisma.ingestedJob.create({
        data: {
          id: "ing-distinct-a",
          fingerprint: "fp-ing-dist-a",
          externalId: "gh_acme_101",
          source: "GREENHOUSE",
          companyName: "Acme",
          title: "Backend Engineer",
          location: "Toronto, ON",
          workplaceType: "ON_SITE",
          isCanadianEligible: true,
          description: "Required: TypeScript, React",
          descriptionHtml: "<p>Required: TypeScript, React</p>",
          applyUrl: "https://boards.greenhouse.io/acme/jobs/101",
          postedAt: now,
          createdAt: now,
          lat: enrich.lat,
          lng: enrich.lng,
          cityNorm: enrich.cityNorm,
          parsedRequirements: enrich.parsedRequirements,
        },
      });
      await prisma.ingestedJob.create({
        data: {
          id: "ing-distinct-b",
          fingerprint: "fp-ing-dist-b",
          externalId: "gh_acme_102",
          source: "GREENHOUSE",
          companyName: "Acme",
          title: "Backend Engineer",
          location: "Toronto, ON",
          workplaceType: "ON_SITE",
          isCanadianEligible: true,
          description: "Required: TypeScript, React",
          descriptionHtml: "<p>Required: TypeScript, React</p>",
          applyUrl: "https://boards.greenhouse.io/acme/jobs/102",
          postedAt: now,
          createdAt: now,
          lat: enrich.lat,
          lng: enrich.lng,
          cityNorm: enrich.cityNorm,
          parsedRequirements: enrich.parsedRequirements,
        },
      });

      const res = await connectorsJobsGET(
        new NextRequest("http://localhost/api/connectors/jobs?limit=10&page=1")
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.meta.total).toBe(3);
      expect(json.data).toHaveLength(3);

      const ids = (json.data as Array<{ id: string }>).map((d) => d.id);
      expect(ids).toContain("ing-distinct-a");
      expect(ids).toContain("ing-distinct-b");
      // Exactly one of the Stripe duplicates survived
      expect(ids.filter((id) => id.startsWith("ing-dup-"))).toHaveLength(1);

      const disambig = buildDiscoverDisambiguators(json.data);
      expect(disambig.get("ing-distinct-a")).toBe("Req #101");
      expect(disambig.get("ing-distinct-b")).toBe("Req #102");

      // Also verify collapseDuplicateIngestedJobs preserves distinct generic-URL rows with different externalIds
      const genericRows = [
        {
          id: "g1",
          externalId: "ext-1",
          source: "GREENHOUSE",
          companyName: "Example Studio",
          title: "Engineer 1",
          location: "Toronto, ON",
          applyUrl: "https://example.com/jobs",
        },
        {
          id: "g2",
          externalId: "ext-2",
          source: "GREENHOUSE",
          companyName: "Example Studio",
          title: "Engineer 1",
          location: "Toronto, ON",
          applyUrl: "https://example.com/jobs",
        },
      ];
      expect(collapseDuplicateIngestedJobs(genericRows)).toHaveLength(2);
    });
  });
});
