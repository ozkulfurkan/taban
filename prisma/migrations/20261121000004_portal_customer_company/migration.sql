-- Aynı e-posta birden fazla firmanın portal kullanıcısı olabilir: tekillik "firma + e-posta" (idempotent)
ALTER TABLE "PortalCustomer" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
UPDATE "PortalCustomer" pc SET "companyId" = c."companyId" FROM "Customer" c WHERE pc."companyId" IS NULL AND pc."customerId" = c."id";
UPDATE "PortalCustomer" pc SET "companyId" = s."companyId" FROM "Subcontractor" s WHERE pc."companyId" IS NULL AND s."portalCustomerId" = pc."id";
DROP INDEX IF EXISTS "PortalCustomer_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PortalCustomer_companyId_email_key" ON "PortalCustomer"("companyId", "email");
CREATE INDEX IF NOT EXISTS "PortalCustomer_email_idx" ON "PortalCustomer"("email");
