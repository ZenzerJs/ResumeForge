-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT,
    "roleTitle" TEXT,
    "rawDescription" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pasted',
    "extractedRequirements" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
