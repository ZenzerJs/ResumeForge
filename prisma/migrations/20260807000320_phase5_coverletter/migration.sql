-- CreateTable
CREATE TABLE "CoverLetter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "variantId" TEXT,
    "title" TEXT NOT NULL,
    "salutation" TEXT NOT NULL DEFAULT 'Dear Hiring Team,',
    "openingParagraph" TEXT NOT NULL,
    "bodyParagraphs" TEXT NOT NULL,
    "closingParagraph" TEXT NOT NULL,
    "fullMarkdown" TEXT NOT NULL,
    "evidenceCitations" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CoverLetter_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CoverLetter_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ResumeVariant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
