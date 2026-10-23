-- CreateEnum
CREATE TYPE "WorkplaceType" AS ENUM ('REMOTE', 'HYBRID', 'ON_SITE', 'UNSPECIFIED');

-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'ADZUNA_CA', 'JOBICY', 'REMOTIVE', 'REMOTEOK', 'MANUAL');

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "dossierId" TEXT,
ADD COLUMN     "extractFailure" TEXT,
ADD COLUMN     "formattedJd" JSONB,
ADD COLUMN     "normalized" JSONB;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "factSnapshot" JSONB;

-- AlterTable
ALTER TABLE "ResumeVariant" ADD COLUMN     "factSnapshot" JSONB;

-- CreateTable
CREATE TABLE "IngestedJob" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "companyName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "workplaceType" "WorkplaceType" NOT NULL DEFAULT 'UNSPECIFIED',
    "isCanadianEligible" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,
    "descriptionHtml" TEXT NOT NULL,
    "applyUrl" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3),
    "salaryMin" INTEGER,
    "salaryMax" INTEGER,
    "salaryCurrency" TEXT DEFAULT 'CAD',
    "rawMetadata" JSONB,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "cityNorm" TEXT,
    "normalized" JSONB,
    "formattedJd" JSONB,
    "trackedJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestedJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectorSyncLog" (
    "id" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "status" TEXT NOT NULL,
    "jobsFound" INTEGER NOT NULL DEFAULT 0,
    "jobsInserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewProblem" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "problemTitle" TEXT NOT NULL,
    "category" TEXT DEFAULT 'OA',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" TEXT,
    "problemMarkdown" TEXT,
    "sourceUrl" TEXT,
    "lastObserved" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDossier" (
    "id" TEXT NOT NULL,
    "companySlug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "interviewStyle" JSONB,
    "cultureMetrics" JSONB,
    "recentSignals" TEXT,
    "referenceNotes" TEXT,
    "processNotes" TEXT,
    "isWhiteboardFree" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'llm',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyDossier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestedJob_fingerprint_key" ON "IngestedJob"("fingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "IngestedJob_trackedJobId_key" ON "IngestedJob"("trackedJobId");

-- CreateIndex
CREATE INDEX "IngestedJob_source_createdAt_idx" ON "IngestedJob"("source", "createdAt");

-- CreateIndex
CREATE INDEX "IngestedJob_companyName_idx" ON "IngestedJob"("companyName");

-- CreateIndex
CREATE INDEX "IngestedJob_isCanadianEligible_idx" ON "IngestedJob"("isCanadianEligible");

-- CreateIndex
CREATE INDEX "InterviewProblem_companyKey_idx" ON "InterviewProblem"("companyKey");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewProblem_companyKey_problemTitle_key" ON "InterviewProblem"("companyKey", "problemTitle");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyDossier_companySlug_key" ON "CompanyDossier"("companySlug");

-- CreateIndex
CREATE INDEX "CompanyDossier_companySlug_idx" ON "CompanyDossier"("companySlug");

-- CreateIndex
CREATE INDEX "Job_dossierId_idx" ON "Job"("dossierId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "CompanyDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestedJob" ADD CONSTRAINT "IngestedJob_trackedJobId_fkey" FOREIGN KEY ("trackedJobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
