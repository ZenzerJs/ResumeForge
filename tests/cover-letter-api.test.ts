import { describe, it, expect, beforeEach } from "vitest";
import { createJob } from "@/lib/db/jobs";
import { createResume } from "@/lib/db/resumes";
import { createVariant } from "@/lib/db/variants";
import { createCoverLetter, getCoverLettersByJobId } from "@/lib/db/cover-letters";
import { GET as getCoverLettersRoute, POST as createCoverLetterRoute } from "@/app/api/cover-letters/route";
import { GET as getCoverLetterByIdRoute, PUT as updateCoverLetterByIdRoute } from "@/app/api/cover-letters/[id]/route";
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

  it("6. PUT /api/cover-letters/[id] persists all 5 fields, preserves partial & empty-string edits, keeps prior row shape, and enforces validation & ownership", async () => {
    // Prior row (before any PUT) returns proseMarkdown alias and null new fields
    const initialGetRes = await getCoverLetterByIdRoute(
      authedNextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`, {}, cookie),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(initialGetRes.status).toBe(200);
    const initialGetJson = await initialGetRes.json();
    expect(initialGetJson.data.proseMarkdown).toBe(initialGetJson.data.fullMarkdown);
    expect(initialGetJson.data.typstSource).toBeNull();
    expect(initialGetJson.data.tone).toBeNull();
    expect(initialGetJson.data.targetWordCount).toBeNull();

    // Update all 5 editor fields + fresh GET
    const putAllReq = authedNextRequest(
      `http://localhost:3000/api/cover-letters/${testCoverLetterId}`,
      {
        method: "PUT",
        body: JSON.stringify({
          title: "Staff Cover Letter — Edited",
          proseMarkdown: "# Updated Cover Letter\n\nNew body.",
          typstSource: '= Updated Cover Letter\n#text("New body.")',
          tone: "TECHNICAL",
          targetWordCount: 350,
        }),
      },
      cookie
    );
    const putAllRes = await updateCoverLetterByIdRoute(putAllReq, {
      params: Promise.resolve({ id: testCoverLetterId }),
    });
    expect(putAllRes.status).toBe(200);

    const afterAllRes = await getCoverLetterByIdRoute(
      authedNextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`, {}, cookie),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    const afterAllJson = await afterAllRes.json();
    expect(afterAllRes.status).toBe(200);
    expect(afterAllJson.data.title).toBe("Staff Cover Letter — Edited");
    expect(afterAllJson.data.proseMarkdown).toBe("# Updated Cover Letter\n\nNew body.");
    expect(afterAllJson.data.fullMarkdown).toBe("# Updated Cover Letter\n\nNew body.");
    expect(afterAllJson.data.typstSource).toBe('= Updated Cover Letter\n#text("New body.")');
    expect(afterAllJson.data.tone).toBe("TECHNICAL");
    expect(afterAllJson.data.targetWordCount).toBe(350);

    // Partial edit omitting other fields + preserving empty-string edit on typstSource & legacy status update
    const partialPutRes = await updateCoverLetterByIdRoute(
      authedNextRequest(
        `http://localhost:3000/api/cover-letters/${testCoverLetterId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            typstSource: "",
            status: "FINAL",
          }),
        },
        cookie
      ),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(partialPutRes.status).toBe(200);

    const afterPartialRes = await getCoverLetterByIdRoute(
      authedNextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`, {}, cookie),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    const afterPartialJson = await afterPartialRes.json();
    expect(afterPartialJson.data.title).toBe("Staff Cover Letter — Edited");
    expect(afterPartialJson.data.proseMarkdown).toBe("# Updated Cover Letter\n\nNew body.");
    expect(afterPartialJson.data.typstSource).toBe("");
    expect(afterPartialJson.data.tone).toBe("TECHNICAL");
    expect(afterPartialJson.data.targetWordCount).toBe(350);
    expect(afterPartialJson.data.status).toBe("FINAL");

    // Empty-string proseMarkdown is also preserved
    const emptyProseRes = await updateCoverLetterByIdRoute(
      authedNextRequest(
        `http://localhost:3000/api/cover-letters/${testCoverLetterId}`,
        {
          method: "PUT",
          body: JSON.stringify({ proseMarkdown: "" }),
        },
        cookie
      ),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(emptyProseRes.status).toBe(200);
    const afterEmptyProseJson = await (
      await getCoverLetterByIdRoute(
        authedNextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`, {}, cookie),
        { params: Promise.resolve({ id: testCoverLetterId }) }
      )
    ).json();
    expect(afterEmptyProseJson.data.proseMarkdown).toBe("");
    expect(afterEmptyProseJson.data.fullMarkdown).toBe("");

    // Validation errors (tone, range)
    const badToneRes = await updateCoverLetterByIdRoute(
      authedNextRequest(
        `http://localhost:3000/api/cover-letters/${testCoverLetterId}`,
        { method: "PUT", body: JSON.stringify({ tone: "CASUAL" }) },
        cookie
      ),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(badToneRes.status).toBe(400);

    const badCountRes = await updateCoverLetterByIdRoute(
      authedNextRequest(
        `http://localhost:3000/api/cover-letters/${testCoverLetterId}`,
        { method: "PUT", body: JSON.stringify({ targetWordCount: 10 }) },
        cookie
      ),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(badCountRes.status).toBe(400);

    // Foreign owner rejection (404 on PUT and GET)
    const otherAuth = await createTestUser();
    const foreignPutRes = await updateCoverLetterByIdRoute(
      authedNextRequest(
        `http://localhost:3000/api/cover-letters/${testCoverLetterId}`,
        { method: "PUT", body: JSON.stringify({ title: "Hijacked" }) },
        otherAuth.cookie
      ),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(foreignPutRes.status).toBe(404);

    const foreignGetRes = await getCoverLetterByIdRoute(
      authedNextRequest(`http://localhost:3000/api/cover-letters/${testCoverLetterId}`, {}, otherAuth.cookie),
      { params: Promise.resolve({ id: testCoverLetterId }) }
    );
    expect(foreignGetRes.status).toBe(404);
  });
});
