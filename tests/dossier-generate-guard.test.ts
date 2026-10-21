import { beforeEach, describe, expect, it, vi } from "vitest";

const findUnique = vi.hoisted(() => vi.fn());
const upsert = vi.hoisted(() => vi.fn());
const generateDossier = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    companyDossier: { findUnique, upsert },
  },
}));

vi.mock("@/lib/company-dossier", () => ({
  generateDossier,
}));

vi.mock("@/lib/security/auth-request", () => ({
  requireUserId: vi.fn(async () => "user-1"),
}));

import { POST as generateRoute } from "@/app/api/companies/[slug]/dossier/generate/route";

function post(body: unknown) {
  return generateRoute(
    new Request("http://localhost/api/companies/acme/dossier/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    { params: Promise.resolve({ slug: "acme" }) }
  );
}

describe("dossier generate guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts client providerConfig and validates the name", async () => {
    findUnique.mockResolvedValue(null);
    generateDossier.mockResolvedValue({
      companyName: "Acme",
      interviewStyle: {},
      engineeringCulture: {},
      recentSignals: "none",
      llmUsed: true,
      source: "llm",
    });
    upsert.mockImplementation(async ({ create }: { create: { displayName: string } }) => ({
      companySlug: "acme",
      ...create,
    }));

    const res = await post({
      companyName: "Acme",
      jobTitle: "Engineer",
      providerConfig: { provider: "custom", baseUrl: "https://evil.example", apiKey: "stolen" },
    });
    expect(res.status).toBe(200);
    expect(generateDossier).toHaveBeenCalledWith({
      companyName: "Acme",
      jobTitle: "Engineer",
      referenceNotes: undefined,
      processNotes: undefined,
      providerConfig: { provider: "custom", baseUrl: "https://evil.example", apiKey: "stolen" },
    });
  });

  it("labels fallback as 'seed' source when offline or LLM not used", async () => {
    findUnique.mockResolvedValue(null);
    generateDossier.mockResolvedValue({
      companyName: "Acme",
      interviewStyle: {},
      engineeringCulture: {},
      recentSignals: "none",
      llmUsed: false,
      source: "offline",
    });
    let capturedSource: string | undefined;
    upsert.mockImplementation(async ({ create }: { create: { source: string; displayName: string } }) => {
      capturedSource = create.source;
      return {
        companySlug: "acme",
        ...create,
      };
    });

    const res = await post({
      companyName: "Acme",
      jobTitle: "Engineer",
    });
    expect(res.status).toBe(200);
    expect(capturedSource).toBe("seed");
  });

  it("rejects an oversized company name", async () => {
    const res = await post({ companyName: "A".repeat(121) });
    expect(res.status).toBe(400);
    expect(generateDossier).not.toHaveBeenCalled();
  });

  it("returns the saved dossier during the cooldown instead of regenerating", async () => {
    const existing = {
      companySlug: "acme",
      displayName: "Acme",
      lastUpdated: new Date(),
      referenceNotes: null,
      processNotes: null,
    };
    findUnique.mockResolvedValue(existing);
    const res = await post({ companyName: "Poisoned Name" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cooldown).toBe(true);
    expect(body.dossier.displayName).toBe("Acme");
    expect(generateDossier).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
