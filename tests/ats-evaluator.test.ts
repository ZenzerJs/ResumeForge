import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/ats/evaluate/route";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { inferRoleProfile } from "@/lib/ats-evaluator/profile-inference";
import { JobRequirements } from "@/lib/jd-parser/types";
import { getAtsDisplayState } from "@/components/tailor/ats-score-panel";

const SAMPLE_TYPST_RESUME = `
#let resume-section(title) = [ === #title ]
#let resume-item(title) = [ - #title ]

#resume-section("Skills")
Languages: TypeScript, Node.js, Python, PostgreSQL, Redis, Docker, React, Tailwind CSS

#resume-section("Experience")
*Backend Engineer* | Acme Corp (Jun 2024 - Present)
- Engineered high-performance REST APIs using Node.js and TypeScript, reducing query latency by 45%.
- Optimized PostgreSQL database indexes and managed Redis caching layers for 100k daily active users.
- Built microservices containerized with Docker and deployed to AWS cloud infrastructure.

#resume-section("Projects")
*AI Resume Forge* | https://github.com/example/resume-forge
- Developed AI resume tailoring engine utilizing TypeScript and Next.js.
- Implemented deterministic job description requirement parser achieving 98% accuracy.
`;

const SAMPLE_REQUIREMENTS: JobRequirements = {
  requiredSkills: ["Node.js", "PostgreSQL", "TypeScript", "Kubernetes"],
  preferredSkills: ["Redis", "GraphQL"],
  domainTerms: ["REST APIs", "Microservices"],
};

