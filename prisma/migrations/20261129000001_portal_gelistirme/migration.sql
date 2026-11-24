-- Müşteri portalı geliştirmeleri: kısmi sevkiyat, sipariş mesajları, portalda fiyat gösterimi. Tekrar çalıştırılması güvenlidir.

-- 1) Kısmi sevkiyat: bir siparişin birden fazla sevkiyatı olabilir
DROP INDEX IF EXISTS "OrderShipment_orderId_key";
CREATE INDEX IF NOT EXISTS "OrderShipment_orderId_shipmentDate_idx" ON "OrderShipment"("orderId", "shipmentDate");

-- 2) Sipariş mesajları ve iptal/değişiklik talepleri
CREATE TABLE IF NOT EXISTS "OrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MESSAGE',
    "authorType" TEXT NOT NULL,
    "userId" TEXT,
    "portalCustomerId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "readByStaffAt" TIMESTAMP(3),
    "readByCustomerAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrderMessage_orderId_createdAt_idx" ON "OrderMessage"("orderId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrderMessage_companyId_createdAt_idx" ON "OrderMessage"("companyId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OrderMessage_orderId_fkey') THEN
    ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "SoleOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 3) Portalda fiyat gösterimi (varsayılan kapalı)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "portalShowPrices" BOOLEAN NOT NULL DEFAULT false;
