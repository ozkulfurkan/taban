-- Hesap ekstresini link ile paylaşma. Tekrar çalıştırılması güvenlidir.
CREATE TABLE IF NOT EXISTS "StatementShareLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "supplierId" TEXT,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StatementShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StatementShareLink_token_key" ON "StatementShareLink"("token");
CREATE INDEX IF NOT EXISTS "StatementShareLink_companyId_idx" ON "StatementShareLink"("companyId");
CREATE INDEX IF NOT EXISTS "StatementShareLink_customerId_idx" ON "StatementShareLink"("customerId");
CREATE INDEX IF NOT EXISTS "StatementShareLink_supplierId_idx" ON "StatementShareLink"("supplierId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StatementShareLink_companyId_fkey') THEN
    ALTER TABLE "StatementShareLink" ADD CONSTRAINT "StatementShareLink_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StatementShareLink_customerId_fkey') THEN
    ALTER TABLE "StatementShareLink" ADD CONSTRAINT "StatementShareLink_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StatementShareLink_supplierId_fkey') THEN
    ALTER TABLE "StatementShareLink" ADD CONSTRAINT "StatementShareLink_supplierId_fkey"
      FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
