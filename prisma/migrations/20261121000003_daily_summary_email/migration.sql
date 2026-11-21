-- Günlük özet e-postası ayarı (varsayılan açık, idempotent)
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "dailySummaryEmail" BOOLEAN NOT NULL DEFAULT true;
