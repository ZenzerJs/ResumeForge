import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Keep in sync with src/lib/seed-sample-ids.ts (prisma/seed.ts runs standalone in Docker runner without src/).
const SEED_SAMPLE_EVIDENCE_IDS = [
  "seed-sample-evidence-experience",
  "seed-sample-evidence-project",
  "seed-sample-evidence-skill",
] as const;

const SAMPLE_ITEMS = [
  {
    id: SEED_SAMPLE_EVIDENCE_IDS[0],
    type: "experience",
    title: "Software Engineer Intern",
    organization: "TechCorp Systems",
    dates: "Jun 2024 – Present",
    verifiedSummary: "Built scalable REST & GraphQL APIs with high throughput and sub-100ms latency.",
    tags: JSON.stringify(["TypeScript", "GraphQL", "Node.js", "REST"]),
    status: "verified",
    bullets: [
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
  {
    id: SEED_SAMPLE_EVIDENCE_IDS[1],
    type: "project",
    title: "ResumeForge Workspace",
    organization: "Personal Open Source",
    dates: "2026",
    verifiedSummary: "Local-first AI resume workspace using Next.js, CodeMirror 6, and Typst WASM.",
    tags: JSON.stringify(["Next.js", "TypeScript", "Typst", "PostgreSQL", "Prisma"]),
    status: "verified",
    bullets: [
      {
        text: "Engineered a local-first desktop web workspace utilizing Next.js, CodeMirror 6, and Typst WASM compilation for instantaneous document rendering.",
        technologies: JSON.stringify(["Next.js", "CodeMirror", "Typst", "WASM"]),
        roleAffinity: JSON.stringify(["Fullstack", "Frontend"]),
        verified: true,
        orderIndex: 0,
      },
    ],
  },
  {
    id: SEED_SAMPLE_EVIDENCE_IDS[2],
    type: "skill",
    title: "Backend & Systems Development",
    organization: "Core Competency",
    dates: "2023 – Present",
    verifiedSummary: "Proficient in TypeScript, Node.js, Python, and PostgreSQL with Prisma ORM.",
    tags: JSON.stringify(["Python", "TypeScript", "PostgreSQL", "Prisma", "Docker"]),
    status: "verified",
    bullets: [
      {
        text: "Designed type-safe database schemas and automated migration workflows using Prisma ORM and PostgreSQL.",
        technologies: JSON.stringify(["Prisma", "PostgreSQL", "TypeScript"]),
        roleAffinity: JSON.stringify(["Backend", "Database"]),
        verified: true,
        orderIndex: 0,
      },
    ],
  },
] as const;

const SAMPLE_TITLES = SAMPLE_ITEMS.map((item) => item.title);

function parseTargetUserArg(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--user=")) {
      const value = arg.slice("--user=".length).trim();
      if (!value) throw new Error("Missing value for --user.");
      return value;
    }
    if (arg === "--user") {
      const next = argv[i + 1]?.trim();
      if (!next) throw new Error("Missing value for --user.");
      return next;
    }
  }
  return null;
}

async function main() {
  console.log("Seeding sample Evidence Items and Bullets...");

  const targetUserArg = parseTargetUserArg(process.argv.slice(2));
  let targetUserId: string | null = null;
  let targetLabel = "";

  if (targetUserArg) {
    const normalized = targetUserArg.trim().toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
      select: { id: true, username: true },
    });
    if (!user) {
      console.error(`No user found matching '${targetUserArg}'.`);
      process.exitCode = 1;
      return;
    }
    targetUserId = user.id;
    targetLabel = `user '${user.username}'`;
  } else {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      targetUserId = null;
      targetLabel = "automatic claim by the first signed-up account";
    } else if (userCount === 1) {
      const soleUser = await prisma.user.findFirst({
        select: { id: true, username: true },
      });
      if (!soleUser) {
        console.error("Expected sole user record was not found.");
        process.exitCode = 1;
        return;
      }
      targetUserId = soleUser.id;
      targetLabel = `user '${soleUser.username}'`;
    } else {
      console.log(
        "Multiple accounts exist; re-run with --user <email-or-username> to seed sample Evidence Bank items for a specific account."
      );
      return;
    }
  }

  if (targetUserId === null) {
    const existingStaged = await prisma.evidenceItem.count({
      where: { id: { in: [...SEED_SAMPLE_EVIDENCE_IDS] } },
    });
    if (existingStaged > 0) {
      console.log("Sample Evidence Bank items already seeded. Skipping.");
      return;
    }
  } else {
    const existingForUser = await prisma.evidenceItem.count({
      where: {
        userId: targetUserId,
        title: { in: SAMPLE_TITLES },
      },
    });
    if (existingForUser > 0) {
      console.log("Sample Evidence Bank items already exist for this account. Skipping.");
      return;
    }
  }

  const takenSeedIds = await prisma.evidenceItem.count({
    where: { id: { in: [...SEED_SAMPLE_EVIDENCE_IDS] } },
  });
  const assignDeterministicIds = takenSeedIds === 0;

  await prisma.$transaction(async (tx) => {
    for (const item of SAMPLE_ITEMS) {
      await tx.evidenceItem.create({
        data: {
          ...(assignDeterministicIds ? { id: item.id } : {}),
          userId: targetUserId,
          type: item.type,
          title: item.title,
          organization: item.organization,
          dates: item.dates,
          verifiedSummary: item.verifiedSummary,
          tags: item.tags,
          status: item.status,
          bullets: {
            create: item.bullets.map((bullet) => ({
              text: bullet.text,
              technologies: bullet.technologies,
              roleAffinity: bullet.roleAffinity,
              verified: bullet.verified,
              orderIndex: bullet.orderIndex,
            })),
          },
        },
      });
    }
  });

  console.log(`Seeded ${SAMPLE_ITEMS.length} sample Evidence Bank items (${targetLabel}).`);
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
