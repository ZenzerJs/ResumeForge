import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  EvidenceExtractResponseSchema,
  ExtractEvidenceRequestSchema,
} from "@/lib/ai/evidence-extract-schema";
import { buildEvidenceExtractSystemPrompt } from "@/lib/ai/evidence-prompt";
import { persistDraftEvidenceFromExtract } from "@/lib/ai/evidence-persist";
import { createEvidenceItem, getEvidenceItems } from "@/lib/db/evidence";
import { POST as extractEvidenceRoute } from "@/app/api/ai/extract-evidence/route";
import { authedRequest, createTestUser } from "./helpers/auth";

beforeEach(async () => {
  await prisma.bullet.deleteMany();
  await prisma.evidenceItem.deleteMany();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Evidence extract schema & persist", () => {
  it("accepts valid extract payload", () => {
    const parsed = EvidenceExtractResponseSchema.safeParse({
      items: [
        {
          type: "experience",
          title: "Software Engineer",
          organization: "Acme",
          dates: "2022 — Present",
          verifiedSummary: "Built APIs in TypeScript.",
          tags: ["TypeScript"],
          bullets: [
            {
              text: "Shipped REST APIs in TypeScript",
              technologies: ["TypeScript"],
              roleAffinity: ["Backend"],
            },
          ],
        },
      ],
      skippedSections: ["Contact"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects missing verifiedSummary", () => {
    const parsed = EvidenceExtractResponseSchema.safeParse({
      items: [
        {
          type: "experience",
          title: "Engineer",
          bullets: [],
        },
      ],
      skippedSections: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects empty typstSource on request schema", () => {
    const parsed = ExtractEvidenceRequestSchema.safeParse({ typstSource: "" });
    expect(parsed.success).toBe(false);
  });

  it("system prompt includes draft extract contract phrases", () => {
    const prompt = buildEvidenceExtractSystemPrompt();
    expect(prompt).toContain("MASTER RESUME → EVIDENCE BANK DRAFT EXTRACT");
    expect(prompt).toContain("ZERO HALLUCINATION");
    expect(prompt).toContain("skippedSections");
    expect(prompt).toContain("NOT A COVER LETTER");
    expect(prompt).not.toContain("TAILORED COVER LETTER SPECIALIST");
  });

  it("persistDraftEvidenceFromExtract creates drafts and skips verified duplicates", async () => {
    await createEvidenceItem({
      type: "experience",
      title: "Verified Role",
      organization: "Corp",
      verifiedSummary: "Already verified",
      status: "verified",
      bullets: [{ text: "Did things", verified: true }],
    });

    const result = await persistDraftEvidenceFromExtract({
      items: [
        {
          type: "experience",
          title: "Verified Role",
          organization: "Corp",
          verifiedSummary: "Should skip",
          tags: [],
          bullets: [],
        },
        {
          type: "project",
          title: "New Project",
          verifiedSummary: "Built a thing",
          tags: ["Rust"],
          bullets: [{ text: "Used Rust", technologies: ["Rust"], roleAffinity: [] }],
        },
      ],
      skippedSections: [],
    });

    expect(result.skippedVerifiedCount).toBe(1);
    expect(result.createdCount).toBe(1);

    const items = await getEvidenceItems("draft");
    expect(items.some((i) => i.title === "New Project")).toBe(true);
    const created = items.find((i) => i.title === "New Project");
    expect(created?.bullets[0]?.verified).toBe(false);
  });

  it("POST /api/ai/extract-evidence returns 400 without provider", async () => {
    const { cookie } = await createTestUser();
    const res = await extractEvidenceRoute(
      authedRequest(
        "http://localhost/api/ai/extract-evidence",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typstSource: "= Resume\nHello" }),
        },
        cookie
      )
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(String(json.error)).toMatch(/provider|API key/i);
  });

  it("POST /api/ai/extract-evidence happy path persists drafts via mocked provider", async () => {
    const extractPayload = {
      items: [
        {
          type: "experience",
          title: "Backend Engineer",
          organization: "Nova Labs",
          dates: "2021 — 2024",
          verifiedSummary: "Built services in Go.",
          tags: ["Go"],
          bullets: [
            {
              text: "Built gRPC services in Go",
              technologies: ["Go"],
              roleAffinity: ["Backend"],
            },
          ],
        },
      ],
      skippedSections: ["Contact"],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(extractPayload) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { cookie } = await createTestUser();
    const res = await extractEvidenceRoute(
      authedRequest(
        "http://localhost/api/ai/extract-evidence",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            typstSource: "= Resume\n== Experience\nBackend Engineer at Nova Labs",
            providerConfig: {
              provider: "openai",
              apiKey: "sk-proj-valid-test-key-12345",
              model: "gpt-4o",
            },
          }),
        },
        cookie
      )
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.persist.createdCount).toBeGreaterThanOrEqual(1);

    const drafts = await getEvidenceItems("draft");
    expect(drafts.some((d) => d.title === "Backend Engineer")).toBe(true);
  });

  it("extractEvidenceFromMaster sends the evidence extract prompt, not the cover-letter prompt", async () => {
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ items: [], skippedSections: [] }) } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { extractEvidenceFromMaster } = await import("@/lib/ai/gateway");
    await extractEvidenceFromMaster(
      { provider: "openai", apiKey: "sk-proj-valid-test-key-12345", model: "gpt-4o" },
      "= Resume\nHello"
    );

    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const system = body.messages.find((m: { role: string }) => m.role === "system")?.content ?? "";
    const user = body.messages.find((m: { role: string }) => m.role === "user")?.content ?? "";
    expect(system).toContain("MASTER RESUME → EVIDENCE BANK DRAFT EXTRACT");
    expect(system).toContain("NOT A COVER LETTER");
    expect(system).not.toContain("TAILORED COVER LETTER SPECIALIST");
    expect(user).toContain("Extract draft Evidence Bank items");
    expect(user).not.toContain("Write a professional, evidence-grounded cover letter");
  });
});
