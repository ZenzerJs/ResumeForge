import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  extractFullTextFromUrl,
  fetchAndCacheJobFullText,
  greenhouseApiUrlFromPosting,
  isTier1Placeholder,
  convertHtmlToCleanMarkdown,
} from "@/lib/ingestion/tier2-fetcher";
import { formatCanonicalJobDescription } from "@/lib/ingestion/jd-format";
import { extractSalaryFromNotes } from "@/lib/ingestion/helpers";
import { safeFetch, UnsafeUrlError } from "@/lib/security/safe-fetch";

describe("Task 8.4: Tier 2 On-Demand Full-Text Fetcher", () => {
  const testJobId = "test-tier2-job-uuid-12345";
  const applyUrl = "https://job-boards.eu.greenhouse.io/testco/jobs/123456";

  beforeEach(async () => {
    await prisma.job.deleteMany({ where: { id: testJobId } });

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

  it("maps Greenhouse posting URLs to the boards JSON API", () => {
    expect(greenhouseApiUrlFromPosting(applyUrl)).toBe(
      "https://boards-api.greenhouse.io/v1/boards/testco/jobs/123456"
    );
    expect(
      greenhouseApiUrlFromPosting(
        "https://boards.greenhouse.io/embed/job_app?for=imc&token=4907430101"
      )
    ).toBe("https://boards-api.greenhouse.io/v1/boards/imc/jobs/4907430101");
  });

  it("wraps extracted text in a canonical markdown format", () => {
    const formatted = formatCanonicalJobDescription({
      title: "Software Engineer Intern",
      company: "TestCo",
      location: "Remote",
      description:
        "We are seeking a Software Engineer Intern to work on TypeScript services. Requirements include experience with SQL.",
    });
    expect(formatted).toContain("# Software Engineer Intern");
    expect(formatted).toContain("Company: TestCo");
    expect(formatted).toContain("## Job description");
    expect(formatted).toContain("TypeScript");
  });

  it("converts encoded Greenhouse HTML into markdown lists without leftover tags", () => {
    const encoded = [
      "&lt;p&gt;Our Machine Learning Internship is designed for curious researchers who want to apply machine learning to real-world trading problems on the engineering team.&lt;/p&gt;",
      "&lt;p&gt;&lt;strong&gt;YOUR CORE RESPONSIBILITIES:&lt;/strong&gt;&lt;/p&gt;",
      "&lt;ul&gt;&lt;li&gt;Conduct hands-on research to design original machine learning algorithms.&lt;/li&gt;",
      "&lt;li&gt;Analyze large-scale datasets and develop predictive models.&lt;/li&gt;&lt;/ul&gt;",
      "&lt;p&gt;Base Salary: $300,000&lt;/p&gt;",
    ].join("");

    const markdown = convertHtmlToCleanMarkdown(encoded);
    expect(markdown).not.toMatch(/<\/?[a-z][\s\S]*?>/i);
    expect(markdown).toContain("YOUR CORE RESPONSIBILITIES:");
    expect(markdown).toContain("- Conduct hands-on research");
    expect(markdown).toContain("- Analyze large-scale datasets");
    expect(extractSalaryFromNotes(null, markdown)).toBe("$300,000");
  });

  it("successfully extracts full text from Greenhouse JSON API", async () => {
    const apiJson = {
      title: "Software Engineer Intern",
      location: { name: "Remote" },
      content:
        "&lt;p&gt;We are seeking a Software Engineer Intern to work on Next.js, TypeScript, and Node.js backend microservices. Qualifications include experience with SQL databases and Git. You will join the engineering team to ship production software.&lt;/p&gt;&lt;p&gt;Base Salary: $300,000&lt;/p&gt;",
    };

    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("boards-api.greenhouse.io")) {
        return new Response(JSON.stringify(apiJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not used", { status: 404 });
    });

    const result = await extractFullTextFromUrl(applyUrl, {
      company: "TestCo",
      roleTitle: "Software Engineer Intern",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rawDescription).toContain("# Software Engineer Intern");
      expect(result.rawDescription).toContain("Company: TestCo");
      expect(result.rawDescription).toContain("## Job description");
      expect(result.rawDescription).toContain("TypeScript");
      expect(result.rawDescription).not.toMatch(/<\/?p>/i);
      expect(result.rawDescription).toContain("Salary: $300,000");
      expect(result.rawDescription.length).toBeGreaterThan(150);
    }
  });

  it("extracts JobPosting JSON-LD from @graph when ATS APIs are unavailable", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "JobPosting",
                  "title": "Software Engineer Intern",
                  "hiringOrganization": { "name": "DirectCo" },
                  "description": "<p>We are seeking a Software Engineer Intern to work on Next.js, TypeScript, and Node.js backend microservices. Qualifications include experience with SQL databases and Git. Join the engineering team.</p>"
                }
              ]
            }
          </script>
        </head>
        <body><div id="content">ignored</div></body>
      </html>
    `;

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(mockHtml, { status: 200, headers: { "Content-Type": "text/html" } })
    );

    const result = await extractFullTextFromUrl("https://careers.directco.example/jobs/intern-1");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rawDescription).toContain("Software Engineer Intern");
      expect(result.rawDescription).toContain("TypeScript");
    }
  });

  it("follows HTTPS redirects before parsing HTML", async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "JobPosting",
              "title": "Software Engineer Intern",
              "description": "<p>We are seeking a Software Engineer Intern to work on Next.js, TypeScript, and Node.js backend microservices. Qualifications include experience with SQL databases and Git. Join the engineering team.</p>"
            }
          </script>
        </head>
        <body></body>
      </html>
    `;

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url === "https://careers.example.com/job/redirect") {
        return new Response(null, {
          status: 302,
          headers: { Location: "https://careers.example.com/job/final" },
        });
      }
      return new Response(mockHtml, { status: 200, headers: { "Content-Type": "text/html" } });
    });

    const result = await extractFullTextFromUrl("https://careers.example.com/job/redirect");
    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
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
    const apiJson = {
      title: "Software Engineer Intern",
      content:
        "<p>Full job description text with Python, Docker, and Linux requirement details for candidates. We are seeking a passionate software engineering intern to join our engineering team to build scalable microservices and backend systems in a collaborative environment.</p>",
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("boards-api.greenhouse.io")) {
        return new Response(JSON.stringify(apiJson), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("not used", { status: 404 });
    });

    const res1 = await fetchAndCacheJobFullText(testJobId);
    expect(res1.success).toBe(true);
    expect(res1.cached).toBe(false);
    expect(res1.data?.rawDescription).toContain("Python");
    expect(res1.data?.rawDescription).toContain("## Job description");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const res2 = await fetchAndCacheJobFullText(testJobId);
    expect(res2.success).toBe(true);
    expect(res2.cached).toBe(true);
    expect(res2.data?.rawDescription).toContain("Python");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("safeFetch redirect SSRF guard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not follow redirects onto private hosts", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { Location: "https://127.0.0.1/secret" },
      })
    );

    await expect(
      safeFetch(
        "https://boards.greenhouse.io/example",
        {},
        { followRedirects: true, allowLocalhost: false }
      )
    ).rejects.toBeInstanceOf(UnsafeUrlError);
  });
});
