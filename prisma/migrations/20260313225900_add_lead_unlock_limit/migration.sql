-- Add unlock limit per lead
ALTER TABLE "Lead" ADD COLUMN "unlockLimit" INTEGER NOT NULL DEFAULT 1;
