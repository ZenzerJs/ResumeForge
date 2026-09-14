import { describe, it, expect } from "vitest";
import {
  H1BSponsorshipIntelSchema,
  CompanyFundingIntelSchema,
  EnrichedCompanyDossierSchema,
} from "@packages/schema/companyIntel";
import {
  normalizeCompanyIntel,
  enrichJobCardWithIntel,
  formatFundingBadge,
  formatH1BBadge,
  formatUsdCompact,
} from "../companyDossierAdapter";

describe("Public Intelligence Pipeline: H1B LCA & Venture Funding", () => {
  it("validates H1BSponsorshipIntelSchema with public DOL structure", () => {
    const validData = {
      hasHistoricalFilings: true,
      recentFilingCount: { "2024": 12, "2025": 9, "2026": 8 },
      engineeringRoleRatio: 0.85,
      sponsorConfidence: "high" as const,
      source: "US_DOL_LCA_PUBLIC" as const,
    };

    const parsed = H1BSponsorshipIntelSchema.parse(validData);
    expect(parsed.hasHistoricalFilings).toBe(true);
    expect(parsed.recentFilingCount["2026"]).toBe(8);
    expect(parsed.engineeringRoleRatio).toBe(0.85);
    expect(parsed.sponsorConfidence).toBe("high");
    expect(parsed.source).toBe("US_DOL_LCA_PUBLIC");
  });

  it("validates CompanyFundingIntelSchema across venture stages", () => {
    const validFunding = {
      stage: "Series A" as const,
      totalRaisedUsd: 405_000_000,
      latestRoundDate: "2024-05",
      leadInvestors: ["Bezos Expeditions", "Khosla Ventures"],
      estimatedRunwayMonths: 48,
    };

    const parsed = CompanyFundingIntelSchema.parse(validFunding);
    expect(parsed.stage).toBe("Series A");
    expect(parsed.totalRaisedUsd).toBe(405_000_000);
    expect(parsed.leadInvestors).toHaveLength(2);
    expect(parsed.estimatedRunwayMonths).toBe(48);
  });

  it("formats USD funding values compactly", () => {
    expect(formatUsdCompact(405_000_000)).toBe("$405M");
    expect(formatUsdCompact(11_300_000_000)).toBe("$11.3B");
    expect(formatUsdCompact(5_000_000)).toBe("$5M");
    expect(formatUsdCompact(750_000)).toBe("$750k");
  });

  it("formats funding badges for different stages", () => {
    expect(
      formatFundingBadge({
        stage: "Series A",
        totalRaisedUsd: 405_000_000,
        leadInvestors: [],
      })
    ).toBe("Series A · $405M");

    expect(
      formatFundingBadge({
        stage: "Public",
        leadInvestors: [],
      })
    ).toBe("Public");

    expect(
      formatFundingBadge({
        stage: "Bootstrapped",
        leadInvestors: [],
      })
    ).toBe("Bootstrapped");
  });

  it("formats H1B status badge with latest filing year", () => {
    expect(
      formatH1BBadge({
        hasHistoricalFilings: true,
        recentFilingCount: { "2024": 6, "2025": 14, "2026": 18 },
        engineeringRoleRatio: 0.88,
        sponsorConfidence: "high",
        source: "US_DOL_LCA_PUBLIC",
      })
    ).toBe("H1B Filings Verified (2026)");

    expect(
      formatH1BBadge({
        hasHistoricalFilings: false,
        recentFilingCount: {},
        engineeringRoleRatio: 0,
        sponsorConfidence: "unknown",
        source: "US_DOL_LCA_PUBLIC",
      })
    ).toBeNull();
  });

  it("enriches job cards with verified FieldAI intel from teardown reference", () => {
    const rawJobCard = {
      id: "job-fieldai-01",
      companyName: "Field AI",
      title: "Senior Robotics Software Engineer",
    };

    const enriched = enrichJobCardWithIntel(rawJobCard);

    expect(enriched.dossier.companySlug).toBe("fieldai");
    expect(enriched.dossier.fundingIntel?.stage).toBe("Series A");
    expect(enriched.dossier.fundingIntel?.totalRaisedUsd).toBe(405_000_000);
    expect(enriched.fundingBadge).toBe("Series A · $405M");
    expect(enriched.h1bBadge).toBe("H1B Filings Verified (2026)");
    expect(enriched.dossier.isWhiteboardFree).toBe(true);
  });

  it("gracefully enriches unknown companies with safe defaults", () => {
    const rawJobCard = {
      companyName: "Acme Stealth Startup",
      title: "Fullstack Engineer",
    };

    const enriched = enrichJobCardWithIntel(rawJobCard);

    expect(enriched.dossier.companySlug).toBe("acmestealthstartup");
    expect(enriched.dossier.displayName).toBe("Acme Stealth Startup");
    expect(enriched.fundingBadge).toBeNull();
    expect(enriched.h1bBadge).toBeNull();
    expect(enriched.dossier.isWhiteboardFree).toBe(false);
  });
});
