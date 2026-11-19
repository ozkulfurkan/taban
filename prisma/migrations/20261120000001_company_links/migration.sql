-- Firmalar arası bağlantı (firma kodu ile tedarikçiye sipariş). Tekrar çalıştırılması güvenlidir.

-- 1) Firma kodu
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Mevcut firmalara kod üret: SC- + 6 karakter (0/O ve 1/I gibi karışan karakterler yok)
UPDATE "Company" c
SET "code" = 'SC-' || (
  SELECT string_agg(substr('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', (get_byte(decode(md5(c."id" || ':solecost-code'), 'hex'), i) % 32) + 1, 1), '' ORDER BY i)
  FROM generate_series(0, 5) AS i
)
WHERE c."code" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_code_key" ON "Company"("code");

-- 2) Bağlantı durumu
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CompanyLinkStatus') THEN
    CREATE TYPE "CompanyLinkStatus" AS ENUM ('PENDING', 'ACTIVE', 'REJECTED', 'REVOKED');
  END IF;
END $$;

-- 3) Bağlantı tablosu
CREATE TABLE IF NOT EXISTS "CompanyLink" (
    "id" TEXT NOT NULL,
    "buyerCompanyId" TEXT NOT NULL,
    "sellerCompanyId" TEXT NOT NULL,
    "buyerSupplierId" TEXT,
    "sellerCustomerId" TEXT,
    "status" "CompanyLinkStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "CompanyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyLink_buyerCompanyId_sellerCompanyId_key" ON "CompanyLink"("buyerCompanyId", "sellerCompanyId");
CREATE INDEX IF NOT EXISTS "CompanyLink_sellerCompanyId_status_idx" ON "CompanyLink"("sellerCompanyId", "status");

-- 4) Siparişin hangi bağlantıdan geldiği
ALTER TABLE "SoleOrder" ADD COLUMN IF NOT EXISTS "linkId" TEXT;
ALTER TABLE "SoleOrder" ADD COLUMN IF NOT EXISTS "buyerUserId" TEXT;
CREATE INDEX IF NOT EXISTS "SoleOrder_linkId_idx" ON "SoleOrder"("linkId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyLink_buyerCompanyId_fkey') THEN
    ALTER TABLE "CompanyLink" ADD CONSTRAINT "CompanyLink_buyerCompanyId_fkey"
      FOREIGN KEY ("buyerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyLink_sellerCompanyId_fkey') THEN
    ALTER TABLE "CompanyLink" ADD CONSTRAINT "CompanyLink_sellerCompanyId_fkey"
      FOREIGN KEY ("sellerCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyLink_buyerSupplierId_fkey') THEN
    ALTER TABLE "CompanyLink" ADD CONSTRAINT "CompanyLink_buyerSupplierId_fkey"
      FOREIGN KEY ("buyerSupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CompanyLink_sellerCustomerId_fkey') THEN
    ALTER TABLE "CompanyLink" ADD CONSTRAINT "CompanyLink_sellerCustomerId_fkey"
      FOREIGN KEY ("sellerCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SoleOrder_linkId_fkey') THEN
    ALTER TABLE "SoleOrder" ADD CONSTRAINT "SoleOrder_linkId_fkey"
      FOREIGN KEY ("linkId") REFERENCES "CompanyLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
