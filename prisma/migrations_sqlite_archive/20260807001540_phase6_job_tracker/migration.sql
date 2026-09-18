-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT,
    "roleTitle" TEXT,
    "rawDescription" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'pasted',
    "extractedRequirements" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'SAVED',
    "appliedAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Job" ("company", "createdAt", "extractedRequirements", "id", "rawDescription", "roleTitle", "source") SELECT "company", "createdAt", "extractedRequirements", "id", "rawDescription", "roleTitle", "source" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
