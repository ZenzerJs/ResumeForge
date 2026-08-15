import { describe, it, expect } from "vitest";
import { canonicalizeUrl, generateJobFingerprint } from "../dedupe";
import { sanitizeJobPayload } from "../sanitize";

describe("Job Ingestion Deduplication & Sanitization Pipeline", () => {
  it("1. canonicalizeUrl strips all tracking and analytics query parameters", () => {
    const rawUrl =
      "https://jobs.lever.co/certn/abc-123/?utm_source=linkedin&utm_medium=cpc&utm_campaign=hiring&gh_jid=999&ref=feed/";
    const cleaned = canonicalizeUrl(rawUrl);
    expect(cleaned).toBe("https://jobs.lever.co/certn/abc-123");
  });

  it("2. canonicalizeUrl preserves non-tracking query parameters while removing trailing slash", () => {
    const rawUrl = "https://boards.greenhouse.io/shopify/jobs/555/?content=true";
    const cleaned = canonicalizeUrl(rawUrl);
    expect(cleaned).toBe("https://boards.greenhouse.io/shopify/jobs/555?content=true");
  });

  it("3. generateJobFingerprint produces identical SHA-256 hash across variations", () => {
    const hash1 = generateJobFingerprint(
      "Shopify Inc.",
      "Senior Full-Stack Developer",
      "https://boards.greenhouse.io/shopify/jobs/101?utm_source=twitter"
    );
    const hash2 = generateJobFingerprint(
      "  shopify inc  ",
      "senior full stack developer",
      "https://boards.greenhouse.io/shopify/jobs/101/?utm_medium=email"
    );

    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it("4. sanitizeJobPayload strips dangerous scripts, iframes, and inline event handlers", () => {
    const dirtyHtml = `
      <h1>Role Overview</h1>
      <p>Join us at <strong>Acme</strong> as an engineer.</p>
      <script>alert('xss vulnerability')</script>
      <img src="x" onerror="stealCookies()" />
      <iframe src="https://evil.com"></iframe>
      <ul>
        <li>TypeScript &amp; React</li>
        <li>Node.js backend</li>
      </ul>
    `;

    const { html, text } = sanitizeJobPayload(dirtyHtml);

    // HTML assertions
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("alert");
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<iframe>");
    expect(html).toContain("<h1>Role Overview</h1>");
    expect(html).toContain("<strong>Acme</strong>");
    expect(html).toContain("<li>TypeScript &amp; React</li>");

    // Plain text assertions
    expect(text).toContain("Role Overview");
    expect(text).toContain("Join us at Acme as an engineer.");
    expect(text).toContain("TypeScript & React");
    expect(text).not.toContain("xss");
  });
});
