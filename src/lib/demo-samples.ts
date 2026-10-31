export const DEMO_RESUME_SOURCE = `// Synthetic sample. This is not a real person's resume or experience.
= Jordan Example
#link("mailto:sample@example.invalid")[sample\\@example.invalid] | #link("https://example.invalid")[example.invalid]

== Summary
Fictional resume content used to demonstrate the editor and Typst preview.

== Projects
- Built a fictional task board as a sample project using TypeScript.
`;

export const DEMO_EVIDENCE = [
  {
    id: "demo-sample-evidence-project",
    type: "project",
    title: "Synthetic sample project",
    organization: "Example Lab (fictional)",
    dates: "Example dates",
    verifiedSummary: "Fictional sample content for exploring the Evidence Bank. It is not a real user's experience.",
    tags: ["TypeScript", "PostgreSQL"],
    status: "verified",
    createdAt: "2026-01-01T00:00:00.000Z",
    bullets: [
      {
        id: "demo-sample-bullet-project",
        text: "Built a fictional task board as a sample project using TypeScript.",
        technologies: ["TypeScript"],
        roleAffinity: ["Fullstack"],
        verified: true,
      },
    ],
  },
];

export const DEMO_JOB = {
  id: "demo-sample-job",
  company: "Example Lab (fictional)",
  roleTitle: "Sample Software Engineer",
  rawDescription: "Synthetic sample job description for a fictional Sample Software Engineer role at Example Lab. Required skills: TypeScript and PostgreSQL. Preferred skills: AWS. Domain: product analytics. This fictional role is for exploring the tailoring workflow only.",
  status: "SAVED",
};
