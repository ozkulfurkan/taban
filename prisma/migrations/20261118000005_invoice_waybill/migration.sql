-- Satış/iade faturasında irsaliye numarası ve sevk tarihi (formda vardı ama kaydedilmiyordu).
-- Birden fazla çalıştırmak güvenlidir.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "irsaliyeNo" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "sevkTarihi" TIMESTAMP(3);
