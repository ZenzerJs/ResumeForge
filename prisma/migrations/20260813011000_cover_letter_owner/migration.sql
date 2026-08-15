-- Cover letters stay private after jobs became a shared catalog.

ALTER TABLE "CoverLetter" ADD COLUMN "userId" TEXT;

CREATE INDEX "CoverLetter_userId_idx" ON "CoverLetter"("userId");

ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
