-- Koli etiketi: basılan her koli bir kayıttır (barkod → içerik). Tekrar çalıştırılması güvenlidir.
CREATE TABLE IF NOT EXISTS "Koli" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "productId" TEXT,
    "productCode" TEXT,
    "productName" TEXT NOT NULL,
    "color" TEXT,
    "customerId" TEXT,
    "customerName" TEXT,
    "orderId" TEXT,
    "orderNo" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'çift',
    "sizes" JSONB NOT NULL,
    "totalQuantity" INTEGER NOT NULL DEFAULT 0,
    "boxIndex" INTEGER NOT NULL DEFAULT 1,
    "boxCount" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Koli_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Koli_companyId_barcode_key" ON "Koli"("companyId", "barcode");
CREATE INDEX IF NOT EXISTS "Koli_companyId_createdAt_idx" ON "Koli"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "Koli_orderId_idx" ON "Koli"("orderId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Koli_companyId_fkey') THEN
    ALTER TABLE "Koli" ADD CONSTRAINT "Koli_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Koli_productId_fkey') THEN
    ALTER TABLE "Koli" ADD CONSTRAINT "Koli_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Koli_customerId_fkey') THEN
    ALTER TABLE "Koli" ADD CONSTRAINT "Koli_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Koli_orderId_fkey') THEN
    ALTER TABLE "Koli" ADD CONSTRAINT "Koli_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "SoleOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
