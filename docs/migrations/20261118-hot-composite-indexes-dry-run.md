# Dry-Run Verification Report: `20261118010000_add_hot_composite_indexes`

- **Date:** 2026-11-18
- **Migration:** `prisma/migrations/20261118010000_add_hot_composite_indexes/migration.sql`
- **Invariant Check (`AGENTS.md` Invariant 4):** Strictly additive index creation (`CREATE INDEX IF NOT EXISTS`). Zero `DROP`, `ALTER`, or table-rewriting operations. `Patch.evidenceCitations` and `PatchCitation` remain untouched.

## Command Executed

```bash
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

## Diff Output Summary

- `DROP` statements: **0**
- `ALTER` statements: **0**
- `CREATE INDEX` statements: **Additive only**

### New Composite & Hot-Path Indexes Verified

1. `Resume_userId_isMaster_idx` ON `"Resume"("userId", "isMaster")`
2. `Resume_userId_updatedAt_idx` ON `"Resume"("userId", "updatedAt" DESC)`
3. `EvidenceItem_userId_status_idx` ON `"EvidenceItem"("userId", "status")`
4. `EvidenceItem_userId_createdAt_idx` ON `"EvidenceItem"("userId", "createdAt" DESC)`
5. `Bullet_evidenceId_orderIndex_idx` ON `"Bullet"("evidenceId", "orderIndex")`
6. `IngestedJob_isCanadianEligible_workplaceType_postedAt_creat_idx` ON `"IngestedJob"("isCanadianEligible", "workplaceType", "postedAt" DESC, "createdAt" DESC)`
7. `IngestedJob_postedAt_createdAt_idx` ON `"IngestedJob"("postedAt" DESC, "createdAt" DESC)`
8. `ConnectorSyncLog_executedAt_idx` ON `"ConnectorSyncLog"("executedAt" DESC)`
9. `ConnectorSyncLog_source_executedAt_idx` ON `"ConnectorSyncLog"("source", "executedAt" DESC)`
10. `PatchProposalBatch_jobId_idx` ON `"PatchProposalBatch"("jobId")`
11. `CoverLetter_userId_jobId_idx` ON `"CoverLetter"("userId", "jobId")`
12. `CoverLetter_userId_createdAt_idx` ON `"CoverLetter"("userId", "createdAt" DESC)`
13. `DiscoveredJob_isClosed_createdAt_idx` ON `"DiscoveredJob"("isClosed", "createdAt" DESC)`
14. `MasterHistory_resumeId_savedAt_idx` ON `"MasterHistory"("resumeId", "savedAt" DESC)`
