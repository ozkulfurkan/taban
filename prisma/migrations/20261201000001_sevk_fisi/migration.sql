-- Sevk fişi (Dispatch), yazdırma ayarları (PrintSettings) ve sevkiyatın fişe/satışa bağlanması. Tekrar çalıştırılması güvenlidir.

-- 1) Sevk fişi
CREATE TABLE IF NOT EXISTS "Dispatch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "no" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "carrier" TEXT,
    "vehiclePlate" TEXT,
    "driverName" TEXT,
    "notes" TEXT,
    "lines" JSONB NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "invoiceId" TEXT,
    "printedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dispatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Dispatch_invoiceId_key" ON "Dispatch"("invoiceId");
CREATE UNIQUE INDEX IF NOT EXISTS "Dispatch_companyId_no_key" ON "Dispatch"("companyId", "no");
CREATE INDEX IF NOT EXISTS "Dispatch_companyId_date_idx" ON "Dispatch"("companyId", "date");
CREATE INDEX IF NOT EXISTS "Dispatch_customerId_idx" ON "Dispatch"("customerId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispatch_companyId_fkey') THEN
    ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispatch_customerId_fkey') THEN
    ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Dispatch_invoiceId_fkey') THEN
    ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Sevkiyat → sevk fişi ve satış bağlantısı
ALTER TABLE "OrderShipment" ADD COLUMN IF NOT EXISTS "dispatchId" TEXT;
ALTER TABLE "OrderShipment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
CREATE INDEX IF NOT EXISTS "OrderShipment_dispatchId_idx" ON "OrderShipment"("dispatchId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderShipment_dispatchId_fkey') THEN
    ALTER TABLE "OrderShipment" ADD CONSTRAINT "OrderShipment_dispatchId_fkey" FOREIGN KEY ("dispatchId") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Yazdırma ayarları
CREATE TABLE IF NOT EXISTS "PrintSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "paper" TEXT NOT NULL DEFAULT 'A4',
    "widthMm" DOUBLE PRECISION NOT NULL DEFAULT 210,
    "heightMm" DOUBLE PRECISION NOT NULL DEFAULT 297,
    "marginTopMm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "marginRightMm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "marginBottomMm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "marginLeftMm" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "fontSizePt" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "lineHeightMm" DOUBLE PRECISION NOT NULL DEFAULT 6,
    "maxLines" INTEGER NOT NULL DEFAULT 20,
    "mode" TEXT NOT NULL DEFAULT 'full',
    "fieldPositions" JSONB,
    "showPrices" BOOLEAN NOT NULL DEFAULT false,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "postByDefault" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PrintSettings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PrintSettings_companyId_key" ON "PrintSettings"("companyId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PrintSettings_companyId_fkey') THEN
    ALTER TABLE "PrintSettings" ADD CONSTRAINT "PrintSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
