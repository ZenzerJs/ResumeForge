-- Additive hot-path composite indexes (Phase 4 performance & scaling)
-- All statements use CREATE INDEX IF NOT EXISTS for idempotent replay safety.

-- Resume hot lookups (getMasterResume, getResumes)
CREATE INDEX IF NOT EXISTS "Resume_userId_isMaster_idx" ON "Resume"("userId", "isMaster");
CREATE INDEX IF NOT EXISTS "Resume_userId_updatedAt_idx" ON "Resume"("userId", "updatedAt" DESC);

-- EvidenceItem & Bullet hot lookups (getEvidenceItems, ordered bullets)
CREATE INDEX IF NOT EXISTS "EvidenceItem_userId_status_idx" ON "EvidenceItem"("userId", "status");
CREATE INDEX IF NOT EXISTS "EvidenceItem_userId_createdAt_idx" ON "EvidenceItem"("userId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Bullet_evidenceId_idx" ON "Bullet"("evidenceId");
CREATE INDEX IF NOT EXISTS "Bullet_evidenceId_orderIndex_idx" ON "Bullet"("evidenceId", "orderIndex");

-- IngestedJob feed filtering & sorting (GET /api/connectors/jobs)
CREATE INDEX IF NOT EXISTS "IngestedJob_isCanadianEligible_workplaceType_postedAt_creat_idx" ON "IngestedJob"("isCanadianEligible", "workplaceType", "postedAt" DESC, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "IngestedJob_postedAt_createdAt_idx" ON "IngestedJob"("postedAt" DESC, "createdAt" DESC);

-- ConnectorSyncLog status queries (GET /api/connectors/status)
CREATE INDEX IF NOT EXISTS "ConnectorSyncLog_executedAt_idx" ON "ConnectorSyncLog"("executedAt" DESC);
CREATE INDEX IF NOT EXISTS "ConnectorSyncLog_source_executedAt_idx" ON "ConnectorSyncLog"("source", "executedAt" DESC);

-- PatchProposalBatch job deletion / lookup precheck
CREATE INDEX IF NOT EXISTS "PatchProposalBatch_jobId_idx" ON "PatchProposalBatch"("jobId");

-- CoverLetter list & job-scoped queries
CREATE INDEX IF NOT EXISTS "CoverLetter_jobId_idx" ON "CoverLetter"("jobId");
CREATE INDEX IF NOT EXISTS "CoverLetter_variantId_idx" ON "CoverLetter"("variantId");
CREATE INDEX IF NOT EXISTS "CoverLetter_userId_jobId_idx" ON "CoverLetter"("userId", "jobId");
CREATE INDEX IF NOT EXISTS "CoverLetter_userId_createdAt_idx" ON "CoverLetter"("userId", "createdAt" DESC);

-- DiscoveredJob feed queries
CREATE INDEX IF NOT EXISTS "DiscoveredJob_isClosed_createdAt_idx" ON "DiscoveredJob"("isClosed", "createdAt" DESC);

-- MasterHistory snapshot queries
CREATE INDEX IF NOT EXISTS "MasterHistory_resumeId_savedAt_idx" ON "MasterHistory"("resumeId", "savedAt" DESC);
