import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { blendedFactors, displayScore } from "@/lib/scoring/blended-display";
import { companyLogo } from "@/components/tracker/company-logo-registry";

describe("blended score display", () => {
  it("shows actual weighted factors from the blended score model", () => {
    expect(blendedFactors({ atsScore: 81, recencyScore: 65, locationScore: 90, salaryScore: 40, finalScore: 75 })).toEqual([
      { label: "Qualifications", weight: 55, score: 81 },
      { label: "Recency", weight: 20, score: 65 },
      { label: "Location", weight: 15, score: 90 },
      { label: "Salary", weight: 10, score: 40 },
    ]);
  });
  it("marks missing and non-finite scores unavailable, and bounds valid scores", () => {
    expect(blendedFactors({ atsScore: NaN, recencyScore: Infinity, locationScore: -10, salaryScore: 120 }).map(f => f.score)).toEqual([null, null, 0, 100]);
    expect(blendedFactors().every(f => f.score === null)).toBe(true);
    expect(displayScore(undefined)).toBeNull();
    expect(displayScore(45.6)).toBe(46);
  });
});

describe("curated company icons", () => {
  it("resolves normalized known names and exact aliases only", () => {
    expect(companyLogo("  COINBASE  ")).toBe("/company-logos/coinbase.png");
    expect(companyLogo("Coinbase, Inc.")).toBe("/company-logos/coinbase.png");
    expect(companyLogo("Coinbase Ventures")).toBeNull();
    expect(companyLogo("Unknown")).toBeNull();
    expect(companyLogo(null)).toBeNull();
  });
});


describe("curated asset provenance", () => {
  it("ships bounded PNG or ICO bytes with recorded official source URLs", () => {
    const root = process.cwd();
    const sources = JSON.parse(readFileSync(path.join(root, "public/company-logos/SOURCES.json"), "utf8")) as Record<string, { url: string; path: string; bytes: number; format: string }>;
    expect(Object.keys(sources)).toHaveLength(19);
    const domains = ["coinbase.com", "stripe.com", "shopify.com", "linear.app", "vercel.com", "anthropic.com", "openai.com", "cloudflare.com", "datadoghq.com", "wealthsimple.com", "cohere.com", "tailscale.com", "ramp.com", "google.com", "microsoft.com", "amazon.com", "apple.com", "fbcdn.net", "github.com"];
    for (const [name, source] of Object.entries(sources)) {
      expect(companyLogo(name)).toBe(`/${source.path.replace(/^public\//, "")}`);
      const url = new URL(source.url);
      expect(url.protocol).toBe("https:");
      expect(domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))).toBe(true);
      const bytes = readFileSync(path.join(root, source.path));
      expect(bytes.length).toBe(source.bytes);
      expect(bytes.length).toBeLessThanOrEqual(262144);
      if (source.format === "png") expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      else {
        expect(source.format).toBe("ico");
        expect(bytes.subarray(0, 4).toString("hex")).toBe("00000100");
      }
    }
  });
});
