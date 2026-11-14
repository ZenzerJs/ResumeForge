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
    expect(companyLogo("Figma, Inc.")).toBe("/company-logos/figma.png");
    expect(companyLogo("Databricks")).toBe("/company-logos/databricks.ico");
    expect(companyLogo("Databricks Ventures")).toBeNull();
    expect(companyLogo("Coinbase Ventures")).toBeNull();
    expect(companyLogo("Unknown")).toBeNull();
    expect(companyLogo("constructor")).toBeNull();
    expect(companyLogo(null)).toBeNull();
  });
});


describe("curated asset provenance", () => {
  it("ships bounded PNG or ICO bytes with recorded official source URLs", () => {
    const root = process.cwd();
    const sources = JSON.parse(readFileSync(path.join(root, "public/company-logos/SOURCES.json"), "utf8")) as Record<string, { url: string; path: string; bytes: number; format: string }>;
    // Each recorded host was reviewed for the named employer; do not accept arbitrary CDNs.
    const officialHosts: Record<string, string> = {
      "coinbase": "www.coinbase.com",
      "stripe": "stripe.com",
      "shopify": "cdn.shopify.com",
      "linear": "linear.app",
      "vercel": "assets.vercel.com",
      "anthropic": "www.anthropic.com",
      "openai": "developers.openai.com",
      "cloudflare": "www.cloudflare.com",
      "datadog": "www.datadoghq.com",
      "wealthsimple": "www.wealthsimple.com",
      "cohere": "cohere.com",
      "tailscale": "tailscale.com",
      "ramp": "ramp.com",
      "google": "www.google.com",
      "microsoft": "learn.microsoft.com",
      "amazon": "www.amazon.com",
      "apple": "www.apple.com",
      "meta": "static.xx.fbcdn.net",
      "github": "github.com",
      "twilio": "www.twilio.com",
      "wealthfront": "www.wealthfront.com",
      "netflix": "www.netflix.com",
      "salesforce": "www.salesforce.com",
      "oracle": "www.oracle.com",
      "ibm": "www.ibm.com",
      "cisco": "www.cisco.com",
      "lyft": "www.lyft.com",
      "instacart": "www.instacart.com",
      "pinterest": "www.pinterest.com",
      "roblox": "www.roblox.com",
      "unity": "unity.com",
      "epic games": "www.epicgames.com",
      "box": "box.com",
      "mongodb": "www.mongodb.com",
      "gitlab": "gitlab.com",
      "robinhood": "www.robinhood.com",
      "scotiabank": "www.scotiabank.com",
      "bmo": "www.bmo.com",
      "workday": "www.workday.com",
      "hubspot": "www.hubspot.com",
      "accenture": "www.accenture.com",
      "figma": "static.figma.com",
      "databricks": "docs.databricks.com",
      "elastic": "www.elastic.co",
      "adobe": "help.adobe.com",
      "amd": "docs.amd.com",
      "atlassian": "docs.atlassian.com",
      "docker": "docs.docker.com",
      "mastercard": "developer.mastercard.com",
      "american express": "developer.americanexpress.com",
      "intuit": "developer.intuit.com",
      "zapier": "cdn.zapier.com",
      "retool": "docs.retool.com",
      "tesla": "developer.tesla.com",
      "spotify": "open.spotifycdn.com",
      "paypal": "www.paypalobjects.com",
      "twitch": "assets.twitch.tv",
      "hootsuite": "www.hootsuite.com",
      "deel": "www.deel.com",
      "plaid": "plaid.com",
      "nvidia": "developer.nvidia.com",
      "notion": "www.notion.com",
      "palantir": "www.palantir.com",
      "1password": "1password.com",
    };
    expect(Object.keys(sources).sort()).toEqual(Object.keys(officialHosts).sort());
    for (const [name, source] of Object.entries(sources)) {
      expect(companyLogo(name)).toBe(`/${source.path.replace(/^public\//, "")}`);
      const url = new URL(source.url);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe(officialHosts[name]);
      expect(source.path).toMatch(/^public\/company-logos\/[a-z0-9-]+\.(?:png|ico)$/);
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
