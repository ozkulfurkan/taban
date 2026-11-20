-- Hesap silme: e-posta onay kodu ve 15 günlük pasif dönem. Tekrar çalıştırılması güvenlidir.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleteCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deleteCodeExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletionScheduledAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deletionScheduledAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "deletionRequestedById" TEXT;
