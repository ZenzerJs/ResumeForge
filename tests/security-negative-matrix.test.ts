import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as chatPOST } from "@/app/api/ai/chat/route";
import { POST as testConnectionPOST } from "@/app/api/ai/test-connection/route";
import { POST as repairTypstPOST } from "@/app/api/ai/repair-typst/route";
import { POST as extractJobPOST } from "@/app/api/jobs/extract/route";
import { POST as hydrateJobsPOST } from "@/app/api/jobs/hydrate/route";
import { POST as fetchFulltextPOST } from "@/app/api/jobs/[id]/fetch-fulltext/route";
import { PATCH as jobByIdPATCH, DELETE as jobByIdDELETE } from "@/app/api/jobs/[id]/route";
import { prisma } from "@/lib/prisma";
import { middleware } from "@/middleware";
import { rateLimit, resetRateLimitsForTests } from "@/lib/security/rate-limit";
import * as aiGateway from "@/lib/ai/gateway";
import * as tier2Fetcher from "@/lib/ingestion/tier2-fetcher";
import { authedRequest, createTestUser } from "./helpers/auth";

describe("Negative Security Regression Matrix", () => {
  const createdJobIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimitsForTests();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetRateLimitsForTests();
    if (createdJobIds.length > 0) {
      await prisma.jobApplication.deleteMany({ where: { jobId: { in: createdJobIds } } });
      await prisma.job.deleteMany({ where: { id: { in: createdJobIds } } });
      createdJobIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      createdUserIds.length = 0;
    }
  });

  const guestCases = [
    { name: "chat", withByok: false },
    { name: "chat", withByok: true },
    { name: "test-connection", withByok: false },
    { name: "test-connection", withByok: true },
    { name: "repair-typst", withByok: false },
    { name: "repair-typst", withByok: true },
    { name: "extract", withByok: false },
    { name: "extract", withByok: true },
    { name: "hydrate", withByok: false },
    { name: "hydrate", withByok: true },
    { name: "fetch-fulltext", withByok: false },
    { name: "fetch-fulltext", withByok: true },
  ] as const;

  it.each(guestCases)(
    "returns 401 before external work or DB mutation for guest $name (withByok=$withByok)",
    async ({ name, withByok }) => {
      const targetJob = await prisma.job.create({
        data: {
          company: "GuestProbeCo",
          roleTitle: "Engineer",
          rawDescription: "[Pending Import] Full job description text not yet fetched...",
          notes: "Apply Link: https://job-boards.eu.greenhouse.io/guestprobe/jobs/42",
        },
      });
      createdJobIds.push(targetJob.id);

      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockRejectedValue(new Error("Unexpected outbound fetch for unauthenticated request"));
      const gatewaySpies = [
        vi.spyOn(aiGateway, "sendChatCompletion"),
        vi.spyOn(aiGateway, "testProviderConnection"),
        vi.spyOn(aiGateway, "repairTypstSource"),
        vi.spyOn(aiGateway, "formatJobDescriptionWithAi"),
      ];
      const tier2Spies = [
        vi.spyOn(tier2Fetcher, "extractFullTextFromUrl"),
        vi.spyOn(tier2Fetcher, "fetchAndCacheJobFullText"),
      ];

      const byokConfig = withByok
        ? { provider: "openai", apiKey: "sk-guest-byok-not-allowed" }
        : { provider: "openai", apiKey: "" };

      let response: Response;
      if (name === "chat") {
        response = await chatPOST(
          new Request("http://localhost:3000/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: "Summarize my resume" }],
              providerConfig: byokConfig,
              context: { activeJobId: targetJob.id },
            }),
          })
        );
      } else if (name === "test-connection") {
        response = await testConnectionPOST(
          new Request("http://localhost:3000/api/ai/test-connection", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(byokConfig),
          })
        );
      } else if (name === "repair-typst") {
        response = await repairTypstPOST(
          new Request("http://localhost:3000/api/ai/repair-typst", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: "= Resume",
              compileError: "syntax error",
              providerConfig: byokConfig,
            }),
          })
        );
      } else if (name === "extract") {
        response = await extractJobPOST(
          new Request("http://localhost:3000/api/jobs/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              url: "https://boards.greenhouse.io/acme/jobs/123",
              ...(withByok ? { providerConfig: byokConfig } : {}),
            }),
          })
        );
      } else if (name === "hydrate") {
        response = await hydrateJobsPOST(
          new NextRequest("http://localhost:3000/api/jobs/hydrate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: [targetJob.id],
              ...(withByok ? { providerConfig: byokConfig } : {}),
            }),
          })
        );
      } else {
        response = await fetchFulltextPOST(
          new NextRequest(`http://localhost:3000/api/jobs/${targetJob.id}/fetch-fulltext`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: withByok ? JSON.stringify({ providerConfig: byokConfig }) : undefined,
          }),
          { params: Promise.resolve({ id: targetJob.id }) }
        );
      }

      expect(response.status).toBe(401);
      expect(response.headers.get("Content-Type")).toContain("application/json");
      expect(response.headers.get("Content-Type")).not.toContain("text/event-stream");
      const json = await response.json();
      expect(json.code).toBe("GUEST_READ_ONLY");
      expect(fetchSpy).not.toHaveBeenCalled();
      for (const spy of [...gatewaySpies, ...tier2Spies]) {
        expect(spy).not.toHaveBeenCalled();
      }

      const unchangedJob = await prisma.job.findUnique({ where: { id: targetJob.id } });
      expect(unchangedJob?.rawDescription).toBe(
        "[Pending Import] Full job description text not yet fetched..."
      );
    }
  );

  it("isolates two authenticated sessions + null-owner job across PATCH/DELETE and omits private activeJobId from chat", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    createdUserIds.push(owner.user.id, other.user.id);

    const privateCompany = `SecretPrivateCo-${crypto.randomUUID()}`;
    const privateRole = `Staff Secret Role ${crypto.randomUUID()}`;
    const ownedJob = await prisma.job.create({
      data: {
        userId: owner.user.id,
        company: privateCompany,
        roleTitle: privateRole,
        rawDescription: "Confidential personal job draft.",
      },
    });
    const sharedJob = await prisma.job.create({
      data: {
        userId: null,
        company: "NullOwnerCo",
        roleTitle: "Catalog Engineer",
        rawDescription: "Shared catalog job description.",
      },
    });
    createdJobIds.push(ownedJob.id, sharedJob.id);

    await prisma.jobApplication.create({
      data: { userId: owner.user.id, jobId: ownedJob.id, status: "INTERVIEWING" },
    });

    // Foreign PATCH (mixed catalog + status) on ownedJob must fail 404 and leave row & children unchanged.
    const foreignOwnedPatch = await jobByIdPATCH(
      authedRequest(
        `http://localhost:3000/api/jobs/${ownedJob.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: "Hijacked", status: "OFFER" }),
        },
        other.cookie
      ),
      { params: Promise.resolve({ id: ownedJob.id }) }
    );
    expect(foreignOwnedPatch.status).toBe(404);
    expect(await prisma.job.findUnique({ where: { id: ownedJob.id } })).toMatchObject({
      company: privateCompany,
      roleTitle: privateRole,
    });
    expect(
      await prisma.jobApplication.findFirst({
        where: { userId: owner.user.id, jobId: ownedJob.id },
      })
    ).toMatchObject({ status: "INTERVIEWING" });
    expect(
      await prisma.jobApplication.findFirst({
        where: { userId: other.user.id, jobId: ownedJob.id },
      })
    ).toBeNull();

    // Foreign DELETE on ownedJob and sharedJob must fail 404 and leave both rows intact.
    const foreignDeleteOwned = await jobByIdDELETE(
      authedRequest(`http://localhost:3000/api/jobs/${ownedJob.id}`, { method: "DELETE" }, other.cookie),
      { params: Promise.resolve({ id: ownedJob.id }) }
    );
    const foreignDeleteShared = await jobByIdDELETE(
      authedRequest(`http://localhost:3000/api/jobs/${sharedJob.id}`, { method: "DELETE" }, other.cookie),
      { params: Promise.resolve({ id: sharedJob.id }) }
    );
    expect(foreignDeleteOwned.status).toBe(404);
    expect(foreignDeleteShared.status).toBe(404);
    expect(await prisma.job.findUnique({ where: { id: sharedJob.id } })).toMatchObject({
      company: "NullOwnerCo",
    });

    // Authorized owner PATCH succeeds.
    const updatedCompany = `OwnerUpdatedCo-${crypto.randomUUID()}`;
    const ownerPatch = await jobByIdPATCH(
      authedRequest(
        `http://localhost:3000/api/jobs/${ownedJob.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: updatedCompany }),
        },
        owner.cookie
      ),
      { params: Promise.resolve({ id: ownedJob.id }) }
    );
    expect(ownerPatch.status).toBe(200);
    expect(await prisma.job.findUnique({ where: { id: ownedJob.id } })).toMatchObject({
      company: updatedCompany,
    });

    // Foreign chat request passing owner's private activeJobId must omit job details from provider payload.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Safe response without private job.", tool_calls: [] } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const chatRes = await chatPOST(
      authedRequest(
        "http://localhost:3000/api/ai/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "What company is active?" }],
            providerConfig: { provider: "openai", apiKey: "sk-other-user-key" },
            context: { activeJobId: ownedJob.id },
          }),
        },
        other.cookie
      )
    );
    expect(chatRes.status).toBe(200);
    await chatRes.text();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const providerBody = String(fetchSpy.mock.calls[0][1]?.body ?? "");
    expect(providerBody).not.toContain(ownedJob.id);
    expect(providerBody).not.toContain(updatedCompany);
    expect(providerBody).not.toContain(privateRole);
  });

  it("enforces middleware rate-limit 429 across dynamic fulltext IDs and isolates auth lockouts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ACCESS_SECRET", "prod-rate-limit-secret");
    vi.stubEnv("TRUST_PROXY", "false");

    // Exhaust auth lockout first.
    for (let i = 0; i < 10; i++) {
      const res = await middleware(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        })
      );
      expect(res.status).not.toBe(429);
    }
    const authLocked = await middleware(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(authLocked.status).toBe(429);

    // Exhaust dynamic /api/jobs/[id]/fetch-fulltext (15/min shared fixed namespace across distinct IDs).
    for (let i = 0; i < 15; i++) {
      const res = await middleware(
        new NextRequest(`http://localhost:3000/api/jobs/job-${i}/fetch-fulltext`, {
          method: "POST",
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        })
      );
      expect(res.status).not.toBe(429);
    }
    const fulltextBlocked = await middleware(
      new NextRequest("http://localhost:3000/api/jobs/job-brand-new-id/fetch-fulltext", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(fulltextBlocked.status).toBe(429);
    await expect(fulltextBlocked.json()).resolves.toMatchObject({ success: false });

    // Exhaust /api/jobs/hydrate (10/min).
    for (let i = 0; i < 10; i++) {
      const res = await middleware(
        new NextRequest("http://localhost:3000/api/jobs/hydrate", {
          method: "POST",
          headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        })
      );
      expect(res.status).not.toBe(429);
    }
    const hydrateBlocked = await middleware(
      new NextRequest("http://localhost:3000/api/jobs/hydrate", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(hydrateBlocked.status).toBe(429);

    // Flooding another namespace must not evict the active auth lockout.
    for (let i = 0; i < 400; i++) {
      rateLimit(`ai:noise-${i}`, 5, 60_000);
    }
    const stillLocked = await middleware(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
      })
    );
    expect(stillLocked.status).toBe(429);
  });
});
