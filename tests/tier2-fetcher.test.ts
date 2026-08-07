import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  extractFullTextFromUrl,
  fetchAndCacheJobFullText,
  isTier1Placeholder,
} from "@/lib/ingestion/tier2-fetcher";

describe("Task 8.4: Tier 2 On-Demand Full-Text Fetcher", () => {
  const testJobId = "test-tier2-job-uuid-12345";
  const applyUrl = "https://job-boards.eu.greenhouse.io/testco/jobs/123456";

  beforeEach(async () => {
    // Clean up test job if exists
    await prisma.job.deleteMany({ where: { id: testJobId } });

    // Create a Tier 1 placeholder job in DB
    await prisma.job.create({
      data: {
        id: testJobId,
        company: "TestCo",
        roleTitle: "Software Engineer Intern",
        rawDescription:
          "[Pending Import] Full job description text not yet fetched from posting page for TestCo — Software Engineer Intern. Navigate to the Tailor workspace to paste the complete job description text.",
        source: "simplify-jobs",
        notes: `Tier 1 Bulk Import | Location: Remote | Apply Link: ${applyUrl}`,
      },
    });
  });

  afterEach(async () => {
    await prisma.job.deleteMany({ where: { id: testJobId } });
    vi.restoreAllMocks();
  });

  it("identifies Tier 1 placeholder correctly", () => {
    expect(
      isTier1Placeholder(
        "[Pending Import] Full job description text not yet fetched from posting page..."
      )
    ).toBe(true);

    expect(
      isTier1Placeholder(
        "We are looking for a Software Engineering Intern with TypeScript and React experience."
      )
    ).toBe(false);
  });

  it("successfully extracts full text from Greenhouse JSON-LD / HTML", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job Application for Software Engineer Intern at TestCo</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Software Engineer Intern",
              "description": "<p>We are seeking a Software Engineer Intern to work on Next.js, TypeScript, and Node.js backend microservices. Qualifications include experience with SQL databases and Git.</p>"
            }
          </script>
        </head>
        <body>
          <div id="content">
            <h1>Software Engineer Intern</h1>
            <p>We are seeking a Software Engineer Intern to work on Next.js, TypeScript, and Node.js backend microservices.</p>
          </div>
        </body>
      </html>
    `;

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(mockHtml, { status: 200, headers: { "Content-Type": "text/html" } })
    );

    const result = await extractFullTextFromUrl(applyUrl);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rawDescription).toContain("Software Engineer Intern");
      expect(result.rawDescription).toContain("TypeScript");
      expect(result.rawDescription.length).toBeGreaterThan(150);
    }
  });

  it("handles Workday JS SPA shells gracefully by failing and returning fallback", async () => {
    const mockWorkdayHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <script type="application/ld+json">
            {
              "jobLocation": { "@type": "Place" },
              "hiringOrganization": { "name": "WorkdayCo" }
            }
          </script>
        </head>
        <body>
          <div id="workday-app">JavaScript is required to view this job posting. Please enable JavaScript in your browser.</div>
        </body>
      </html>
    `;

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(mockWorkdayHtml, { status: 200, headers: { "Content-Type": "text/html" } })
    );

    const result = await extractFullTextFromUrl("https://workdayco.wd5.myworkdayjobs.com/job/123");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain("Could not extract");
    }
  });

  it("caches successful extraction in database and hits cache on second request", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Job Posting</title>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Software Engineer Intern",
              "description": "<p>Full job description text with Python, Docker, and Linux requirement details for candidates. We are seeking a passionate software engineering intern to join our engineering team to build scalable microservices and backend systems in a collaborative environment.</p>"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(
        new Response(mockHtml, { status: 200, headers: { "Content-Type": "text/html" } })
      );

    // First call: Should fetch from network and update DB
    const res1 = await fetchAndCacheJobFullText(testJobId);
    expect(res1.success).toBe(true);
    expect(res1.cached).toBe(false);
    expect(res1.data?.rawDescription).toContain("Python");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call: Should hit DB cache without calling fetch
    const res2 = await fetchAndCacheJobFullText(testJobId);
    expect(res2.success).toBe(true);
    expect(res2.cached).toBe(true);
    expect(res2.data?.rawDescription).toContain("Python");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Call count remains 1!
  });
});
