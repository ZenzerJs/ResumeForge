-- CreateTable
CREATE TABLE "ResumeVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterResumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "typstContent" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResumeVariant_masterResumeId_fkey" FOREIGN KEY ("masterResumeId") REFERENCES "Resume" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResumeVariant_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "variantId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "targetSection" TEXT NOT NULL,
    "targetId" TEXT,
    "beforeContent" TEXT NOT NULL,
    "afterContent" TEXT NOT NULL,
    "evidenceCitations" TEXT NOT NULL DEFAULT '[]',
    "rationale" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Patch_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ResumeVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
