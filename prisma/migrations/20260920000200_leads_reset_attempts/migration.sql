BEGIN;
CREATE TABLE "LeadResetAttempt" (
 "id" TEXT PRIMARY KEY, "key" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LeadResetAttempt_key_createdAt_idx" ON "LeadResetAttempt"("key", "createdAt");
COMMIT;
