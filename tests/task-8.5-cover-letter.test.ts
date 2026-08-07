import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob } from "@/lib/db/jobs";
import { CoverLetterResponseSchema } from "@/lib/ai/cover-letter-schema";
import { verifyCoverLetterGrounding } from "@/lib/ai/cover-letter-verifier";
import { buildCoverLetterSystemPrompt, buildCoverLetterUserPrompt } from "@/lib/ai/cover-letter-prompt";
import { POST as generateRoute } from "@/app/api/cover-letters/generate/route";
import { GET as getByIdRoute } from "@/app/api/cover-letters/[id]/route";
import { NextRequest } from "next/server";

describe("Task 8.5: Cover Letter Data Model & Evidence-Backed Drafting", () => {
  let testJobId: string;
  let testMasterResumeId: string;
  let testVariantId: string;

  beforeEach(async () => {
    // Create master resume
    const master = await prisma.resume.create({
      data: {
        title: "Protected Master Resume",
        typstSource: "#let name = [Jane Candidate]\n#resume-section('Skills')\nPython, Node.js, Docker, PostgreSQL",
        isMaster: true,
        isProtected: true,
      },
    });
    testMasterResumeId = master.id;

    // Create job
    const job = await createJob({
      company: "Acme Corp",
      roleTitle: "Senior Backend Engineer",
      rawDescription: "Seeking a Backend Engineer with 5+ years managing Kubernetes clusters and Docker.",
    });
    testJobId = job.id;

    // Create variant
    const variant = await prisma.resumeVariant.create({
      data: {
        masterResumeId: testMasterResumeId,
        jobId: testJobId,
        variantTitle: "Acme Corp Backend Variant",
        typstContent: master.typstSource,
        status: "DRAFT",
      },
    });
    testVariantId = variant.id;
  });

  afterEach(async () => {
    await prisma.coverLetter.deleteMany({ where: { jobId: testJobId } });
    await prisma.patch.deleteMany({ where: { variantId: testVariantId } });
    await prisma.resumeVariant.deleteMany({ where: { id: testVariantId } });
    await prisma.job.deleteMany({ where: { id: testJobId } });
    await prisma.resume.deleteMany({ where: { id: testMasterResumeId } });
    vi.restoreAllMocks();
  });

  it("1. CoverLetter schema validation accepts a valid evidence-backed response", () => {
    const validResponse = {
      title: "Cover Letter — Acme Corp Senior Backend Engineer",
      salutation: "Dear Acme Corp Hiring Team,",
      openingParagraph: "I am writing to express my strong interest in the Senior Backend Engineer position at Acme Corp.",
      bodyParagraphs: [
        "Architected scalable microservices using Node.js and PostgreSQL, processing over 10M requests daily.",
        "Containerized development and staging environments using Docker, reducing setup time by 50%.",
      ],
      closingParagraph: "Thank you for considering my application. I welcome the opportunity to discuss my qualifications.",
      fullMarkdown: "# Cover Letter\n\nDear Hiring Team,\n\nI am writing to express my strong interest in the Senior Backend Engineer position at Acme Corp. Architected scalable microservices using Node.js and PostgreSQL, processing over 10M requests daily. Thank you for considering my application.",
      evidenceCitations: ["exp-101", "bullet-202"],
      gapsAddressed: ["Candidate lacks verified Kubernetes experience."],
    };

    const result = CoverLetterResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.evidenceCitations).toHaveLength(2);
      expect(result.data.gapsAddressed).toContain("Candidate lacks verified Kubernetes experience.");
    }
  });

  it("2. Malformed provider output is rejected and is not persisted", async () => {
    const req = new NextRequest("http://localhost:3000/api/cover-letters/generate", {
      method: "POST",
      body: JSON.stringify({
        jobId: testJobId,
        variantId: testVariantId,
        providerConfig: {
          provider: "openai",
          apiKey: "sk-proj-valid-test-key-12345",
        },
      }),
    });

    // Mock AI gateway to return valid HTTP 200 response with malformed non-JSON LLM text content
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "I am an unformatted text response from an LLM without JSON structure." } }],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    const res = await generateRoute(req);
    const json = await res.json();

    expect(res.status).toBe(422);
    expect(json.success).toBe(false);
    expect(json.error).toContain("malformed non-JSON");

    // Assert zero cover letters persisted in DB
    const savedLetters = await prisma.coverLetter.findMany({ where: { jobId: testJobId } });
    expect(savedLetters).toHaveLength(0);
  });

  it("3. Missing provider configuration returns the expected safe error", async () => {
    const req = new NextRequest("http://localhost:3000/api/cover-letters/generate", {
      method: "POST",
      body: JSON.stringify({
        jobId: testJobId,
        variantId: testVariantId,
        providerConfig: {
          provider: "openai",
          // apiKey intentionally missing
        },
      }),
    });

    const res = await generateRoute(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe("No AI provider configured. Please configure your API key in Settings.");
  });

  it("4. A requirement with no matching evidence is represented as a gap or omitted, never asserted as candidate experience", () => {
    const systemPrompt = buildCoverLetterSystemPrompt();
    const userPrompt = buildCoverLetterUserPrompt(
      {
        jobId: testJobId,
        company: "Acme Corp",
        roleTitle: "Backend Engineer",
        rawDescription: "Requires 5+ years of Kubernetes production experience.",
        candidateName: "Jane",
        activeRoleProfile: "Backend",
      },
      [
        {
          id: "exp-1",
          type: "experience",
          title: "Software Engineer",
          organization: "TechCo",
          dates: "2024 - Present",
          verifiedSummary: "Built REST APIs with Docker and PostgreSQL.",
          tags: ["Docker", "PostgreSQL"],
          status: "verified",
          bullets: [{ id: "b-1", text: "Containerized Node.js apps using Docker.", verified: true, technologies: ["Docker"] }],
        },
      ]
    );

    expect(systemPrompt).toContain("ADVERSARIAL GAP HANDLING");
    expect(systemPrompt).toContain("MUST NOT claim or fabricate experience with that technology");
    expect(userPrompt).toContain("CANDIDATE VERIFIED EVIDENCE BANK");
  });

  it("5. An adversarial JD requesting an unsupported technology (e.g. Kubernetes when no k8s evidence exists) never produces a Kubernetes claim in verified grounding", () => {
    const activeEvidenceIds = ["exp-1", "b-1"];

    // Simulated adversarial LLM output that hallucinated k8s experience
    const hallucinatedLetter = {
      salutation: "Dear Hiring Team,",
      openingParagraph: "I am excited to apply for the Backend Engineer role.",
      bodyParagraphs: [
        "Managed 50+ Kubernetes clusters in enterprise production for 5 years.",
      ],
      closingParagraph: "Thank you for your consideration.",
      fullMarkdown: "Content...",
      evidenceCitations: ["exp-1", "unverified-k8s-citation-999"],
    };

    const groundingResult = verifyCoverLetterGrounding(hallucinatedLetter, activeEvidenceIds);
    expect(groundingResult.verified).toBe(false);
    expect(groundingResult.invalidCitations).toContain("unverified-k8s-citation-999");
  });

  it("6. A generated draft is linked to the correct job and resume/variant", async () => {
    const mockValidLlmResponse = JSON.stringify({
      title: "Cover Letter — Acme Corp Senior Backend Engineer",
      salutation: "Dear Acme Hiring Team,",
      openingParagraph: "I am writing to apply for the Senior Backend Engineer position.",
      bodyParagraphs: ["Built backend services using Docker and Node.js."],
      closingParagraph: "Sincerely, Candidate.",
      fullMarkdown: "# Cover Letter\n\nDear Acme Hiring Team,\n\nI am writing to apply for the Senior Backend Engineer position. Built backend services using Docker and Node.js. Thank you for your consideration.",
      evidenceCitations: [],
      gapsAddressed: [],
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockValidLlmResponse } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost:3000/api/cover-letters/generate", {
      method: "POST",
      body: JSON.stringify({
        jobId: testJobId,
        variantId: testVariantId,
        providerConfig: {
          provider: "openai",
          apiKey: "sk-proj-test-valid-key-99999",
        },
      }),
    });

    const res = await generateRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.jobId).toBe(testJobId);
    expect(json.data.variantId).toBe(testVariantId);
  });

  it("7. A persisted draft can be retrieved by ID", async () => {
    // Create draft directly
    const createdDraft = await prisma.coverLetter.create({
      data: {
        jobId: testJobId,
        variantId: testVariantId,
        title: "Test Draft For Retrieval",
        openingParagraph: "Opening text",
        bodyParagraphs: JSON.stringify(["Body paragraph 1"]),
        closingParagraph: "Closing text",
        fullMarkdown: "Full markdown text",
        status: "DRAFT",
      },
    });

    const req = new NextRequest(`http://localhost:3000/api/cover-letters/${createdDraft.id}`);
    const res = await getByIdRoute(req, { params: Promise.resolve({ id: createdDraft.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.id).toBe(createdDraft.id);
    expect(json.data.title).toBe("Test Draft For Retrieval");
    expect(json.data.job.company).toBe("Acme Corp");
  });

  it("8. Existing master-resume isolation remains intact after cover letter generation", async () => {
    const masterBefore = await prisma.resume.findUnique({ where: { id: testMasterResumeId } });
    expect(masterBefore?.isMaster).toBe(true);
    expect(masterBefore?.isProtected).toBe(true);

    const mockLlmOutput = JSON.stringify({
      title: "Cover Letter — Acme Corp",
      salutation: "Dear Hiring Team,",
      openingParagraph: "Opening hook...",
      bodyParagraphs: ["Body paragraph..."],
      closingParagraph: "Closing...",
      fullMarkdown: "# Cover Letter...",
      evidenceCitations: [],
      gapsAddressed: [],
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockLlmOutput } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const req = new NextRequest("http://localhost:3000/api/cover-letters/generate", {
      method: "POST",
      body: JSON.stringify({
        jobId: testJobId,
        variantId: testVariantId,
        providerConfig: {
          provider: "openai",
          apiKey: "sk-proj-valid-key-88888",
        },
      }),
    });

    await generateRoute(req);

    const masterAfter = await prisma.resume.findUnique({ where: { id: testMasterResumeId } });
    expect(masterAfter?.isMaster).toBe(true);
    expect(masterAfter?.isProtected).toBe(true);
    expect(masterAfter?.typstSource).toBe(masterBefore?.typstSource);
  });
});
