import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/auth/migrate-guest-drafts/route";
import { authedRequest, createTestUser } from "./helpers/auth";
import { prisma } from "@/lib/prisma";

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
});
