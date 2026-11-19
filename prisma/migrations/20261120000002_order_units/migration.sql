-- Siparişte ürün birimi: çift (beden asortisi) dışındaki ürünler kg, metre, adet... miktarla
-- sipariş edilir; kg gibi birimler için toplam ondalıklı olabilir. Tekrar çalıştırılması güvenlidir.
ALTER TABLE "SoleOrder" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "SoleOrder" ALTER COLUMN "totalQuantity" TYPE DOUBLE PRECISION USING "totalQuantity"::double precision;
