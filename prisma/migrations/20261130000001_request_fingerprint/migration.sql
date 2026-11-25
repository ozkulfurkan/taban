-- Mükerrer kayıt koruması: aynı firmanın aynı içerikli kayıt isteği kısa süre içinde ikinci kez işlenmez
-- (çift tıklama, iki sekme, mobil ağ tekrarı). Tekrar çalıştırılması güvenlidir.
CREATE TABLE IF NOT EXISTS "RequestFingerprint" (
    "companyId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequestFingerprint_pkey" PRIMARY KEY ("companyId", "hash")
);
CREATE INDEX IF NOT EXISTS "RequestFingerprint_createdAt_idx" ON "RequestFingerprint"("createdAt");
