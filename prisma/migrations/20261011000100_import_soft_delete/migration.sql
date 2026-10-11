-- Additive: preserve immutable receipts, unique delivery keys and old wire status values.
ALTER TABLE "StudioImport" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "StudioImport" ADD CONSTRAINT "StudioImport_delete_unpublished"
  CHECK ("deletedAt" IS NULL OR "status" IN ('waiting', 'saved'));

-- Old/cached application versions cannot revive or publish a deleted import.
CREATE FUNCTION studio_import_deleted_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."deletedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'deleted import is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER studio_import_deleted_guard BEFORE UPDATE ON "StudioImport"
  FOR EACH ROW EXECUTE FUNCTION studio_import_deleted_guard();
