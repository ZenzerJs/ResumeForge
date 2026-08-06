import { describe, it, expect } from "vitest";
import { POST as extractPOST } from "@/app/api/jobs/extract/route";
import { POST as jobsPOST } from "@/app/api/jobs/route";

describe("Jobs API Endpoint Rejection Path & Zod Validation Tests", () => {
  it("returns 400 Bad Request for empty/malformed extract request", async () => {
    const request = new Request("http://localhost:3000/api/jobs/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawDescription: "" }),
    });

    const response = await extractPOST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid request payload");
    expect(json.details).toBeDefined();
  });

  it("returns 400 Bad Request when posting invalid job payload", async () => {
    const request = new Request("http://localhost:3000/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: "Acme", rawDescription: "" }),
    });

    const response = await jobsPOST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid request payload");
  });

  it("extracts requirements cleanly on valid request payload", async () => {
    const request = new Request("http://localhost:3000/api/jobs/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawDescription: "Software Engineer required: TypeScript, React, Docker.",
      }),
    });

    const response = await extractPOST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.requiredSkills).toContain("TypeScript");
    expect(json.data.requiredSkills).toContain("React");
    expect(json.data.requiredSkills).toContain("Docker");
  });
});
