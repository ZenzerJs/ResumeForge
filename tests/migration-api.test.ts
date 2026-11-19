import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/auth/migrate-guest-drafts/route";
import { authedRequest, createTestUser } from "./helpers/auth";
import { prisma } from "@/lib/prisma";
import { parseGuestEvidenceItems } from "@/components/auth/guest-migration-modal";

describe("Migrate Guest Drafts API Endpoint (POST /api/auth/migrate-guest-drafts)", () => {
  it("rejects unauthenticated requests with 401", async () => {
    const request = new Request("http://localhost:3000/api/auth/migrate-guest-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typstSource: "= Jane Doe\n== EXPERIENCE\n*Stripe*",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const json = await response.json();
    expect(json.code).toBe("GUEST_READ_ONLY");
  });

  it("migrates first draft as Master Resume for new user without existing master", async () => {
    const { user, cookie } = await createTestUser();

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= First User\n== EXPERIENCE\n*Apple* -- Engineer",
          title: "Initial Master Baseline",
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.isMaster).toBe(true);
    expect(json.data.resumeId).toBeDefined();

    // Verify in database
    const dbResume = await prisma.resume.findUnique({
      where: { id: json.data.resumeId },
    });
    expect(dbResume?.isMaster).toBe(true);
    expect(dbResume?.userId).toBe(user.id);
  });

  it("handles conflict with IMPORT_AS_DRAFT: keeps existing master safe and saves as non-master draft", async () => {
    const { user, cookie } = await createTestUser();

    // Create existing master resume
    const master = await prisma.resume.create({
      data: {
        userId: user.id,
        title: "Existing Verified Master",
        typstSource: "= Existing Master\n== EXPERIENCE\n*Google*",
        isMaster: true,
        isProtected: true,
      },
    });

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= Guest Draft\n== EXPERIENCE\n*Stripe*",
          title: "Imported Draft",
          conflictStrategy: "IMPORT_AS_DRAFT",
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.isMaster).toBe(false);

    // Verify master is still intact
    const activeMaster = await prisma.resume.findFirst({
      where: { userId: user.id, isMaster: true },
    });
    expect(activeMaster?.id).toBe(master.id);
  });

  it("rejects REPLACE_MASTER with 400 CONFIRMATION_REQUIRED when confirmReplaceMaster is missing or false", async () => {
    const { user, cookie } = await createTestUser();

    await prisma.resume.create({
      data: {
        userId: user.id,
        title: "Active Master",
        typstSource: "= Active Master\n== EXPERIENCE\n*Google*",
        isMaster: true,
        isProtected: true,
      },
    });

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= Unconfirmed Replacement\n== EXPERIENCE\n*Netflix*",
          conflictStrategy: "REPLACE_MASTER",
          confirmReplaceMaster: false,
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("CONFIRMATION_REQUIRED");
    expect(json.message).toContain("Explicit confirmReplaceMaster confirmation is required");
  });

  it("handles confirmed REPLACE_MASTER: creates pre-write MasterHistory snapshot and replaces master atomically", async () => {
    const { user, cookie } = await createTestUser();

    // Create existing master resume
    const oldMaster = await prisma.resume.create({
      data: {
        userId: user.id,
        title: "Old Master",
        typstSource: "= Old Master\n== EXPERIENCE\n*Amazon*",
        isMaster: true,
        isProtected: true,
      },
    });

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= New Master\n== EXPERIENCE\n*Meta*",
          title: "New Master Resume",
          conflictStrategy: "REPLACE_MASTER",
          confirmReplaceMaster: true,
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.isMaster).toBe(true);
    expect(json.data.historySnapshotCreated).toBe(true);

    // Old master is demoted
    const prevMaster = await prisma.resume.findUnique({
      where: { id: oldMaster.id },
    });
    expect(prevMaster?.isMaster).toBe(false);

    // Snapshot was created for old master
    const snapshots = await (prisma as any).masterHistory.findMany({
      where: { resumeId: oldMaster.id },
    });
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
    expect(snapshots[0].reason).toBe("GUEST_MIGRATION_OVERWRITE");

    // New master is active
    const newMaster = await prisma.resume.findUnique({
      where: { id: json.data.resumeId },
    });
    expect(newMaster?.isMaster).toBe(true);
    expect(newMaster?.typstSource).toContain("Meta");
  });

  it("handles idempotent replays with the same migrationId", async () => {
    const { cookie } = await createTestUser();
    const migrationId = "123e4567-e89b-12d3-a456-426614174000";

    const payload = {
      typstSource: "= Replay Resume\n== EXPERIENCE\n*Figma*",
      title: "Replay Test Resume",
      conflictStrategy: "IMPORT_AS_DRAFT" as const,
      migrationId,
    };

    // First request
    const req1 = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      cookie
    );

    const res1 = await POST(req1);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    const resumeId1 = json1.data.resumeId;

    // Second (replayed) request with identical migrationId and source
    const req2 = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      cookie
    );

    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const json2 = await res2.json();

    expect(json2.success).toBe(true);
    expect(json2.data.resumeId).toBe(resumeId1);
    expect(json2.data.migrationId).toBe(migrationId);
  });

  it("executes deduped evidenceItems on replay when existingMatch exists and skips creating a duplicate resume", async () => {
    const { user, cookie } = await createTestUser();
    const migrationId = "423e4567-e89b-12d3-a456-426614174000";
    const typstSource = "= Replay With Evidence\n== EXPERIENCE\n*Stripe*";

    const existingResume = await prisma.resume.create({
      data: {
        userId: user.id,
        title: "Imported Guest Resume",
        typstSource,
        isMaster: true,
        isProtected: true,
      },
    });

    const batch0Evidence = [
      {
        title: "Batch 0 Distributed Queue",
        organization: "Stripe",
        category: "EXPERIENCE",
        tags: ["Go", "Kafka"],
        bullets: ["Handled 50k msg/s."],
      },
      {
        title: "Batch 0 Telemetry Pipeline",
        organization: "Stripe",
        category: "PROJECT",
        tags: ["TypeScript"],
        bullets: ["Cut alert latency by 30%."],
      },
    ];

    const replay1 = await POST(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typstSource,
            conflictStrategy: "IMPORT_AS_DRAFT",
            evidenceItems: batch0Evidence,
            migrationId,
          }),
        },
        cookie
      )
    );
    expect(replay1.status).toBe(200);
    const json1 = await replay1.json();
    expect(json1.success).toBe(true);
    expect(json1.data.resumeId).toBe(existingResume.id);
    expect(json1.data.isMaster).toBe(true);
    expect(json1.data.evidenceCount).toBe(2);
    expect(json1.data.skippedDuplicateCount).toBe(0);
    expect(await prisma.resume.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.evidenceItem.count({ where: { userId: user.id } })).toBe(2);

    const replay2 = await POST(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typstSource,
            conflictStrategy: "IMPORT_AS_DRAFT",
            evidenceItems: batch0Evidence,
            migrationId,
          }),
        },
        cookie
      )
    );
    expect(replay2.status).toBe(200);
    const json2 = await replay2.json();
    expect(json2.data.resumeId).toBe(existingResume.id);
    expect(json2.data.evidenceCount).toBe(0);
    expect(json2.data.skippedDuplicateCount).toBe(2);
    expect(await prisma.resume.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.evidenceItem.count({ where: { userId: user.id } })).toBe(2);
  });

  it("handles conflict with DISCARD: skips resume creation cleanly", async () => {
    const { cookie } = await createTestUser();

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= Discard Me",
          conflictStrategy: "DISCARD",
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.discarded).toBe(true);
    expect(json.data.resumeId).toBeNull();
  });

  it("rejects oversized payloads with 400 Bad Request", async () => {
    const { cookie } = await createTestUser();

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "A".repeat(600_000), // Exceeds 500k limit
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(400);

    const json = await response.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Invalid request payload");
  });

  it("migrates and deduplicates evidence items scoped strictly to userId", async () => {
    const { user, cookie } = await createTestUser();

    const evidencePayload = [
      {
        title: "Payments Microservice",
        organization: "Stripe",
        category: "EXPERIENCE",
        tags: ["TypeScript", "PostgreSQL"],
        bullets: ["Scaled query throughput reducing latency by 45ms."],
      },
      {
        title: "Payments Microservice", // Duplicate title: should be skipped
        organization: "Stripe",
        category: "EXPERIENCE",
      },
      {
        title: "Design System UI",
        organization: "Airbnb",
        category: "PROJECT",
        tags: ["React"],
        bullets: ["Engineered accessible component library."],
      },
    ];

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typstSource: "= Jane Doe\n== EXPERIENCE\n*Stripe*",
          evidenceItems: evidencePayload,
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.data.evidenceCount).toBe(2);
    expect(json.data.skippedDuplicateCount).toBe(1);

    // Verify in database
    const userEvidence = await prisma.evidenceItem.findMany({
      where: { userId: user.id },
    });
    expect(userEvidence.length).toBe(2);
  });

  it("imports evidence-only payload without creating a Master Resume", async () => {
    const { user, cookie } = await createTestUser();

    const request = authedRequest(
      "http://localhost:3000/api/auth/migrate-guest-drafts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceOnly: true,
          conflictStrategy: "IMPORT_AS_DRAFT",
          evidenceItems: [
            {
              title: "Search Ranking Pipeline",
              organization: "Shopify",
              category: "PROJECT",
              tags: ["Go", "Redis"],
              bullets: ["Reduced p95 latency by 35%."],
            },
          ],
          migrationId: "223e4567-e89b-12d3-a456-426614174000",
        }),
      },
      cookie
    );

    const response = await POST(request);
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.resumeId).toBeNull();
    expect(json.data.isMaster).toBe(false);
    expect(json.data.evidenceCount).toBe(1);

    const resumeCount = await prisma.resume.count({ where: { userId: user.id } });
    expect(resumeCount).toBe(0);

    const evidenceCount = await prisma.evidenceItem.count({ where: { userId: user.id } });
    expect(evidenceCount).toBe(1);
  });

  it("preserves guest evidence fields and only imports explicit verification", async () => {
    const { user, cookie } = await createTestUser();
    const evidenceItems = parseGuestEvidenceItems(JSON.stringify([
      {
        type: "experience",
        title: "Systems Work",
        organization: "Example Co",
        dates: "2024 – 2025",
        verifiedSummary: "Maintained internal systems.",
        status: "verified",
        tags: ["Systems"],
        bullets: [
          { text: "Draft claim", verified: false, orderIndex: 4 },
          { text: "Verified claim", verified: true, technologies: ["Go"], roleAffinity: ["Backend"], orderIndex: 2 },
          "Legacy bullet",
        ],
      },
      { title: "Archived item", status: "archived", bullets: [{ text: "Previously verified", verified: true }] },
      { title: "Draft item", status: "draft", bullets: [{ text: "In progress", verified: false }] },
      { title: "Verified without summary", status: "verified", bullets: ["Unverified legacy claim"] },
      {
        title: "Verified with mixed bullets",
        status: "verified",
        bullets: [{ text: "Draft claim", verified: false }, { text: "Grounded claim", verified: true }],
      },
    ]));
    const response = await POST(authedRequest("http://localhost:3000/api/auth/migrate-guest-drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidenceOnly: true, evidenceItems: [...evidenceItems, { title: "Legacy item", bullets: ["Old claim"] }] }),
    }, cookie));

    expect(response.status).toBe(200);
    const items = await prisma.evidenceItem.findMany({ where: { userId: user.id }, include: { bullets: true } });
    const byTitle = new Map(items.map((item) => [item.title, item]));
    expect(byTitle.get("Systems Work")).toMatchObject({
      status: "verified",
      type: "experience",
      organization: "Example Co",
      dates: "2024 – 2025",
      verifiedSummary: "Maintained internal systems.",
      tags: '["Systems"]',
      bullets: expect.arrayContaining([
        expect.objectContaining({ text: "Draft claim", verified: false, orderIndex: 4 }),
        expect.objectContaining({ text: "Verified claim", verified: true, technologies: '["Go"]', roleAffinity: '["Backend"]', orderIndex: 2 }),
        expect.objectContaining({ text: "Legacy bullet", verified: false }),
      ]),
    });
    expect(byTitle.get("Archived item")).toMatchObject({ status: "archived", bullets: [{ verified: true }] });
    expect(byTitle.get("Draft item")).toMatchObject({ status: "draft", bullets: [{ verified: false }] });
    expect(byTitle.get("Legacy item")).toMatchObject({ status: "draft", bullets: [{ verified: false }] });
    expect(byTitle.get("Verified without summary")?.verifiedSummary).toBe("Verified without summary");
    expect(byTitle.get("Verified with mixed bullets")?.verifiedSummary).toBe("Grounded claim");
  });

  it("supports multi-batch >50 evidence migration with evidenceOnly on subsequent batches sharing migrationId", async () => {
    const { user, cookie } = await createTestUser();
    const migrationId = "323e4567-e89b-12d3-a456-426614174000";

    const batch0Items = Array.from({ length: 50 }, (_, i) => ({
      title: `Batch Item ${i + 1}`,
      category: "PROJECT",
      bullets: [`Bullet ${i + 1}`],
    }));
    const batch1Items = Array.from({ length: 15 }, (_, i) => ({
      title: `Batch Item ${51 + i}`,
      category: "PROJECT",
      bullets: [`Bullet ${51 + i}`],
    }));

    const res0 = await POST(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typstSource: "= Multi Batch User\n== EXPERIENCE\n*Linear*",
            conflictStrategy: "IMPORT_AS_DRAFT",
            evidenceItems: batch0Items,
            migrationId,
          }),
        },
        cookie
      )
    );
    expect(res0.status).toBe(200);
    const json0 = await res0.json();
    expect(json0.data.evidenceCount).toBe(50);

    const res1 = await POST(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceOnly: true,
            conflictStrategy: "IMPORT_AS_DRAFT",
            evidenceItems: batch1Items,
            migrationId,
          }),
        },
        cookie
      )
    );
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.data.resumeId).toBeNull();
    expect(json1.data.evidenceCount).toBe(15);

    const totalEvidence = await prisma.evidenceItem.count({ where: { userId: user.id } });
    expect(totalEvidence).toBe(65);
    const totalResumes = await prisma.resume.count({ where: { userId: user.id } });
    expect(totalResumes).toBe(1);
  });

  it("rejects evidenceOnly=true when evidenceItems is empty", async () => {
    const { cookie } = await createTestUser();

    const response = await POST(
      authedRequest(
        "http://localhost:3000/api/auth/migrate-guest-drafts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidenceOnly: true,
            evidenceItems: [],
          }),
        },
        cookie
      )
    );
    expect(response.status).toBe(400);
  });
});
