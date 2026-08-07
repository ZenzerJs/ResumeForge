import { describe, it, expect } from "vitest";
import { PATCH, GET } from "@/app/api/jobs/[id]/route";
import { createJob } from "@/lib/db/jobs";

describe("Job Application Tracker API (PATCH /api/jobs/[id])", () => {
  it("returns 400 Bad Request when updating job with invalid status", async () => {
    const job = await createJob({
      company: "Test Corp",
      roleTitle: "Frontend Engineer",
      rawDescription: "TypeScript and React experience required.",
    });

    const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "INVALID_STATUS" }),
    });

    const params = Promise.resolve({ id: job.id });
    const response = await PATCH(request, { params });
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid request payload");
  });

  it("updates job status to APPLIED and automatically sets appliedAt date", async () => {
    const job = await createJob({
      company: "Acme Corp",
      roleTitle: "Fullstack Developer",
      rawDescription: "Node.js and Next.js developer needed.",
    });

    const request = new Request(`http://localhost:3000/api/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "APPLIED", notes: "Submitted resume via referral link." }),
    });

    const params = Promise.resolve({ id: job.id });
    const response = await PATCH(request, { params });
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("APPLIED");
    expect(json.data.notes).toBe("Submitted resume via referral link.");
    expect(json.data.appliedAt).toBeDefined();
    expect(new Date(json.data.appliedAt).getTime()).not.toBeNaN();
  });

  it("returns 404 Not Found when updating a non-existent job ID", async () => {
    const request = new Request("http://localhost:3000/api/jobs/non-existent-uuid-1234", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "INTERVIEWING" }),
    });

    const params = Promise.resolve({ id: "non-existent-uuid-1234" });
    const response = await PATCH(request, { params });
    expect(response.status).toBe(404);
  });
});
