import { prisma } from "@/lib/prisma";

export interface CreateCoverLetterInput {
  jobId: string;
  variantId?: string;
  title: string;
  salutation?: string;
  openingParagraph: string;
  bodyParagraphs: string[]; // array of strings
  closingParagraph: string;
  fullMarkdown: string;
  evidenceCitations?: string[]; // array of evidenceIds
  status?: "DRAFT" | "FINAL";
}

export interface UpdateCoverLetterInput {
  title?: string;
  salutation?: string;
  openingParagraph?: string;
  bodyParagraphs?: string[];
  closingParagraph?: string;
  fullMarkdown?: string;
  evidenceCitations?: string[];
  status?: "DRAFT" | "FINAL";
}

/**
 * Creates a new CoverLetter record in SQLite.
 */
export async function createCoverLetter(input: CreateCoverLetterInput) {
  // Verify job exists
  const job = await prisma.job.findUnique({
    where: { id: input.jobId },
  });

  if (!job) {
    throw new Error(`Job record not found: ${input.jobId}`);
  }

  // Verify variant exists if provided
  if (input.variantId) {
    const variant = await prisma.resumeVariant.findUnique({
      where: { id: input.variantId },
    });
    if (!variant) {
      throw new Error(`ResumeVariant record not found: ${input.variantId}`);
    }
  }

  return await prisma.coverLetter.create({
    data: {
      jobId: input.jobId,
      variantId: input.variantId || null,
      title: input.title,
      salutation: input.salutation || "Dear Hiring Team,",
      openingParagraph: input.openingParagraph,
      bodyParagraphs: JSON.stringify(input.bodyParagraphs || []),
      closingParagraph: input.closingParagraph,
      fullMarkdown: input.fullMarkdown,
      evidenceCitations: JSON.stringify(input.evidenceCitations || []),
      status: input.status || "DRAFT",
    },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
        },
      },
      variant: {
        select: {
          id: true,
          variantTitle: true,
        },
      },
    },
  });
}

/**
 * Fetches all cover letters for a specific job ID.
 */
export async function getCoverLettersByJobId(jobId: string) {
  const letters = await prisma.coverLetter.findMany({
    where: { jobId },
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
        },
      },
      variant: {
        select: {
          id: true,
          variantTitle: true,
        },
      },
    },
  });

  return letters.map(parseCoverLetterJSON);
}

/**
 * Fetches all cover letters in the database.
 */
export async function getCoverLetters() {
  const letters = await prisma.coverLetter.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
        },
      },
      variant: {
        select: {
          id: true,
          variantTitle: true,
        },
      },
    },
  });

  return letters.map(parseCoverLetterJSON);
}

/**
 * Fetches a single CoverLetter by ID.
 */
export async function getCoverLetterById(id: string) {
  const letter = await prisma.coverLetter.findUnique({
    where: { id },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
        },
      },
      variant: {
        select: {
          id: true,
          variantTitle: true,
        },
      },
    },
  });

  if (!letter) return null;
  return parseCoverLetterJSON(letter);
}

/**
 * Updates an existing CoverLetter record.
 */
export async function updateCoverLetter(id: string, input: UpdateCoverLetterInput) {
  const existing = await prisma.coverLetter.findUnique({ where: { id } });
  if (!existing) {
    throw new Error(`CoverLetter not found: ${id}`);
  }

  const updated = await prisma.coverLetter.update({
    where: { id },
    data: {
      title: input.title,
      salutation: input.salutation,
      openingParagraph: input.openingParagraph,
      bodyParagraphs: input.bodyParagraphs ? JSON.stringify(input.bodyParagraphs) : undefined,
      closingParagraph: input.closingParagraph,
      fullMarkdown: input.fullMarkdown,
      evidenceCitations: input.evidenceCitations ? JSON.stringify(input.evidenceCitations) : undefined,
      status: input.status,
    },
    include: {
      job: {
        select: {
          id: true,
          company: true,
          roleTitle: true,
        },
      },
      variant: {
        select: {
          id: true,
          variantTitle: true,
        },
      },
    },
  });

  return parseCoverLetterJSON(updated);
}

/**
 * Deletes a CoverLetter record by ID.
 */
export async function deleteCoverLetter(id: string) {
  return await prisma.coverLetter.delete({
    where: { id },
  });
}

/**
 * Helper: Parses JSON array strings for bodyParagraphs and evidenceCitations.
 */
function parseCoverLetterJSON<T extends object>(record: T) {
  const raw = record as Record<string, unknown>;
  let bodyParagraphs: string[] = [];
  let evidenceCitations: string[] = [];

  try {
    bodyParagraphs = typeof raw.bodyParagraphs === "string" ? JSON.parse(raw.bodyParagraphs) : (raw.bodyParagraphs as string[]) || [];
  } catch {
    bodyParagraphs = [];
  }

  try {
    evidenceCitations = typeof raw.evidenceCitations === "string" ? JSON.parse(raw.evidenceCitations) : (raw.evidenceCitations as string[]) || [];
  } catch {
    evidenceCitations = [];
  }

  return {
    ...record,
    bodyParagraphs,
    evidenceCitations,
  };
}
