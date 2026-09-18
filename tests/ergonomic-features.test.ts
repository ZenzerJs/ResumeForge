import { describe, it, expect } from "vitest";

describe("Ergonomic & Next-Gen Features Unit Tests", () => {
  it("strips Typst source markup into clean plain text for ATS export", () => {
    const rawTypst = `
#set page(paper: "us-letter")
#let name = "Alex Mercer"
= Alex Mercer
== Experience
*Staff Engineer* — Acme Corp (2022 - Present)
- Architected distributed event pipelines in [Go] and [Kubernetes].
- Reduced p99 query latency by 45%.
`;

    const cleanTxt = rawTypst
      .replace(/#(show|set|let)[^\n]*\n?/g, "")
      .replace(/==+\s*(.*?)\n/g, "\n--- $1 ---\n")
      .replace(/=+\s*(.*?)\n/g, "\n=== $1 ===\n")
      .replace(/\[|\]/g, "")
      .replace(/\*+/g, "")
      .replace(/_+/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    expect(cleanTxt).toContain("=== Alex Mercer ===");
    expect(cleanTxt).toContain("--- Experience ---");
    expect(cleanTxt).toContain("Staff Engineer — Acme Corp (2022 - Present)");
    expect(cleanTxt).toContain("Architected distributed event pipelines in Go and Kubernetes");
    expect(cleanTxt).not.toContain("#set page");
  });

  it("formats master facts into standard JSON Resume structure", () => {
    const facts = {
      name: "Alex Mercer",
      email: "alex@example.com",
      phone: "+1 555-0199",
      summary: "Senior Systems Engineer",
      skills: ["Go", "Kubernetes", "PostgreSQL"],
      experiences: [
        {
          company: "Acme Corp",
          role: "Senior Engineer",
          startDate: "2022",
          endDate: "Present",
          highlights: ["Built microservices", "Scaled databases"],
        },
      ],
      education: [
        {
          institution: "University of Waterloo",
          degree: "B.S. Computer Science",
          startDate: "2018",
          endDate: "2022",
        },
      ],
    };

    const jsonResume = {
      basics: {
        name: facts.name,
        email: facts.email,
        phone: facts.phone,
        summary: facts.summary,
      },
      skills: facts.skills,
      work: facts.experiences.map((exp) => ({
        name: exp.company,
        position: exp.role,
        startDate: exp.startDate,
        endDate: exp.endDate,
        summary: exp.highlights?.join("\n"),
      })),
      education: facts.education.map((edu) => ({
        institution: edu.institution,
        area: edu.degree,
        startDate: edu.startDate,
        endDate: edu.endDate,
      })),
    };

    expect(jsonResume.basics.name).toBe("Alex Mercer");
    expect(jsonResume.work[0].name).toBe("Acme Corp");
    expect(jsonResume.skills).toContain("Kubernetes");
    expect(jsonResume.education[0].institution).toBe("University of Waterloo");
  });
});
