import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveProviderCredentials } from "@/lib/ai/providers/credentials";
import { testOpenAIConnection } from "@/lib/ai/providers/openai";

const evidenceFindMany = vi.hoisted(() => vi.fn());
const jobFindFirst = vi.hoisted(() => vi.fn());
const jobFindMany = vi.hoisted(() => vi.fn());
const resumeFindFirst = vi.hoisted(() => vi.fn());
const getEvidenceItems = vi.hoisted(() => vi.fn());
const generatePatchProposals = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    evidenceItem: { findMany: evidenceFindMany },
    job: { findFirst: jobFindFirst, findMany: jobFindMany },
    resume: { findFirst: resumeFindFirst },
    ingestedJob: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/security/auth-request", () => ({
  requireUserId: vi.fn(async () => "user-1"),
  getRequestUserId: vi.fn(),
}));

vi.mock("@/lib/db/resumes", () => ({
  getMasterResume: vi.fn(async () => ({ typstSource: "= Master" })),
}));

vi.mock("@/lib/db/evidence", () => ({
  getEvidenceItems,
}));

vi.mock("@/lib/ai/gateway", () => ({
  generatePatchProposals,
}));

import { POST as generatePatches } from "@/app/api/ai/generate-patches/route";
import { loadScoringEvidence } from "@/lib/scoring/user-evidence";
import { executeServerTool } from "@/lib/ai/tools/executor";

describe("critical batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses the server OpenAI key when baseUrl is a foreign host", async () => {
    const previous = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "server-secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));

    const resolved = resolveProviderCredentials({
      configBaseUrl: "https://evil.example",
      envApiKey: "server-secret",
      defaultBaseUrl: "https://api.openai.com",
      officialHosts: ["api.openai.com"],
    });
    expect(resolved.apiKey).toBeUndefined();
    expect(resolved.baseUrl).toBe("https://evil.example");

    const result = await testOpenAIConnection({
      provider: "openai",
      baseUrl: "https://evil.example",
    });
    expect(result.success).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();

    const official = await testOpenAIConnection({
      provider: "openai",
      baseUrl: "https://api.openai.com",
    });
    expect(official.success).toBe(true);
    const auth = (fetchSpy.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    expect(auth.Authorization).toBe("Bearer server-secret");
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl.startsWith("https://api.openai.com/")).toBe(true);

    fetchSpy.mockRestore();
    process.env.OPENAI_API_KEY = previous;
  });

  it("returns 422 Add evidence first when nothing is verified", async () => {
    getEvidenceItems.mockResolvedValue([
      { id: "draft-1", status: "draft", bullets: [] },
    ]);
    const res = await generatePatches(
      new Request("http://localhost/api/ai/generate-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: { provider: "openai", apiKey: "sk-test" },
          jobRequirements: { requiredSkills: ["Go"], preferredSkills: [], domainTerms: [] },
        }),
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("Add evidence first");
    expect(generatePatchProposals).not.toHaveBeenCalled();
  });

  it("sends only verified evidence into patch generation", async () => {
    getEvidenceItems.mockResolvedValue([
      { id: "ev-real", status: "verified", bullets: [{ id: "b1", verified: true }, { id: "b-draft", verified: false }] },
      { id: "ev-draft", status: "draft", bullets: [] },
    ]);
    generatePatchProposals.mockResolvedValue({ success: false, error: "stopped" });

    const res = await generatePatches(
      new Request("http://localhost/api/ai/generate-patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerConfig: { provider: "openai", apiKey: "sk-test" },
          jobRequirements: { requiredSkills: ["Go"], preferredSkills: [], domainTerms: [] },
        }),
      })
    );
    expect(res.status).toBe(502);
    const passed = generatePatchProposals.mock.calls[0][0].evidenceItems;
    expect(passed.map((item: { id: string }) => item.id)).toEqual(["ev-real"]);
    expect(passed[0].bullets.map((bullet: { id: string }) => bullet.id)).toEqual(["b1"]);
  });

  it("skips personalized job scoring without a session and scopes evidence to the user", async () => {
    const guest = await loadScoringEvidence(null);
    expect(guest.candidateSkills).toEqual([]);
    expect(evidenceFindMany).not.toHaveBeenCalled();

    evidenceFindMany.mockResolvedValue([
      {
        id: "ev-1",
        tags: JSON.stringify(["TypeScript"]),
        bullets: [{ id: "b1", technologies: JSON.stringify(["PostgreSQL"]) }],
      },
    ]);
    const authed = await loadScoringEvidence("user-a");
    expect(evidenceFindMany).toHaveBeenCalledWith({
      where: { userId: "user-a", status: "verified" },
      select: {
        id: true,
        tags: true,
        bullets: { select: { id: true, technologies: true } },
      },
    });
    expect(authed.candidateSkills).toEqual(["TypeScript", "PostgreSQL"]);
    expect(authed.evidenceItemsForMatching[0].title).toBe("");
    expect(authed.evidenceItemsForMatching[0].verifiedSummary).toBe("");
  });

  it("requires a user for job tools and rejects patches that cite unknown evidence", async () => {
    const missing = await executeServerTool("get_job", { jobId: "job-1" });
    expect(missing.success).toBe(false);
    expect(missing.error).toContain("Sign in required.");
    expect(jobFindFirst).not.toHaveBeenCalled();

    jobFindFirst.mockResolvedValue({ id: "job-1", userId: "user-a" });
    const found = await executeServerTool("get_job", { jobId: "job-1" }, "user-a");
    expect(found.success).toBe(true);
    expect(jobFindFirst).toHaveBeenCalledWith({
      where: { id: "job-1", userId: "user-a" },
    });

    jobFindMany.mockResolvedValue([]);
    await executeServerTool("search_saved_jobs", {}, "user-a");
    expect(jobFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: expect.arrayContaining([{
            OR: [
              { userId: "user-a" },
              { userId: null, applications: { some: { userId: "user-a" } } },
            ],
          }]),
        },
      })
    );

    const rejected = await executeServerTool(
      "apply_patches",
      { currentTypst: "- old line", patchIds: ["p1"], acceptedPatches: [{ id: "p1", before: "old", after: "new" }] },
      "user-a"
    );
    expect(rejected.success).toBe(false);
    expect(rejected.error).toBe("Tool failed");
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
