import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding sample Evidence Items and Bullets...");

  // Check if evidence items already exist
  const existingCount = await prisma.evidenceItem.count();
  if (existingCount > 0) {
    console.log("Database already seeded. Skipping.");
    return;
  }

  // Seed Item 1: Experience
  await prisma.evidenceItem.create({
    data: {
      type: "experience",
      title: "Software Engineer Intern",
      organization: "TechCorp Systems",
      dates: "Jun 2024 – Present",
      verifiedSummary: "Built scalable REST & GraphQL APIs with high throughput and sub-100ms latency.",
      tags: JSON.stringify(["TypeScript", "GraphQL", "Node.js", "REST"]),
      status: "verified",
      bullets: {
        create: [
          {
            text: "Developed high-throughput REST and GraphQL API endpoints serving over 100k daily active requests with sub-100ms response latency.",
            technologies: JSON.stringify(["GraphQL", "Node.js", "TypeScript"]),
            roleAffinity: JSON.stringify(["Backend", "Fullstack"]),
            verified: true,
            orderIndex: 0,
          },
          {
            text: "Refactored legacy frontend components into modular React hooks, reducing bundle size by 24% and improving initial page load speed.",
            technologies: JSON.stringify(["React", "TypeScript"]),
            roleAffinity: JSON.stringify(["Frontend", "Fullstack"]),
            verified: true,
            orderIndex: 1,
          },
        ],
      },
    },
  });

  // Seed Item 2: Project
  await prisma.evidenceItem.create({
    data: {
      type: "project",
      title: "ResumeForge Workspace",
      organization: "Personal Open Source",
      dates: "2026",
      verifiedSummary: "Local-first AI resume workspace using Next.js, CodeMirror 6, and Typst WASM.",
      tags: JSON.stringify(["Next.js", "TypeScript", "Typst", "SQLite", "Prisma"]),
      status: "verified",
      bullets: {
        create: [
          {
            text: "Engineered a local-first desktop web workspace utilizing Next.js, CodeMirror 6, and Typst WASM compilation for instantaneous document rendering.",
            technologies: JSON.stringify(["Next.js", "CodeMirror", "Typst", "WASM"]),
            roleAffinity: JSON.stringify(["Fullstack", "Frontend"]),
            verified: true,
            orderIndex: 0,
          },
        ],
      },
    },
  });

  // Seed Item 3: Skill
  await prisma.evidenceItem.create({
    data: {
      type: "skill",
      title: "Backend & Systems Development",
      organization: "Core Competency",
      dates: "2023 – Present",
      verifiedSummary: "Proficient in TypeScript, Node.js, Python, PostgreSQL, and SQLite database ORMs.",
      tags: JSON.stringify(["Python", "TypeScript", "PostgreSQL", "Prisma", "Docker"]),
      status: "verified",
      bullets: {
        create: [
          {
            text: "Designed type-safe database schemas and automated migration workflows using Prisma ORM and SQLite.",
            technologies: JSON.stringify(["Prisma", "SQLite", "TypeScript"]),
            roleAffinity: JSON.stringify(["Backend", "Database"]),
            verified: true,
            orderIndex: 0,
          },
        ],
      },
    },
  });

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
