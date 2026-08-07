import { describe, it, expect } from "vitest";
import { parsePittCSCMarkdown } from "@/lib/ingestion/pittcsc-parser";

describe("Pitt CSC / Simplify GFM Markdown Ingestion Parser", () => {
  it("parses valid open and closed internship rows from GFM Markdown table", () => {
    const sampleMarkdown = `
| Company | Role | Location | Application Link | Date Posted |
| :--- | :--- | :--- | :--- | :--- |
| **[Datadog](https://datadog.com)** | SDE Intern | New York, NY | [Apply](https://simplify.jobs/p/123) | 2 days ago |
| **~~Google~~** | ~~STEP Intern~~ | ~~Mountain View, CA~~ | 🔒 | 1 week ago |
`;

    const jobs = parsePittCSCMarkdown(sampleMarkdown);

    expect(jobs.length).toBe(2);

    // First job (Datadog)
    expect(jobs[0].company).toBe("Datadog");
    expect(jobs[0].roleTitle).toBe("SDE Intern");
    expect(jobs[0].location).toBe("New York, NY");
    expect(jobs[0].applyUrl).toBe("https://simplify.jobs/p/123");
    expect(jobs[0].isClosed).toBe(false);
    expect(jobs[0].externalId).toBeTruthy();

    // Second job (Google - closed)
    expect(jobs[1].company).toBe("Google");
    expect(jobs[1].roleTitle).toBe("STEP Intern");
    expect(jobs[1].isClosed).toBe(true);
  });
});
