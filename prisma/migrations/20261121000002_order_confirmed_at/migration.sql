-- Sipariş onayı: satıcı siparişi onaylayınca zaman damgası (idempotent)
ALTER TABLE "SoleOrder" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
-- Mevcut siparişler: üretime girmiş/ilerlemiş olanlar onaylanmış sayılır (yalnızca boş olanlar doldurulur)
UPDATE "SoleOrder" SET "confirmedAt" = "updatedAt" WHERE "confirmedAt" IS NULL AND "status" <> 'ORDER_RECEIVED';
