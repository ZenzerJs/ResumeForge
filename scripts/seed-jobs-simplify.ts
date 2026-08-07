/**
 * One-time seed script: SimplifyJobs Internship Import Utility
 *
 * NOTE: The SimplifyJobs repository renames its target directory/file each hiring season
 * (e.g. Summer2026 -> Summer2027 or SimplifyJobs/Summer2026-Internships).
 * Update this URL or snapshot table source when starting a new hiring cycle:
 * https://github.com/SimplifyJobs/Summer2026-Internships
 */

import { prisma } from "../src/lib/prisma";
import { createJob } from "../src/lib/db/jobs";
import { CreateJobSchema } from "../src/lib/jd-parser/types";

export interface SimplifyJobRow {
  company: string;
  roleTitle: string;
  location: string;
  link?: string;
}

// Representative snapshot of 18 SWE / ML Internship postings from SimplifyJobs
// tailored for SWE/ML profiles with Canada & Remote availability
const SIMPLIFY_JOBS_SNAPSHOT: SimplifyJobRow[] = [
  {
    company: "Amazon",
    roleTitle: "Software Development Engineer Intern (Summer 2026)",
    location: "Vancouver, BC / Remote (Canada)",
  },
  {
    company: "Shopify",
    roleTitle: "Software Engineer Intern — Core Platform (Summer 2026)",
    location: "Toronto, ON / Remote (Canada)",
  },
  {
    company: "Google",
    roleTitle: "Software Engineering Intern (Summer 2026)",
    location: "Waterloo, ON / Toronto, ON",
  },
  {
    company: "Meta",
    roleTitle: "Software Engineer Intern (Summer 2026)",
    location: "Remote (North America)",
  },
  {
    company: "Microsoft",
    roleTitle: "Software Engineering Intern (Summer 2026)",
    location: "Vancouver, BC",
  },
  {
    company: "RBC",
    roleTitle: "Machine Learning Engineer Intern (Summer 2026)",
    location: "Toronto, ON",
  },
  {
    company: "Cohere",
    roleTitle: "Machine Learning Intern — LLM Alignment (Summer 2026)",
    location: "Toronto, ON / Remote",
  },
  {
    company: "Stripe",
    roleTitle: "Software Engineering Intern — Payments Infrastructure (Summer 2026)",
    location: "Remote (Canada)",
  },
  {
    company: "Databricks",
    roleTitle: "Software Engineer Intern — Cloud Platform (Summer 2026)",
    location: "Vancouver, BC / Remote",
  },
  {
    company: "Snowflake",
    roleTitle: "Software Engineering Intern (Summer 2026)",
    location: "Toronto, ON",
  },
  {
    company: "Uber",
    roleTitle: "Software Engineer Intern (Summer 2026)",
    location: "Toronto, ON / Remote",
  },
  {
    company: "Elastic",
    roleTitle: "Software Engineer Intern — Search & AI (Summer 2026)",
    location: "Remote (Canada)",
  },
  {
    company: "Manulife",
    roleTitle: "AI & Data Science Intern (Summer 2026)",
    location: "Waterloo, ON / Toronto, ON",
  },
  {
    company: "AMD",
    roleTitle: "Software Engineer Intern — GPU Compiler & Systems (Summer 2026)",
    location: "Markham, ON",
  },
  {
    company: "1Password",
    roleTitle: "Backend Developer Intern (Summer 2026)",
    location: "Remote (Canada)",
  },
  {
    company: "NVIDIA",
    roleTitle: "Deep Learning Software Engineer Intern (Summer 2026)",
    location: "Toronto, ON / Remote",
  },
  {
    company: "PointClickCare",
    roleTitle: "Full Stack Developer Intern (Summer 2026)",
    location: "Mississauga, ON / Remote",
  },
  {
    company: "RelationalAI",
    roleTitle: "Software Engineering Intern — Database Systems (Summer 2026)",
    location: "Remote (Canada)",
  },
];

async function seedSimplifyJobs() {
  console.log("=================================================");
  console.log("SimplifyJobs Internship Seed Utility (Task 7.9b)");
  console.log("=================================================\n");

  let createdCount = 0;
  let skippedCount = 0;

  for (const job of SIMPLIFY_JOBS_SNAPSHOT) {
    // Check if job already exists in SQLite database
    const existing = await prisma.job.findFirst({
      where: {
        company: job.company,
        roleTitle: job.roleTitle,
      },
    });

    if (existing) {
      console.log(`[Skipped] ${job.company} — ${job.roleTitle} (Already exists: ${existing.id})`);
      skippedCount++;
      continue;
    }

    const placeholderText = `[Pending Import] Full job description text not yet fetched from posting page for ${job.company} — ${job.roleTitle} (${job.location}). Navigate to the Tailor workspace to paste the complete job description text.`;

    // Validate payload against CreateJobSchema
    const validatedInput = CreateJobSchema.parse({
      company: job.company,
      roleTitle: job.roleTitle,
      rawDescription: placeholderText,
      source: "manual",
    });

    // Create job record in SQLite database
    const created = await createJob({
      company: validatedInput.company,
      roleTitle: validatedInput.roleTitle,
      rawDescription: validatedInput.rawDescription,
      source: "manual",
      notes: `Imported from SimplifyJobs snapshot (${job.location})`,
    });

    console.log(`[Created] ${created.company} — ${created.roleTitle}`);
    console.log(`          ID: ${created.id} | Location: ${job.location}`);
    createdCount++;
  }

  console.log("\n-------------------------------------------------");
  console.log(`Seeding Summary: ${createdCount} created, ${skippedCount} skipped.`);
  console.log("-------------------------------------------------\n");
}

seedSimplifyJobs()
  .catch((err) => {
    console.error("Fatal error seeding SimplifyJobs:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
