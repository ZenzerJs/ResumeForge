import { describe, it, expect } from "vitest";
import { evaluateAtsScore } from "@/lib/ats-evaluator/evaluator";
import { inferRoleProfile } from "@/lib/ats-evaluator/profile-inference";
import { JobRequirements } from "@/lib/jd-parser/types";

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
});
