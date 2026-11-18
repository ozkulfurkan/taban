-- Bankaya verilen çekin hangi banka hesabına verildiği (tahsilde varsayılan hesap).
-- Birden fazla çalıştırmak güvenlidir.
ALTER TABLE "Cek" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;
CREATE INDEX IF NOT EXISTS "Cek_bankAccountId_idx" ON "Cek"("bankAccountId");
DO $$ BEGIN
  ALTER TABLE "Cek" ADD CONSTRAINT "Cek_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
