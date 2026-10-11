CREATE TABLE "StudioImport" (
 "id" TEXT PRIMARY KEY, "source" TEXT NOT NULL, "environment" TEXT NOT NULL,
 "sourceRecordId" TEXT NOT NULL, "transferId" TEXT NOT NULL UNIQUE,
 "recipientId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "originalPayload" TEXT NOT NULL, "payloadSha256" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'waiting' CHECK ("status" IN ('waiting','saved','published')),
 "reviewedData" JSONB, "version" INTEGER NOT NULL DEFAULT 0 CHECK ("version">=0),
 "lastSaveVersion" INTEGER, "lastSaveHash" TEXT,
 -- Immutable historical publication identity, retained after deliberate Lead deletion.
 -- Initial publication links the receipt and Lead transactionally; no live-row FK.
 "leadId" TEXT UNIQUE,
 "notificationStatus" TEXT NOT NULL DEFAULT 'pending' CHECK ("notificationStatus" IN ('pending','sent','unavailable')),
 "notificationLease" TEXT, "notificationLeaseUntil" TIMESTAMP(3), "notificationAttemptedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "StudioImport_source_environment_sourceRecordId_key" UNIQUE ("source","environment","sourceRecordId"),
 CONSTRAINT "StudioImport_publication_link" CHECK (("status"='published')=("leadId" IS NOT NULL)),
 CONSTRAINT "StudioImport_saved_data" CHECK ("status"='waiting' OR "reviewedData" IS NOT NULL)
);
CREATE INDEX "StudioImport_recipientId_status_createdAt_idx" ON "StudioImport"("recipientId","status","createdAt");
CREATE FUNCTION studio_import_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."source",NEW."environment",NEW."sourceRecordId",NEW."transferId",NEW."recipientId",NEW."originalPayload",NEW."payloadSha256") IS DISTINCT FROM ROW(OLD."source",OLD."environment",OLD."sourceRecordId",OLD."transferId",OLD."recipientId",OLD."originalPayload",OLD."payloadSha256") THEN RAISE EXCEPTION 'immutable import receipt'; END IF;
 IF OLD."leadId" IS NOT NULL AND NEW."leadId" IS DISTINCT FROM OLD."leadId" THEN RAISE EXCEPTION 'immutable import publication'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER studio_import_immutable BEFORE UPDATE ON "StudioImport" FOR EACH ROW EXECUTE FUNCTION studio_import_immutable();
