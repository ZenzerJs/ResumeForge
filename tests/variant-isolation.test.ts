import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../src/lib/prisma";
import { createResume } from "../src/lib/db/resumes";
import { createVariant, updateVariant, assertNotProtectedResume } from "../src/lib/db/variants";

describe("Amendment 3: Master Resume Isolation & Variant Protection", () => {
  let masterResumeId: string;
  let jobId: string;

  beforeEach(async () => {
    // Clean up test data
    await prisma.patch.deleteMany();
    await prisma.resumeVariant.deleteMany();
    await prisma.job.deleteMany();
    await prisma.resume.deleteMany();

    // Create a protected master resume
    const master = await createResume({
      title: "Test Master Resume",
      typstSource: "#set page(paper: \"us-letter\")\n= Test Resume\nHello World",
      isMaster: true,
    });
    masterResumeId = master.id;

    // Create a test job
    const job = await prisma.job.create({
      data: {
        rawDescription: "Test job description",
        company: "Test Corp",
        roleTitle: "Test Engineer",
      },
    });
    jobId = job.id;
  });

  it("master resume has isProtected=true by default", async () => {
    const resume = await prisma.resume.findUnique({ where: { id: masterResumeId } });
    expect(resume).not.toBeNull();
    expect(resume!.isProtected).toBe(true);
    expect(resume!.isMaster).toBe(true);
  });

  it("createVariant successfully creates a ResumeVariant", async () => {
    const variant = await createVariant({
      masterResumeId,
      jobId,
      variantTitle: "Test Variant",
      typstContent: "#set page(paper: \"us-letter\")\n= Tailored Resume",
    });

    expect(variant.id).toBeDefined();
    expect(variant.masterResumeId).toBe(masterResumeId);
    expect(variant.jobId).toBe(jobId);
    expect(variant.status).toBe("DRAFT");
  });

  it("assertNotProtectedResume throws for protected master resume", async () => {
    await expect(assertNotProtectedResume(masterResumeId)).rejects.toThrow("SECURITY");
  });

  it("assertNotProtectedResume does NOT throw for a non-existent ID", async () => {
    // Non-existent IDs don't match any protected resume, so no throw
    await expect(assertNotProtectedResume("nonexistent-id")).resolves.toBeUndefined();
  });

  it("updateVariant succeeds for a valid ResumeVariant", async () => {
    const variant = await createVariant({
      masterResumeId,
      jobId,
      variantTitle: "Original Title",
      typstContent: "Original content",
    });

    const updated = await updateVariant(variant.id, {
      variantTitle: "Updated Title",
      status: "REVIEWED",
    });

    expect(updated.variantTitle).toBe("Updated Title");
    expect(updated.status).toBe("REVIEWED");
  });

  it("updateVariant throws for non-existent variant ID", async () => {
    await expect(
      updateVariant("nonexistent-variant-id", { variantTitle: "Bad" })
    ).rejects.toThrow("ResumeVariant not found");
  });

  it("variant does NOT modify the master resume content", async () => {
    // Create a variant with different content
    await createVariant({
      masterResumeId,
      jobId,
      variantTitle: "Tailored Version",
      typstContent: "Completely different content",
    });

    // Verify master resume is untouched
    const master = await prisma.resume.findUnique({ where: { id: masterResumeId } });
    expect(master!.typstSource).toBe("#set page(paper: \"us-letter\")\n= Test Resume\nHello World");
    expect(master!.isProtected).toBe(true);
  });
});
