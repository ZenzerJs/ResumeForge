import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/ats/evaluate/route";
import { NextRequest } from "next/server";

describe("POST /api/ats/evaluate API Route", () => {
  it("evaluates raw typst content and extracted requirements successfully", async () => {
    const payload = {
      typstContent: "#resume-section(\"Skills\")\nNode.js, PostgreSQL, TypeScript\n#resume-section(\"Experience\")\n- Built REST API with Node.js and PostgreSQL",
      extractedRequirements: {
        requiredSkills: ["Node.js", "PostgreSQL"],
        preferredSkills: ["GraphQL"],
        domainTerms: ["REST API"],
      },
      roleTitle: "Backend Developer",
      roleProfile: "Backend",
    };

    const req = new NextRequest("http://localhost:3000/api/ats/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.overallScore).toBeGreaterThan(0);
    expect(json.data.selectedProfile).toBe("Backend");
    expect(json.data.requiredMatch.score).toBe(40);
  });

  it("returns 400 rejection when typstContent is missing", async () => {
    const payload = {
      extractedRequirements: {
        requiredSkills: ["Node.js"],
        preferredSkills: [],
        domainTerms: [],
      },
    };

    const req = new NextRequest("http://localhost:3000/api/ats/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("Missing typstContent");
  });

  it("returns 400 for invalid roleProfile string enum", async () => {
    const payload = {
      typstContent: "test content",
      roleProfile: "INVALID_PROFILE_NAME",
    };

    const req = new NextRequest("http://localhost:3000/api/ats/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid input");
  });
});
