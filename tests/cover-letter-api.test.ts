import { describe, it, expect, beforeEach } from "vitest";
import { createJob } from "@/lib/db/jobs";
import { createResume } from "@/lib/db/resumes";
import { createVariant } from "@/lib/db/variants";
import { createCoverLetter, getCoverLettersByJobId } from "@/lib/db/cover-letters";
import { GET as getCoverLettersRoute, POST as createCoverLetterRoute } from "@/app/api/cover-letters/route";
import { GET as getCoverLetterByIdRoute } from "@/app/api/cover-letters/[id]/route";
import { authedNextRequest, createTestUser } from "./helpers/auth";

describe("Cover Letter Database & API Integration Tests (Phase 5)", () => {
  let jobId: string;
  let testCoverLetterId: string;
  let cookie: string;

  beforeEach(async () => {
    const auth = await createTestUser();
    cookie = auth.cookie;
    const master = await createResume({
      title: "Cover Letter Test Master",
      typstSource: "= Cover Letter Test Master",
      isMaster: true,
      userId: auth.user.id,
    });
    const job = await createJob({
      company: "Stripe",
      roleTitle: "Staff Software Engineer",
      rawDescription: "Build global payment infrastructure using Node.js and TypeScript.",
      userId: auth.user.id,
    });
    jobId = job.id;
    const variant = await createVariant({
      masterResumeId: master.id,
      jobId,
      variantTitle: "Stripe tailored variant",
      typstContent: "= Stripe variant",
      userId: auth.user.id,
    });

    const letter = await createCoverLetter({
      jobId,
      variantId: variant.id,
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
      userId: auth.user.id,
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
    const req = authedNextRequest(`http://localhost:3000/api/cover-letters?jobId=${jobId}`, {}, cookie);
    const res = await getCoverLettersRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data.length).toBeGreaterThan(0);
    expect(json.data[0].job.company).toBe("Stripe");
  });

  it("3. GET /api/cover-letters/[id] returns single cover letter data", async () => {
    const req = authedNextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`, {}, cookie);
    const res = await getCoverLetterByIdRoute(req, { params: Promise.resolve({ id: testCoverLetterId }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(testCoverLetterId);
    expect(json.data.salutation).toBe("Dear Stripe Hiring Team,");
  });

  it("4. GET /api/cover-letters/[id] returns 404 for missing cover letter ID", async () => {
    const missingId = "missing-cover-letter-uuid-999";
    const req = authedNextRequest(`http://localhost:3000/api/cover-letters/${missingId}`, {}, cookie);
    const res = await getCoverLetterByIdRoute(req, { params: Promise.resolve({ id: missingId }) });
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Cover letter not found");
  });

  it("5. POST /api/cover-letters rejects invalid payload with 400 Bad Request", async () => {
    const req = authedNextRequest(
      "http://localhost:3000/api/cover-letters",
      {
        method: "POST",
        body: JSON.stringify({ title: "Incomplete Payload" }),
      },
      cookie
    );
    const res = await createCoverLetterRoute(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid cover letter creation payload");
  });
});
