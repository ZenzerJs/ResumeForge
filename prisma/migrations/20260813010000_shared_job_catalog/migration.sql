-- Detach the job catalog from individual users. Jobs and descriptions are shared.
-- Deleting a user must not cascade-delete catalog rows.

ALTER TABLE "Job" DROP CONSTRAINT "Job_userId_fkey";

UPDATE "Job" SET "userId" = NULL;

ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
