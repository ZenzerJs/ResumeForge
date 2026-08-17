import { test, expect } from "@playwright/test";

test.describe("WS1 — Ingestion Failure Taxonomy & Universal Normalizer", () => {
  test("1.1 Extract endpoint rejects blocked host and suggests manual paste", async ({
    request,
  }) => {
    const response = await request.post("/api/jobs/extract", {
      data: {
        url: "https://www.linkedin.com/jobs/view/123456789",
      },
    });

    expect(response.status()).toBe(422);
    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.failureCode).toBe("blocked_host");
    expect(json.error).toMatch(/paste/i);
  });

  test("1.2 Extract endpoint normalizes raw text input with clean taxonomy", async ({
    request,
  }) => {
    const response = await request.post("/api/jobs/extract", {
      data: {
        rawDescription: `
Company: Shopify
Title: Senior Backend Developer
Location: Toronto, ON

Requirements:
- 5+ years experience with Ruby or Go
- Deep knowledge of PostgreSQL and Redis
- Experience with Docker containerization
`,
      },
    });

    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.normalized).toBeDefined();
    expect(json.normalized.company).toBe("Shopify");
    expect(json.normalized.title).toBe("Senior Backend Developer");
    expect(json.normalized.location.city).toBe("Toronto");
    expect(json.normalized.location.region).toBe("ON");
    expect(json.normalized.location.country).toBe("Canada");
  });
});
