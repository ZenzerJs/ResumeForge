import { describe, it, expect } from "vitest";
import { normalizeCompany } from "@/lib/company";
import {
  parseObservedDate,
  cleanCell,
  parseMarkdownTable,
} from "../scripts/sync-oa-bank";

describe("Company Name Normalization (lib/company.ts)", () => {
  it("normalizes standard company names to lowercase alphanumeric", () => {
    expect(normalizeCompany("Amazon")).toBe("amazon");
    expect(normalizeCompany("Meta")).toBe("meta");
    expect(normalizeCompany("Google")).toBe("google");
    expect(normalizeCompany("Stripe")).toBe("stripe");
  });

  it("strips whitespace, symbols, punctuation, and domains", () => {
    expect(normalizeCompany("Amazon Web Services")).toBe("amazonwebservices");
    expect(normalizeCompany("Stripe, Inc.")).toBe("stripeinc");
    expect(normalizeCompany("amazon.com")).toBe("amazoncom");
    expect(normalizeCompany("TikTok / ByteDance")).toBe("tiktokbytedance");
    expect(normalizeCompany("Capital One (Canada)")).toBe("capitalonecanada");
  });

  it("handles null, undefined, or empty strings gracefully", () => {
    expect(normalizeCompany("")).toBe("");
    expect(normalizeCompany(null as any)).toBe("");
    expect(normalizeCompany(undefined as any)).toBe("");
  });
});

describe("Tech OA Markdown Table Parser (scripts/sync-oa-bank.ts)", () => {
  it("cleans markdown formatting artifacts from text", () => {
    expect(cleanCell("**Amazon**")).toBe("Amazon");
    expect(cleanCell("`Two Sum`")).toBe("Two Sum");
    expect(cleanCell("_Phone Screen_")).toBe("Phone Screen");
  });

  it("parses stray-comma dates accurately", () => {
    const d1 = parseObservedDate("Jul, 08, 2025");
    expect(d1).toBeInstanceOf(Date);
    expect(d1?.getFullYear()).toBe(2025);
    expect(d1?.getMonth()).toBe(6); // 0-indexed July = 6

    const d2 = parseObservedDate("Aug, 14, 2024");
    expect(d2).toBeInstanceOf(Date);
    expect(d2?.getFullYear()).toBe(2024);

    expect(parseObservedDate("N/A")).toBeNull();
    expect(parseObservedDate("")).toBeNull();
    expect(parseObservedDate("invalid-date-string")).toBeNull();
  });

  it("parses sample markdown table rows with links and metadata", () => {
    const sampleTable = `
| Company | OA Question | Practice (Beta) | Updated Time |
| :--- | :--- | :--- | :--- |
| Amazon | [Amazon Delivery Center](https://leetcode.com/discuss/interview-question/12345) | [Practice](https://code.io/1) | Jul, 08, 2025 |
| Meta | **Meta Graph Traversal** | [Practice](https://code.io/2) | Aug, 15, 2024 |
| Stripe | \`Payment Ledger Transaction Stream\` | Practice | Sep, 01, 2025 |
| Amazon | [Amazon Delivery Center](https://leetcode.com/discuss/interview-question/12345) | Practice | Jul, 08, 2025 |
    `.trim();

    const parsed = parseMarkdownTable(sampleTable);

    // Expect 3 unique rows after deduplicating the Amazon duplicate
    expect(parsed.length).toBe(3);

    expect(parsed[0].company).toBe("Amazon");
    expect(parsed[0].companyKey).toBe("amazon");
    expect(parsed[0].problemTitle).toBe("Amazon Delivery Center");
    expect(parsed[0].sourceUrl).toBe("https://leetcode.com/discuss/interview-question/12345");
    expect(parsed[0].lastObserved).toBeInstanceOf(Date);

    expect(parsed[1].company).toBe("Meta");
    expect(parsed[1].companyKey).toBe("meta");
    expect(parsed[1].problemTitle).toBe("Meta Graph Traversal");
    expect(parsed[1].sourceUrl).toBeNull();

    expect(parsed[2].company).toBe("Stripe");
    expect(parsed[2].companyKey).toBe("stripe");
    expect(parsed[2].problemTitle).toBe("Payment Ledger Transaction Stream");
  });
});
