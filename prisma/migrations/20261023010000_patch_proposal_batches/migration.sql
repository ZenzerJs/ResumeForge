CREATE TABLE "PatchProposalBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "masterResumeId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "revisionToken" TEXT NOT NULL,
    "masterFingerprint" TEXT NOT NULL,
    "jobFingerprint" TEXT NOT NULL,
    "citationFingerprint" TEXT NOT NULL,
    "proposals" JSONB NOT NULL,
    "gaps" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatchProposalBatch_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PatchProposalBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatchProposalBatch_masterResumeId_fkey" FOREIGN KEY ("masterResumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatchProposalBatch_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PatchProposalBatch_userId_status_expiresAt_idx" ON "PatchProposalBatch"("userId", "status", "expiresAt");
