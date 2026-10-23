CREATE TABLE "PatchCitation" (
    "id" TEXT NOT NULL,
    "patchId" TEXT NOT NULL,
    "evidenceId" TEXT,
    "bulletId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatchCitation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PatchCitation_has_reference_check"
        CHECK ("evidenceId" IS NOT NULL OR "bulletId" IS NOT NULL),
    CONSTRAINT "PatchCitation_patchId_fkey"
        FOREIGN KEY ("patchId") REFERENCES "Patch"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PatchCitation_evidenceId_fkey"
        FOREIGN KEY ("evidenceId") REFERENCES "EvidenceItem"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PatchCitation_bulletId_fkey"
        FOREIGN KEY ("bulletId") REFERENCES "Bullet"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PatchCitation_patchId_idx" ON "PatchCitation"("patchId");
CREATE INDEX "PatchCitation_evidenceId_idx" ON "PatchCitation"("evidenceId");
CREATE INDEX "PatchCitation_bulletId_idx" ON "PatchCitation"("bulletId");
