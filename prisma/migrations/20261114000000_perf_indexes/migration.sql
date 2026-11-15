-- CreateIndex
CREATE INDEX IF NOT EXISTS "Bullet_evidenceId_idx" ON "Bullet"("evidenceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Job_userId_createdAt_idx" ON "Job"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ResumeVariant_masterResumeId_idx" ON "ResumeVariant"("masterResumeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ResumeVariant_jobId_idx" ON "ResumeVariant"("jobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Patch_variantId_idx" ON "Patch"("variantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoverLetter_jobId_idx" ON "CoverLetter"("jobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CoverLetter_variantId_idx" ON "CoverLetter"("variantId");
