import { describe, it, expect } from "vitest";
import {
  checkHostPolicy,
  greenhouseApiUrlFromPosting,
  leverApiUrlFromPosting,
  ashbyApiUrlFromPosting,
  extractFullTextFromUrl,
  cleanJobHtml,
  BOOKMARKLET_EXTRACT_SNIPPET,
} from "@/lib/ingestion/tier2-fetcher";
import type { ExtractFailureCode } from "@/lib/ingestion/types";

describe("WS1.1 — Job Ingestion Failure Taxonomy & Policy Enforcement", () => {
  it("generates correct public JSON API endpoint for Greenhouse postings", () => {
    const directUrl = "https://boards.greenhouse.io/stripe/jobs/556677";
    expect(greenhouseApiUrlFromPosting(directUrl)).toBe(
      "https://boards-api.greenhouse.io/v1/boards/stripe/jobs/556677"
    );

    const embedUrl = "https://boards.greenhouse.io/embed/job_app?for=shopify&token=12345";
    expect(greenhouseApiUrlFromPosting(embedUrl)).toBe(
      "https://boards-api.greenhouse.io/v1/boards/shopify/jobs/12345"
    );
  });

  it("generates correct public JSON API endpoint for Lever postings", () => {
    const leverUrl = "https://jobs.lever.co/figma/a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(leverApiUrlFromPosting(leverUrl)).toBe(
      "https://api.lever.co/v0/postings/figma/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    );
  });

  it("generates correct public JSON API endpoint for Ashby postings", () => {
    const ashbyUrl = "https://jobs.ashbyhq.com/linear/98765432-abcd-ef01-2345-6789abcdef01";
    expect(ashbyApiUrlFromPosting(ashbyUrl)).toBe(
      "https://api.ashbyhq.com/posting-api/job-board/linear/job/98765432-abcd-ef01-2345-6789abcdef01"
    );
  });

  it("enforces LinkedIn anti-scraping policy with blocked_host taxonomy", () => {
    const policy = checkHostPolicy("https://www.linkedin.com/jobs/view/3948201948");
    expect(policy.allowed).toBe(false);
    expect(policy.failureCode).toBe<ExtractFailureCode>("blocked_host");
    expect(policy.message).toMatch(/paste the job description/i);
  });

  it("blocks Indeed search result scraping under Indeed Terms of Service", () => {
    const policy = checkHostPolicy("https://ca.indeed.com/jobs?q=software+engineer&l=Toronto%2C+ON");
    expect(policy.allowed).toBe(false);
    expect(policy.failureCode).toBe<ExtractFailureCode>("blocked_host");
    expect(policy.message).toMatch(/Indeed Terms of Service/i);
  });

  it("disallows direct Indeed HTML scraping without partner credentials", () => {
    const policy = checkHostPolicy("https://www.indeed.com/viewjob?jk=abcdef123456");
    expect(policy.allowed).toBe(false);
    expect(policy.failureCode).toBe<ExtractFailureCode>("robots_disallowed");
    expect(policy.message).toMatch(/paste the job description/i);
  });

  it("enforces Facebook/Meta host block policy", () => {
    const policy = checkHostPolicy("https://www.facebook.com/careers/jobs/1234567890");
    expect(policy.allowed).toBe(false);
    expect(policy.failureCode).toBe<ExtractFailureCode>("blocked_host");
  });

  it("classifies malformed URLs as invalid_url", async () => {
    const result = await extractFullTextFromUrl("not-a-valid-url");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failureCode).toBe<ExtractFailureCode>("invalid_url");
    }
  });

  it("gracefully falls back to manual paste when policy blocks URL", async () => {
    const result = await extractFullTextFromUrl("https://www.linkedin.com/jobs/view/123456");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.failureCode).toBe("blocked_host");
      expect(result.message).toContain("paste");
    }
  });

  it("cleanJobHtml strips DOM boilerplate, scripts, and navigation", () => {
    const raw = `
      <html>
        <head><script>console.log('bad')</script><style>body { color: red; }</style></head>
        <body>
          <header><nav>Navigation Link</nav></header>
          <main>
            <h1>Staff Systems Engineer</h1>
            <p>We are seeking an engineer with experience in distributed systems &amp; Go.</p>
            <svg><path d="M0 0"/></svg>
          </main>
          <footer>Copyright 2026</footer>
        </body>
      </html>
    `;
    const cleaned = cleanJobHtml(raw);
    expect(cleaned).toContain("Staff Systems Engineer");
    expect(cleaned).toContain("distributed systems &amp; Go");
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("Navigation Link");
    expect(cleaned).not.toContain("Copyright 2026");
    expect(BOOKMARKLET_EXTRACT_SNIPPET).toContain("javascript:");
  });
});
