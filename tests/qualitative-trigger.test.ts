import { describe, it, expect, vi } from "vitest";
import { POST } from "@/app/api/ai/qualitative-review/route";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { authedNextRequest, createTestUser } from "./helpers/auth";

describe("Anti-Auto-Trigger & Qualitative Review API Tests", () => {
  it("asserts deterministic score computation makes ZERO calls to qualitative AI API", () => {
    const fetchSpy = vi.spyOn(global, "fetch");

    // Execute deterministic scoring
    const result = evaluateAtsScore(
      "#resume-section(\"Skills\")\nNode.js, PostgreSQL\n#resume-section(\"Experience\")\n- Built API using Node.js",
      { requiredSkills: ["Node.js"], preferredSkills: [], domainTerms: [] },
      "Backend"
    );

    expect(result.overallScore).toBeGreaterThan(0);

    // Verify zero calls made to qualitative API or gateway during deterministic evaluation
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("returns 400 rejection when mandatory fields are missing from request payload", async () => {
    const { cookie } = await createTestUser();
    const req = authedNextRequest("http://localhost:3000/api/ai/qualitative-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerConfig: { provider: "openai" },
        // missing typstContent and jobRequirements
      }),
    }, cookie);

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("Invalid input");
  });
});
