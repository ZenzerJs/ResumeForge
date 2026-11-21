import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { GET as evidenceGET } from "@/app/api/evidence/route";
import { prisma } from "@/lib/prisma";
import { resetMockStore } from "@/lib/db-mock";
import { SEED_SAMPLE_EVIDENCE_IDS } from "@/lib/seed-sample-ids";

function extractSessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("Expected Set-Cookie header on signup response");
  }
  return setCookie.split(";")[0];
}

async function createStagedSeedRows() {
  for (const [index, id] of SEED_SAMPLE_EVIDENCE_IDS.entries()) {
    await prisma.evidenceItem.create({
      data: {
        id,
        userId: null,
        type: index === 0 ? "experience" : index === 1 ? "project" : "skill",
        title: `Sample Item ${index + 1}`,
        verifiedSummary: `Sample summary ${index + 1}`,
        tags: "[]",
        status: "verified",
      },
    });
  }
}

describe("seeded sample evidence claim on first signup", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterAll(() => {
    resetMockStore();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("assigns staged sample evidence items to the first signed-up user only and ignores unrelated unowned items", async () => {
    await createStagedSeedRows();

    const unrelated = await prisma.evidenceItem.create({
      data: {
        id: "unrelated-unowned-evidence",
        userId: null,
        type: "experience",
        title: "Unrelated Orphaned Item",
        verifiedSummary: "Should not be claimed automatically.",
        tags: "[]",
        status: "verified",
      },
    });

    const firstSignupRes = await signupPOST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "first@example.com",
          username: "first_user",
          password: "Password123!",
        }),
      })
    );
    expect(firstSignupRes.status).toBe(200);
    const firstJson = await firstSignupRes.json();
    expect(firstJson.success).toBe(true);
    const firstCookie = extractSessionCookie(firstSignupRes);

    const firstEvidenceRes = await evidenceGET(
      new Request("http://localhost:3000/api/evidence", {
        method: "GET",
        headers: { Cookie: firstCookie },
      })
    );
    expect(firstEvidenceRes.status).toBe(200);
    const firstEvidenceJson = await firstEvidenceRes.json();
    expect(firstEvidenceJson.data).toHaveLength(SEED_SAMPLE_EVIDENCE_IDS.length);
    const firstIds = firstEvidenceJson.data.map((item: { id: string }) => item.id).sort();
    expect(firstIds).toEqual([...SEED_SAMPLE_EVIDENCE_IDS].sort());

    const unrelatedAfter = await prisma.evidenceItem.findUnique({ where: { id: unrelated.id } });
    expect(unrelatedAfter?.userId ?? null).toBeNull();

    const secondSignupRes = await signupPOST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "second@example.com",
          username: "second_user",
          password: "Password123!",
        }),
      })
    );
    expect(secondSignupRes.status).toBe(200);
    const secondCookie = extractSessionCookie(secondSignupRes);

    const secondEvidenceRes = await evidenceGET(
      new Request("http://localhost:3000/api/evidence", {
        method: "GET",
        headers: { Cookie: secondCookie },
      })
    );
    expect(secondEvidenceRes.status).toBe(200);
    const secondEvidenceJson = await secondEvidenceRes.json();
    expect(secondEvidenceJson.data).toEqual([]);
  });

  it("does not claim seeded sample evidence on hosted Vercel deployments", async () => {
    vi.stubEnv("VERCEL", "1");
    await createStagedSeedRows();

    const signupRes = await signupPOST(
      new Request("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "cloud-first@example.com",
          username: "cloud_first",
          password: "Password123!",
        }),
      })
    );
    expect(signupRes.status).toBe(200);
    const cookie = extractSessionCookie(signupRes);

    const evidenceRes = await evidenceGET(
      new Request("http://localhost:3000/api/evidence", {
        method: "GET",
        headers: { Cookie: cookie },
      })
    );
    expect(evidenceRes.status).toBe(200);
    const evidenceJson = await evidenceRes.json();
    expect(evidenceJson.data).toEqual([]);
  });
});
