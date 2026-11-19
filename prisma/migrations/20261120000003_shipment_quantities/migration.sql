-- Sevkiyatta gerçek sevk edilen miktar (ör. 500 kg sipariş → 490 / 520 kg sevk). Tekrar çalıştırılması güvenlidir.
ALTER TABLE "OrderShipment" ADD COLUMN IF NOT EXISTS "items" JSONB;
ALTER TABLE "OrderShipment" ADD COLUMN IF NOT EXISTS "totalQuantity" DOUBLE PRECISION;
