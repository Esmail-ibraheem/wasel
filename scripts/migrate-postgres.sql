-- Idempotent data migrations run before `prisma db push` on Postgres deployments.
-- Each statement must be safe to run repeatedly.

-- 2026-09-18 licensing: existing businesses need a public id before the column becomes NOT NULL.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "publicId" TEXT;
UPDATE "Business"
   SET "publicId" = 'WSL-B-' || upper(substr(md5(id || clock_timestamp()::text), 1, 6))
 WHERE "publicId" IS NULL;
ALTER TABLE "Business" ALTER COLUMN "publicId" SET NOT NULL;
-- Prisma names @unique indexes <Table>_<column>_key; creating it here means `db push` sees the schema already in sync.
CREATE UNIQUE INDEX IF NOT EXISTS "Business_publicId_key" ON "Business"("publicId");
