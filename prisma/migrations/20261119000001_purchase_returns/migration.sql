-- Tedarikçiye mal iadesi: alış iadesi Purchase tablosunda isReturn=true olarak tutulur.
-- Tutar pozitif saklanır; tedarikçi borcunu azaltır, stoğu düşürür. Birden fazla çalıştırmak güvenlidir.
ALTER TABLE "Purchase" ADD COLUMN IF NOT EXISTS "isReturn" BOOLEAN NOT NULL DEFAULT false;
