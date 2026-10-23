import { afterEach, describe, expect, it, vi } from "vitest";

const { generateCoverLetter } = vi.hoisted(() => ({ generateCoverLetter: vi.fn() }));
vi.mock("@/lib/ai/gateway", () => ({ generateCoverLetter }));

import { POST } from "@/app/api/demo/generate-cover-letter/route";

const originalDemoMode = process.env.DEMO_MODE;
afterEach(() => {
  vi.clearAllMocks();
  if (originalDemoMode === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = originalDemoMode;
});

const evidenceItems = [{
  id: "demo-sample-evidence-project",
  type: "project",
  title: "Synthetic sample project",
  organization: "Example Lab (fictional)",
  dates: null,
  verifiedSummary: "Fictional sample content; not a real user's experience.",
  tags: ["TypeScript"],
  status: "verified",
  bullets: [{ id: "demo-sample-bullet-project", text: "Built a fictional task board as a synthetic sample.", technologies: ["TypeScript"], verified: true }],
}];

const generated = {
  title: "Sample Cover Letter",
  salutation: "Dear Hiring Team,",
  openingParagraph: "I am interested in the fictional Sample Software Engineer role.",
  bodyParagraphs: ["My fictional sample project demonstrates TypeScript skills documented in this synthetic Evidence Bank entry."],
  closingParagraph: "Thank you for considering this fictional sample application.",
  fullMarkdown: "# Sample Cover Letter\n\nDear Hiring Team,\n\nI am interested in the fictional Sample Software Engineer role.\n\nMy fictional sample project demonstrates TypeScript skills documented in this synthetic Evidence Bank entry.\n\nThank you for considering this fictional sample application.",
  evidenceCitations: ["demo-sample-evidence-project"],
  gapsAddressed: [],
};

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/demo/generate-cover-letter", {
    method: "POST",
    headers: { origin: "http://localhost:3000", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/demo/generate-cover-letter", () => {
  it("generates a schema-valid locally grounded letter without persistence context", async () => {
    process.env.DEMO_MODE = "true";
    generateCoverLetter.mockResolvedValue({ success: true, rawJson: JSON.stringify(generated) });
    const response = await POST(makeRequest({
      jobId: "demo-sample-job",
      company: "Example Lab (fictional)",
      roleTitle: "Sample Software Engineer",
      rawDescription: "Synthetic sample job description for the demo.",
      candidateName: "Jordan Example",
      providerConfig: { provider: "openai", apiKey: "visitor-key" },
      evidenceItems,
      masterTypst: "Synthetic sample resume.",
    }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.evidenceCitations).toEqual(["demo-sample-evidence-project"]);
    expect(payload.sampleData).toBe(true);
    expect(generateCoverLetter).toHaveBeenCalledOnce();
    expect(generateCoverLetter.mock.calls[0][2]).toEqual(evidenceItems);
    expect(generateCoverLetter.mock.calls[0][3]).toBe("Synthetic sample resume.");
  });

  it("requires a visitor key and a same-origin request", async () => {
    process.env.DEMO_MODE = "true";
    const noOrigin = new Request("http://localhost:3000/api/demo/generate-cover-letter", { method: "POST", body: "{}" });
    expect((await POST(noOrigin)).status).toBe(403);
    const missingKey = await POST(makeRequest({ providerConfig: { provider: "openai" }, evidenceItems }));
    expect(missingKey.status).toBe(400);
    expect(generateCoverLetter).not.toHaveBeenCalled();
  });
});
