import { describe, it, expect, beforeEach } from "vitest";
import { createJob } from "@/lib/db/jobs";
import { createCoverLetter, getCoverLettersByJobId } from "@/lib/db/cover-letters";
import { GET as getCoverLettersRoute, POST as createCoverLetterRoute } from "@/app/api/cover-letters/route";
import { GET as getCoverLetterByIdRoute } from "@/app/api/cover-letters/[id]/route";
import { NextRequest } from "next/server";

describe("Cover Letter Database & API Integration Tests (Phase 5)", () => {
  let jobId: string;
  let testCoverLetterId: string;

  beforeEach(async () => {
    // Seed test job
    const job = await createJob({
      company: "Stripe",
      roleTitle: "Staff Software Engineer",
      rawDescription: "Build global payment infrastructure using Node.js and TypeScript.",
    });
    jobId = job.id;

    // Seed test cover letter
    const letter = await createCoverLetter({
      jobId,
      title: "Stripe Staff Role Cover Letter",
      salutation: "Dear Stripe Hiring Team,",
      openingParagraph: "I am writing to express my strong enthusiasm for the Staff Software Engineer position at Stripe.",
      bodyParagraphs: [
        "Led high-throughput payment settlement microservices processing over $100M daily.",
        "Optimized database indexing in PostgreSQL reducing latency by 45%.",
      ],
      closingParagraph: "Thank you for considering my application.",
      fullMarkdown: "# Cover Letter\n\nDear Stripe Hiring Team,\n...",
      evidenceCitations: ["exp-101", "bullet-202"],
      status: "DRAFT",
    });
    testCoverLetterId = letter.id;
  });

  it("1. creates and fetches cover letter from database cleanly", async () => {
    const letters = await getCoverLettersByJobId(jobId);
    expect(letters.length).toBeGreaterThan(0);

    const found = letters.find((l) => l.id === testCoverLetterId);
    expect(found).toBeDefined();
    expect(found?.title).toBe("Stripe Staff Role Cover Letter");
    expect(found?.bodyParagraphs.length).toBe(2);
    expect(found?.evidenceCitations).toContain("exp-101");
  });

  it("2. GET /api/cover-letters?jobId= returns list of cover letters for specified job", async () => {
    const req = new NextRequest(`http://localhost:3000/api/cover-letters?jobId=${jobId}`);
    const res = await getCoverLettersRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].job.company).toBe("Stripe");
  });

  it("3. GET /api/cover-letters/[id] returns single cover letter data", async () => {
    const req = new NextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`);
    const res = await getCoverLetterByIdRoute(req, { params: Promise.resolve({ id: testCoverLetterId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(testCoverLetterId);
    expect(json.data.salutation).toBe("Dear Stripe Hiring Team,");
  });

  it("4. GET /api/cover-letters/[id] returns 404 for missing cover letter ID", async () => {
    const missingId = "missing-cover-letter-uuid-999";
    const req = new NextRequest(`http://localhost:3000/api/cover-letters/${missingId}`);
    const res = await getCoverLetterByIdRoute(req, { params: Promise.resolve({ id: missingId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Cover letter not found");
  });

  it("5. POST /api/cover-letters rejects invalid payload with 400 Bad Request", async () => {
    const req = new NextRequest("http://localhost:3000/api/cover-letters", {
      method: "POST",
      body: JSON.stringify({ title: "Incomplete Payload" }),
    });
    const res = await createCoverLetterRoute(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid cover letter creation payload");
  });
});
