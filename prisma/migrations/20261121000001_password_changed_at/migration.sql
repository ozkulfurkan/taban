-- Şifre değişince eski oturumların geçersiz olması için değişiklik zamanı (idempotent)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
ALTER TABLE "PortalCustomer" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP(3);
