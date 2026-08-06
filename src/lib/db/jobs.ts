import { prisma } from "@/lib/prisma";
import { JobRequirements, JobRequirementsSchema } from "@/lib/jd-parser/types";

export interface CreateJobInput {
  company?: string;
  roleTitle?: string;
  rawDescription: string;
  source?: "pasted" | "manual";
  extractedRequirements?: JobRequirements;
}

export async function createJob(input: CreateJobInput) {
  const reqsJson = input.extractedRequirements
    ? JSON.stringify(input.extractedRequirements)
    : JSON.stringify({ requiredSkills: [], preferredSkills: [], domainTerms: [] });

  const job = await prisma.job.create({
    data: {
      company: input.company || null,
      roleTitle: input.roleTitle || null,
      rawDescription: input.rawDescription,
      source: input.source || "pasted",
      extractedRequirements: reqsJson,
    },
  });

  return {
    ...job,
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  };
}

export async function getJobs() {
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
  });

  return jobs.map((job) => ({
    ...job,
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  }));
}

export async function getJobById(id: string) {
  const job = await prisma.job.findUnique({
    where: { id },
  });

  if (!job) return null;

  return {
    ...job,
    extractedRequirements: parseRequirementsJson(job.extractedRequirements),
  };
}

function parseRequirementsJson(jsonStr: string): JobRequirements {
  try {
    const parsed = JSON.parse(jsonStr);
    return JobRequirementsSchema.parse(parsed);
  } catch {
    return {
      requiredSkills: [],
      preferredSkills: [],
      domainTerms: [],
    };
  }
}
