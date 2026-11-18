import { describe, it, expect, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { POST as evaluateAts } from "@/app/api/ats/evaluate/route";
import { POST as migrateGuestDrafts } from "@/app/api/auth/migrate-guest-drafts/route";
import { POST as createResumeRoute } from "@/app/api/resumes/route";
import { POST as matchJobsRoute } from "@/app/api/jobs/match/route";
import { extractResumeFacts } from "@/lib/facts/extract";
import {
  buildResumeDocument,
  renderResumeDocument,
  type ResumeAssignment,
} from "@/lib/typst/resume-document";
import { getJobsList } from "@/lib/db/jobs";
import { prisma } from "@/lib/prisma";
import { authedNextRequest, authedRequest, createTestUser } from "./helpers/auth";

describe("Phase 4 Optimization & WUI Regressions", () => {
  const createdUserIds: string[] = [];
  const createdJobIds: string[] = [];

  afterAll(async () => {
    if (createdJobIds.length > 0) {
      await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.resume.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.evidenceItem.deleteMany({ where: { userId: { in: createdUserIds } } });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("1. POST /api/ats/evaluate enforces cross-tenant jobId isolation without leaking private roleTitle, rawDescription, or extractedRequirements", async () => {
    const owner = await createTestUser();
    const attacker = await createTestUser();
    createdUserIds.push(owner.user.id, attacker.user.id);

    const privateJob = await prisma.job.create({
      data: {
        userId: owner.user.id,
        company: "VaultPrivateCorp",
        roleTitle: "Principal AI/LLM Kernel Architect",
        rawDescription:
          "Confidential QuantumWidget88 platform requiring SecretTokenAlpha99 and SecretTokenBeta77.",
        extractedRequirements: JSON.stringify({
          requiredSkills: ["SecretTokenAlpha99"],
          preferredSkills: ["SecretTokenBeta77"],
          domainTerms: ["QuantumWidget88"],
        }),
      },
    });
    createdJobIds.push(privateJob.id);

    const sampleResume = "= Bob Smith\n== EXPERIENCE\n*Acme* -- Backend Engineer\n- Built REST APIs.";

    const attackerReq = authedNextRequest(
      "http://localhost:3000/api/ats/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: privateJob.id,
          typstContent: sampleResume,
        }),
      },
      attacker.cookie
    );

    const attackerRes = await evaluateAts(attackerReq);
    const attackerJson = await attackerRes.json();
    const attackerSerialized = JSON.stringify(attackerJson);

    expect([200, 403, 404]).toContain(attackerRes.status);
    expect(attackerSerialized).not.toContain("SecretTokenAlpha99");
    expect(attackerSerialized).not.toContain("SecretTokenBeta77");
    expect(attackerSerialized).not.toContain("QuantumWidget88");
    expect(attackerSerialized).not.toContain("Principal AI/LLM Kernel Architect");

    if (attackerRes.status === 200) {
      expect(attackerJson.data.skillEvaluations).toEqual([]);
      expect(attackerJson.data.gaps).toEqual([]);
      expect(attackerJson.data.selectedProfile).not.toBe("AI/LLM");
    }

    // Unauthenticated guest must also not read owner's private job
    const guestReq = new NextRequest("http://localhost:3000/api/ats/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobId: privateJob.id,
        typstContent: sampleResume,
      }),
    });
    const guestRes = await evaluateAts(guestReq);
    const guestSerialized = JSON.stringify(await guestRes.json());
    expect([200, 401, 403, 404]).toContain(guestRes.status);
    expect(guestSerialized).not.toContain("SecretTokenAlpha99");
    expect(guestSerialized).not.toContain("QuantumWidget88");

    // Owner still resolves their own private job
    const ownerReq = authedNextRequest(
      "http://localhost:3000/api/ats/evaluate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: privateJob.id,
          typstContent: sampleResume,
        }),
      },
      owner.cookie
    );
    const ownerRes = await evaluateAts(ownerReq);
    expect(ownerRes.status).toBe(200);
    const ownerJson = await ownerRes.json();
    expect(
      ownerJson.data.skillEvaluations.some(
        (s: { skill: string }) => s.skill === "SecretTokenAlpha99"
      )
    ).toBe(true);
  });

  it("2. POST /api/auth/migrate-guest-drafts populates factSnapshot.evidenceIds from migrated verified evidence and deduplicates whitespace replay", async () => {
    const { user, cookie } = await createTestUser();
    createdUserIds.push(user.id);

    const migrationId = crypto.randomUUID();
    const coreSource = "= Jane Doe\n== EXPERIENCE\n*Northwind* -- Backend Engineer\n- Built distributed queues.";
    const initialBody = {
      migrationId,
      title: "Guest Migrated Master",
      typstSource: `  ${coreSource}\n\n   `,
      evidenceItems: [
        {
          title: "Distributed Queue Engine",
          organization: "Northwind",
          category: "experience",
          tags: ["TypeScript", "Kafka"],
          bullets: ["Reduced p99 queue latency by 45% across 120k msg/s."],
        },
      ],
    };

    const firstRes = await migrateGuestDrafts(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initialBody),
        },
        cookie
      )
    );

    expect(firstRes.status).toBe(200);
    const firstJson = await firstRes.json();
    expect(firstJson.success).toBe(true);
    expect(firstJson.data.isMaster).toBe(true);
    expect(firstJson.data.evidenceCount).toBe(1);

    const migratedEvidence = await prisma.evidenceItem.findMany({
      where: { userId: user.id },
    });
    expect(migratedEvidence).toHaveLength(1);

    const savedResume = await prisma.resume.findUnique({
      where: { id: firstJson.data.resumeId },
    });
    expect(savedResume).not.toBeNull();
    const snapshot = savedResume!.factSnapshot as {
      evidenceIds?: string[];
      skills?: string[];
    } | null;
    expect(snapshot).not.toBeNull();
    expect(snapshot!.evidenceIds).toContain(migratedEvidence[0].id);

    // Replay with extra leading/trailing whitespace & newlines should deduplicate cleanly
    const replayRes = await migrateGuestDrafts(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...initialBody,
            typstSource: `\n\n${coreSource}\n   \n`,
          }),
        },
        cookie
      )
    );

    expect(replayRes.status).toBe(200);
    const replayJson = await replayRes.json();
    expect(replayJson.success).toBe(true);
    expect(replayJson.data.resumeId).toBe(firstJson.data.resumeId);

    const resumeCount = await prisma.resume.count({ where: { userId: user.id } });
    expect(resumeCount).toBe(1);
  });

  it("3. extractResumeFacts on V2 #block/#grid Typst extracts real employers & titles and never extracts 'block above 0.35em' as a skill", () => {
    const rows: Array<[ResumeAssignment["kind"], string]> = [
      ["name", "Morgan Example"],
      ["contact", "morgan@example.test"],
      ["section", "Experience"],
      ["entry-title", "Northwind Labs"],
      ["entry-role", "Senior Platform Engineer"],
      ["entry-location", "Remote"],
      ["entry-date", "Jan 2023 - Present"],
      ["bullet", "- Built distributed TypeScript services backed by PostgreSQL."],
      ["section", "Skills"],
      ["skill", "Languages: TypeScript, Go, PostgreSQL"],
    ];

    const source = rows.map(([, text]) => text).join("\n");
    const assignments: ResumeAssignment[] = [];
    let cursor = 0;
    for (const [kind, text] of rows) {
      const start = source.indexOf(text, cursor);
      const end = start + text.length;
      assignments.push({ kind, span: { start, end } });
      cursor = end + 1;
    }

    const v2Typst = renderResumeDocument(
      buildResumeDocument(source, assignments, "us-letter"),
      "comfortable"
    );

    // Confirm rendered V2 source actually uses #block and #grid
    expect(v2Typst).toContain("#block(above: 0.35em");
    expect(v2Typst).toContain("#grid(");

    const facts = extractResumeFacts(v2Typst);
    expect(facts.employers.length).toBeGreaterThan(0);
    expect(facts.titles.length).toBeGreaterThan(0);
    expect(
      facts.employers.some((e) => e.normalized.includes("northwind"))
    ).toBe(true);
    expect(
      facts.titles.some((t) => t.normalized.includes("platform engineer"))
    ).toBe(true);

    const normalizedSkills = facts.skills.map((s) => s.toLowerCase());
    expect(normalizedSkills).not.toContain("block above 0.35em");
    expect(normalizedSkills.some((s) => s.includes("0.35em"))).toBe(false);
    expect(normalizedSkills.some((s) => s.startsWith("block "))).toBe(false);
    expect(normalizedSkills).toContain("typescript");
  });

  it("4. POST /api/resumes and POST /api/jobs/match return HTTP 400 on malformed JSON body", async () => {
    const { user, cookie } = await createTestUser();
    createdUserIds.push(user.id);

    const badResumeRes = await createResumeRoute(
      authedRequest(
        "http://localhost:3000/api/resumes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json payload",
        },
        cookie
      )
    );
    expect(badResumeRes.status).toBe(400);
    const badResumeJson = await badResumeRes.json();
    expect(badResumeJson.success).toBe(false);

    const badMatchRes = await matchJobsRoute(
      authedRequest(
        "http://localhost:3000/api/jobs/match",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json payload",
        },
        cookie
      )
    );
    expect(badMatchRes.status).toBe(400);
    const badMatchJson = await badMatchRes.json();
    expect(badMatchJson.success).toBe(false);
  });

  it("5. getJobsList omits normalized and formattedJd JSON columns from returned rows", async () => {
    const { user } = await createTestUser();
    createdUserIds.push(user.id);

    const token = `ListOmit_${crypto.randomUUID().slice(0, 8)}`;
    const job = await prisma.job.create({
      data: {
        userId: user.id,
        company: token,
        roleTitle: "Platform Engineer",
        rawDescription: "Build TypeScript backend services.",
        normalized: { company: token, seniority: "mid" },
        formattedJd: { summary: "Build TypeScript backend services." },
      },
    });
    createdJobIds.push(job.id);

    const result = await getJobsList({ userId: user.id, q: token });
    expect(result.data.length).toBeGreaterThanOrEqual(1);

    const row = result.data.find((j) => j.id === job.id);
    expect(row).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(row, "normalized")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(row, "formattedJd")).toBe(false);
    expect("normalized" in (row as Record<string, unknown>)).toBe(false);
    expect("formattedJd" in (row as Record<string, unknown>)).toBe(false);
  });
});
