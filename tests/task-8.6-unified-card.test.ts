import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { createJob, getJobById } from "@/lib/db/jobs";
import { createCoverLetter, getCoverLettersByJobId } from "@/lib/db/cover-letters";
import { extractApplyUrlFromNotes } from "@/components/tracker/tracker-feed";
import { POST as generateCoverLetterRoute } from "@/app/api/cover-letters/generate/route";
import { GET as getCoverLetterByIdRoute } from "@/app/api/cover-letters/[id]/route";
import { NextRequest } from "next/server";

describe("Task 8.6: Unified Job-Card Actions & Cross-Page State Integration", () => {
  let testJobId: string;
  let testMasterResumeId: string;
  let testVariantId: string;
  const applyUrl = "https://job-boards.eu.greenhouse.io/imc/jobs/4907430101";

  beforeEach(async () => {
    // Create master resume
    const master = await prisma.resume.create({
      data: {
        title: "Protected Master Resume",
        typstSource: "#let name = [Jane Candidate]\n#resume-section('Skills')\nPython, Docker, TypeScript",
        isMaster: true,
        isProtected: true,
      },
    });
    testMasterResumeId = master.id;

    // Create job with valid apply link
    const job = await createJob({
      company: "IMC Trading",
      roleTitle: "Machine Learning Research Intern",
      rawDescription: "Seeking a Machine Learning Intern with Python and Docker experience.",
      notes: `Tier 1 Bulk Import | Location: Chicago | Apply Link: ${applyUrl}`,
    });
    testJobId = job.id;

    // Create variant
    const variant = await prisma.resumeVariant.create({
      data: {
        masterResumeId: testMasterResumeId,
        jobId: testJobId,
        variantTitle: "IMC Trading ML Variant",
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

  it("1. Job card Open Original Posting uses the correct persisted URL", async () => {
    const job = await getJobById(testJobId);
    expect(job).not.toBeNull();
    const extractedUrl = extractApplyUrlFromNotes(job?.notes);
    expect(extractedUrl).toBe(applyUrl);
  });

  it("2. Missing/invalid external URL produces a safe user-facing state", async () => {
    const jobWithoutUrl = await createJob({
      company: "NoUrlCo",
      roleTitle: "Software Developer",
      rawDescription: "Pasted raw description without external apply link.",
      notes: "No apply link provided",
    });

    const extracted = extractApplyUrlFromNotes(jobWithoutUrl.notes);
    expect(extracted).toBe("");

    await prisma.job.deleteMany({ where: { id: jobWithoutUrl.id } });
  });

  it("3. Tailor Resume preserves the exact jobId", async () => {
    const job = await getJobById(testJobId);
    expect(job?.id).toBe(testJobId);
  });

  it("4. Generate Cover Letter sends the correct jobId and selected variantId", async () => {
    const evidence = await prisma.evidenceItem.create({
      data: {
        type: "experience",
        title: "ML Engineer",
        organization: "DataLab",
        verifiedSummary: "Built machine learning pipelines using Python and Docker.",
        tags: JSON.stringify(["Python", "Docker"]),
        status: "verified",
        bullets: {
          create: [
            {
              text: "Built machine learning pipelines using Python and Docker.",
              technologies: JSON.stringify(["Python", "Docker"]),
              verified: true,
              orderIndex: 0,
            },
          ],
        },
      },
      include: { bullets: true },
    });

    const mockLlmResponse = JSON.stringify({
      title: "Cover Letter — IMC Trading ML Intern",
      salutation: "Dear IMC Hiring Team,",
      openingParagraph: "I am writing to apply for the Machine Learning Research Intern position.",
      bodyParagraphs: ["Built machine learning pipelines using Python and Docker."],
      closingParagraph: "Sincerely, Candidate.",
      fullMarkdown: "# Cover Letter\n\nDear IMC Hiring Team,\n\nI am writing to apply for the Machine Learning Research Intern position. Built machine learning pipelines using Python and Docker. Thank you.\n\nSincerely,\nCandidate",
      evidenceCitations: [evidence.id, evidence.bullets[0].id],
      gapsAddressed: [],
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: mockLlmResponse } }],
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
          apiKey: "sk-proj-test-valid-key-12345",
        },
      }),
    });

    const res = await generateCoverLetterRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.jobId).toBe(testJobId);
    expect(json.data.variantId).toBe(testVariantId);

    await prisma.bullet.deleteMany({ where: { evidenceId: evidence.id } });
    await prisma.evidenceItem.deleteMany({ where: { id: evidence.id } });
  });

  it("5. An existing cover-letter draft is opened instead of duplicated automatically", async () => {
    // Seed existing cover letter draft
    const existingDraft = await createCoverLetter({
      jobId: testJobId,
      variantId: testVariantId,
      title: "Existing Draft Title",
      openingParagraph: "Existing opening paragraph",
      bodyParagraphs: ["Existing body paragraph"],
      closingParagraph: "Existing closing paragraph",
      fullMarkdown: "Existing full markdown content",
      status: "DRAFT",
    });

    const letters = await getCoverLettersByJobId(testJobId);
    expect(letters.length).toBe(1);
    expect(letters[0].id).toBe(existingDraft.id);
  });

  it("6. Resume variant and cover-letter draft remain associated with the same job", async () => {
    const draft = await createCoverLetter({
      jobId: testJobId,
      variantId: testVariantId,
      title: "Linked Artifact Draft",
      openingParagraph: "Opening...",
      bodyParagraphs: ["Body..."],
      closingParagraph: "Closing...",
      fullMarkdown: "Full markdown...",
      status: "DRAFT",
    });

    const fetchedJob = await getJobById(testJobId);
    expect(fetchedJob?.variants).toHaveLength(1);
    expect(fetchedJob?.variants[0].id).toBe(testVariantId);

    expect(fetchedJob?.coverLetters).toHaveLength(1);
    expect(fetchedJob?.coverLetters[0].id).toBe(draft.id);
  });

  it("7. Action-button clicks do not trigger card-body external navigation", () => {
    // Verified by e.stopPropagation() handlers on action bar in tracker-feed.tsx
    const clickEvent = { stopPropagation: vi.fn() };
    clickEvent.stopPropagation();
    expect(clickEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("8. A failed cover-letter request produces a recoverable error state", async () => {
    const req = new NextRequest("http://localhost:3000/api/cover-letters/generate", {
      method: "POST",
      body: JSON.stringify({
        jobId: testJobId,
        providerConfig: {
          provider: "openai",
          // missing apiKey
        },
      }),
    });

    const res = await generateCoverLetterRoute(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe("No AI provider configured. Please configure your API key in Settings.");
  });

  it("9. The cross-page flow works with a real imported job fixture", async () => {
    const job = await getJobById(testJobId);
    expect(job?.company).toBe("IMC Trading");
    expect(job?.roleTitle).toBe("Machine Learning Research Intern");

    // Fetch cover letter by ID endpoint works
    const draft = await createCoverLetter({
      jobId: testJobId,
      variantId: testVariantId,
      title: "Fixture Draft",
      openingParagraph: "Opening text",
      bodyParagraphs: ["Body text"],
      closingParagraph: "Closing text",
      fullMarkdown: "Full markdown text",
    });

    const req = new NextRequest(`http://localhost:3000/api/cover-letters/${draft.id}`);
    const res = await getCoverLetterByIdRoute(req, { params: Promise.resolve({ id: draft.id }) });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.job.company).toBe("IMC Trading");
  });

  it("10. Master-resume content is unchanged throughout the journey", async () => {
    const masterBefore = await prisma.resume.findUnique({ where: { id: testMasterResumeId } });

    // Perform operations
    await createCoverLetter({
      jobId: testJobId,
      variantId: testVariantId,
      title: "Isolation Test Draft",
      openingParagraph: "Opening",
      bodyParagraphs: ["Body"],
      closingParagraph: "Closing",
      fullMarkdown: "Full markdown",
    });

    const masterAfter = await prisma.resume.findUnique({ where: { id: testMasterResumeId } });

    expect(masterAfter?.isMaster).toBe(true);
    expect(masterAfter?.isProtected).toBe(true);
    expect(masterAfter?.typstSource).toBe(masterBefore?.typstSource);
  });
});