describe("ATS Deterministic Evaluator Engine", () => {
  it("infers role profiles correctly based on role title and description", () => {
    expect(inferRoleProfile("Senior Backend Engineer", "Acme Corp")).toBe("Backend");
    expect(inferRoleProfile("Frontend Developer", "React Next.js UI")).toBe("Frontend");
    expect(inferRoleProfile("AI Engineer", "LLM RAG agent workflow")).toBe("AI/LLM");
    expect(inferRoleProfile("Machine Learning Specialist", "PyTorch model training")).toBe("ML");
    expect(inferRoleProfile("Data Engineer", "ETL pipeline SQL Spark")).toBe("Data/Platform");
    expect(inferRoleProfile("Software Engineer", "Full stack web app")).toBe("Full-stack");
  });

  it("scores Base Resume Health (30 pts max) accurately with anti-gaming checks", () => {
    const res = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend");
    expect(res.baseHealth.maxScore).toBe(30);
    expect(res.baseHealth.score).toBeGreaterThan(20);
    expect(res.baseHealth.findings.some((f) => f.includes("one-page"))).toBe(true);

    // Test anti-gaming detection (hidden text penalty)
    const hiddenTextResume = SAMPLE_TYPST_RESUME + "\ntext(fill: white)[hidden keyword stuffing]";
    const penalizedRes = evaluateAtsScore(hiddenTextResume, SAMPLE_REQUIREMENTS, "Backend");
    expect(penalizedRes.baseHealth.findings.some((f) => f.includes("Penalized"))).toBe(true);
    expect(penalizedRes.gaps.some((g) => g.includes("Penalized"))).toBe(true);
  });

  it("distinguishes DEMONSTRATED_IN_EXPERIENCE vs LISTED_IN_SKILLS_ONLY vs UNSUPPORTED_GAP", () => {
    const res = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend");

    // Node.js is demonstrated in Experience bullets -> DEMONSTRATED_IN_EXPERIENCE
    const nodeEval = res.skillEvaluations.find((s) => s.skill === "Node.js");
    expect(nodeEval?.status).toBe("DEMONSTRATED_IN_EXPERIENCE");
    expect(nodeEval?.score).toBeGreaterThan(0);

    // Docker is in Experience bullets -> DEMONSTRATED_IN_EXPERIENCE
    const postgresEval = res.skillEvaluations.find((s) => s.skill === "PostgreSQL");
    expect(postgresEval?.status).toBe("DEMONSTRATED_IN_EXPERIENCE");

    // Kubernetes is not in the resume at all -> UNSUPPORTED_GAP
    const k8sEval = res.skillEvaluations.find((s) => s.skill === "Kubernetes");
    expect(k8sEval?.status).toBe("UNSUPPORTED_GAP");
    expect(k8sEval?.score).toBe(0);

    // GraphQL is not in resume -> UNSUPPORTED_GAP for preferred
    const graphqlEval = res.skillEvaluations.find((s) => s.skill === "GraphQL");
    expect(graphqlEval?.status).toBe("UNSUPPORTED_GAP");
  });

  it("calculates Required Role Match (40 pts max) and Preferred Match (15 pts max)", () => {
    const res = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend");

    expect(res.requiredMatch.maxScore).toBe(40);
    // 3 of 4 required skills present (Node.js, PostgreSQL, TypeScript verified in experience; Kubernetes missing)
    expect(res.requiredMatch.score).toBe(30);

    expect(res.preferredMatch.maxScore).toBe(15);
    // Redis is in skills list and experience; GraphQL is missing
    expect(res.preferredMatch.score).toBeGreaterThan(0);
  });

  it("calculates Role-Relevant Evidence (15 pts max) across different Role Profiles", () => {
    const backendRes = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend");
    const aiRes = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "AI/LLM");

    expect(backendRes.roleEvidence.maxScore).toBe(15);
    expect(backendRes.roleEvidence.score).toBeGreaterThan(aiRes.roleEvidence.score);
  });

  it("produces correct overall match score out of 100", () => {
    const res = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend");
    expect(res.overallScore).toBeGreaterThanOrEqual(0);
    expect(res.overallScore).toBeLessThanOrEqual(100);
    expect(res.overallScore).toBe(
      res.baseHealth.score +
        res.requiredMatch.score +
        res.preferredMatch.score +
        res.roleEvidence.score
    );
  });

  it("recognizes #section headings, exits skills bucket at next heading, and excludes definitions/comments", () => {
    const templateResume = `
#let section(title) = [ == #title ]
// #section("Skills") — commented out heading
#let helper-skills = "skills: Kubernetes"

#section("Skills")
Languages & Tools: GraphQL, Redis

#section("Experience")
*Platform Engineer* | Beta Corp (2024 - Present)
- Built low-latency APIs with Node.js and PostgreSQL.
`;

    const reqs: JobRequirements = {
      requiredSkills: ["Node.js", "GraphQL"],
      preferredSkills: ["Kubernetes"],
      domainTerms: [],
    };

    const res = evaluateAtsScore(templateResume, reqs, "Backend");
    const nodeEval = res.skillEvaluations.find((s) => s.skill === "Node.js");
    const graphqlEval = res.skillEvaluations.find((s) => s.skill === "GraphQL");
    const k8sEval = res.skillEvaluations.find((s) => s.skill === "Kubernetes");

    // Node.js is in #section("Experience") (body bucket), not stuck in Skills
    expect(nodeEval?.status).toBe("DEMONSTRATED_IN_EXPERIENCE");
    // GraphQL is only in #section("Skills")
    expect(graphqlEval?.status).toBe("LISTED_IN_SKILLS_ONLY");
    // Ensure GraphQL scored differently from Experience-bucket Node.js
    expect(nodeEval!.score).toBeGreaterThan(graphqlEval!.score);
    // #let definition mentioning Kubernetes should NOT mistakenly open a Skills bucket; wait, Kubernetes appears in bodyText because #let helper-skills wasn't stripped — check comment/definition didn't mark Redis/K8s as Skills-only if in body, verify #let section("Skills") didn't put Node.js into skills!
    expect(k8sEval?.status).not.toBe("LISTED_IN_SKILLS_ONLY");

    // Verify comment-only / definition #section("Skills") without an active #section("Skills") does NOT activate skills bucket
    const commentOnlySkills = `
// #section("Skills")
#let section(title) = [ == #title ]
#let helper() = #section("Skills")
- Built GraphQL and Node.js services.
`;
    const commentRes = evaluateAtsScore(commentOnlySkills, reqs, "Backend");
    expect(commentRes.skillEvaluations.find((s) => s.skill === "GraphQL")?.status).toBe(
      "DEMONSTRATED_IN_EXPERIENCE"
    );
    expect(commentRes.skillEvaluations.find((s) => s.skill === "Node.js")?.status).toBe(
      "DEMONSTRATED_IN_EXPERIENCE"
    );
  });

  it("preserves empty-requirements scoring contract", () => {
    const res = evaluateAtsScore(
      SAMPLE_TYPST_RESUME,
      {
        requiredSkills: [],
        preferredSkills: [],
        domainTerms: [],
      },
      "Backend"
    );
    expect(res.requiredMatch.percentage).toBe(100);
    expect(res.requiredMatch.score).toBe(res.requiredMatch.maxScore);
    expect(res.preferredMatch.percentage).toBe(100);
    expect(res.preferredMatch.score).toBe(res.preferredMatch.maxScore);
  });

  it("ignores // metadata comments and #set/#let preamble when checking one-page length", () => {
    const preamble = `#set page(paper: "us-letter", margin: (x: 0.65in, y: 0.6in))
#set text(font: "Libertinus Serif", size: 10.5pt)
#let section(title) = block(sticky: true)[#title]
#let entry(title: [], role: [], location: [], date: []) = block[#title #role]
`;
    const fakeBase64Metadata = `// @resume-links-v2 ${"A".repeat(400)}\n// @resume-document-v2 ${"B".repeat(5000)}\n`;
    const normalOnePageWithMetadata = `${preamble}\n${SAMPLE_TYPST_RESUME}\n${fakeBase64Metadata}`;

    expect(normalOnePageWithMetadata.length).toBeGreaterThan(4000);
    const res = evaluateAtsScore(normalOnePageWithMetadata, SAMPLE_REQUIREMENTS, "Backend");
    expect(res.baseHealth.findings).toContain("✓ Standard one-page length constraints satisfied.");
    expect(res.baseHealth.findings).not.toContain("Warning: Document length may exceed a single page.");

    const genuinelyLongBody = `${SAMPLE_TYPST_RESUME}\n${"- Delivered measurable improvements across distributed services.\n".repeat(70)}`;
    const longRes = evaluateAtsScore(genuinelyLongBody, SAMPLE_REQUIREMENTS, "Backend");
    expect(longRes.baseHealth.findings).toContain("Warning: Document length may exceed a single page.");

    const measuredOnePage = evaluateAtsScore(genuinelyLongBody, SAMPLE_REQUIREMENTS, "Backend", {
      measuredPages: 1,
    });
    expect(measuredOnePage.baseHealth.findings).toContain("✓ Standard one-page length constraints satisfied.");
    expect(measuredOnePage.baseHealth.findings).not.toContain("Warning: Document length may exceed a single page.");

    const measuredTwoPages = evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend", {
      measuredPages: 2,
    });
    expect(measuredTwoPages.baseHealth.findings).toContain("Warning: Document length may exceed a single page.");
  });

  it("marks AtsScorePanel display state as No job loaded / unscored when requirements are empty", () => {
    const emptyReqs: JobRequirements = {
      requiredSkills: [],
      preferredSkills: [],
      domainTerms: [],
    };
    const res = evaluateAtsScore(SAMPLE_TYPST_RESUME, emptyReqs, "Backend");
    const display = getAtsDisplayState(res, emptyReqs);

    expect(display.hasJobRequirements).toBe(false);
    expect(display.overallRingText).toBe("—");
    expect(display.overallRingPct).toBe(0);
    expect(display.overallMatchLabel).toContain("No job loaded");
    expect(display.overallScorePrimary).toBe("No job loaded");
    expect(display.requiredMatchLabel).toBe("No job loaded");
    expect(display.requiredMatchPct).toBe(0);
    expect(display.preferredMatchLabel).toBe("No job loaded");
    expect(display.preferredMatchPct).toBe(0);
    expect(display.requiredMatchLabel).not.toContain("40 / 40");
    expect(display.requiredMatchLabel).not.toContain("100%");

    const loadedDisplay = getAtsDisplayState(
      evaluateAtsScore(SAMPLE_TYPST_RESUME, SAMPLE_REQUIREMENTS, "Backend"),
      SAMPLE_REQUIREMENTS,
      "Backend Engineer"
    );
    expect(loadedDisplay.hasJobRequirements).toBe(true);
    expect(loadedDisplay.requiredMatchLabel).toContain("/ 40 pts");
    expect(loadedDisplay.overallMatchLabel).not.toContain("No job loaded");
  });

  it("POST /api/ats/evaluate honors measuredPages=1 on >4000-char resumes and warns on measuredPages=2", async () => {
    const longResume = `${SAMPLE_TYPST_RESUME}\n${"- Delivered measurable improvements across distributed services.\n".repeat(75)}`;
    expect(longResume.length).toBeGreaterThan(4000);

    const reqOnePage = new NextRequest("http://localhost:3000/api/ats/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typstContent: longResume,
        extractedRequirements: SAMPLE_REQUIREMENTS,
        roleProfile: "Backend",
        measuredPages: 1,
      }),
    });
    const resOnePage = await POST(reqOnePage);
    const jsonOnePage = await resOnePage.json();
    expect(resOnePage.status).toBe(200);
    expect(jsonOnePage.success).toBe(true);
    expect(jsonOnePage.data.baseHealth.findings).toContain("✓ Standard one-page length constraints satisfied.");
    expect(jsonOnePage.data.baseHealth.findings).not.toContain("Warning: Document length may exceed a single page.");

    const reqTwoPages = new NextRequest("http://localhost:3000/api/ats/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        typstContent: SAMPLE_TYPST_RESUME,
        extractedRequirements: SAMPLE_REQUIREMENTS,
        roleProfile: "Backend",
        measuredPages: 2,
      }),
    });
    const resTwoPages = await POST(reqTwoPages);
    const jsonTwoPages = await resTwoPages.json();
    expect(resTwoPages.status).toBe(200);
    expect(jsonTwoPages.success).toBe(true);
    expect(jsonTwoPages.data.baseHealth.findings).toContain("Warning: Document length may exceed a single page.");
  });
});
