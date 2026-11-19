-- Firma aboneliği (iPhone / RevenueCat, elle). Tekrar çalıştırılması güvenlidir.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "proUntil" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "subscriptionSource" TEXT;

-- Abonelik sistemi öncesi tüm firmalar ücretsiz ve süresiz devam eder (LEGACY).
-- Yalnızca kaynağı henüz belirlenmemiş firmalara uygulanır; yeniden çalıştırılınca sonradan açılan firmalara dokunmaz
-- çünkü yeni firmalar kayıtta kaynak alır (TRIAL).
UPDATE "Company"
SET "subscriptionStatus" = 'PRO', "proUntil" = NULL, "subscriptionSource" = 'LEGACY'
WHERE "subscriptionSource" IS NULL;
