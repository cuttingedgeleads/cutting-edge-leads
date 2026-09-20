-- Additive Leads-owned changes ONLY. Never reset/synchronize the shared public schema.
BEGIN;
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
CREATE TABLE "LeadAuthSession" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "remember" BOOLEAN NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "LeadAuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LeadAuthSession_userId_idx" ON "LeadAuthSession"("userId");
CREATE INDEX "LeadAuthSession_expiresAt_idx" ON "LeadAuthSession"("expiresAt");
COMMIT;
