import { describe, it, expect, beforeEach } from "vitest";
import { parseMarkdownTable, importTier1Jobs } from "@/lib/ingestion/tier1-importer";
import { getJobs } from "@/lib/db/jobs";

const SAMPLE_SIMPLIFY_MARKDOWN_TABLE = `
| Company | Role | Location | Application Link | Age |
|---|---|---|---|---|
| [Acme Corp](https://acme.com) | Senior Software Engineer Intern | Vancouver, BC | [Apply](https://acme.com/jobs/123) | 2d |
| **Shopify** | Frontend Engineer Intern | Toronto, ON / Remote | [Apply](https://shopify.com/careers/456) | 1d |
| Invalid Row Missing Company Column |
| Google | Software Engineering Intern | | [Apply](https://google.com/jobs/789) | 3d |
`;

describe("Task 8.2: Tier 1 Bulk Job Ingestion", () => {
  it("1. parses realistic markdown table into valid job objects", () => {
    const parsed = parseMarkdownTable(SAMPLE_SIMPLIFY_MARKDOWN_TABLE);
    expect(parsed.length).toBe(3);

    expect(parsed[0].company).toBe("Acme Corp");
    expect(parsed[0].roleTitle).toBe("Senior Software Engineer Intern");
    expect(parsed[0].location).toBe("Vancouver, BC");

    expect(parsed[1].company).toBe("Shopify");
    expect(parsed[1].roleTitle).toBe("Frontend Engineer Intern");
    expect(parsed[1].location).toBe("Toronto, ON / Remote");
  });

  it("2. skips malformed rows safely without crashing", () => {
    const malformedMarkdown = `
| Header 1 | Header 2 |
|---|---|
| Not a valid table row structure
|   |   |   |
    `;
    const parsed = parseMarkdownTable(malformedMarkdown);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(0);
  });

  it("3. handles missing optional fields (missing location) safely", () => {
    const parsed = parseMarkdownTable(SAMPLE_SIMPLIFY_MARKDOWN_TABLE);
    const googleJob = parsed.find((j) => j.company === "Google");
    expect(googleJob).toBeDefined();
    expect(googleJob?.location).toBe("");
  });

  it("4. importTier1Jobs runs bulk ingestion with deduplication", async () => {
    const UNIQUE_TEST_TABLE = `
| Company | Role | Location | Application Link | Age |
|---|---|---|---|---|
| [Unique Test Importer Co ${Date.now()}](https://test.com) | Unique Systems Engineer | Remote | [Apply](https://test.com/1) | 1d |
`;
    const result1 = await importTier1Jobs({ tableMarkdown: UNIQUE_TEST_TABLE });
    expect(result1.success).toBe(true);
    expect(result1.createdCount).toBe(1);

    // Re-run second time to test deduplication
    const result2 = await importTier1Jobs({ tableMarkdown: UNIQUE_TEST_TABLE });
    expect(result2.success).toBe(true);
    expect(result2.createdCount).toBe(0);
    expect(result2.skippedCount).toBe(1);
  });
});
