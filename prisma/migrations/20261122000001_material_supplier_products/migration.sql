-- Firma ağı: alıcının hammaddesi ↔ bağlı satıcının ürünü eşleşmesi ("Tabanlarım" görünümü). Tekrar çalıştırılması güvenlidir.
CREATE TABLE IF NOT EXISTS "MaterialSupplierProduct" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "sellerProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MaterialSupplierProduct_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MaterialSupplierProduct_linkId_idx" ON "MaterialSupplierProduct"("linkId");
CREATE UNIQUE INDEX IF NOT EXISTS "MaterialSupplierProduct_materialId_linkId_key" ON "MaterialSupplierProduct"("materialId", "linkId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialSupplierProduct_materialId_fkey') THEN
    ALTER TABLE "MaterialSupplierProduct" ADD CONSTRAINT "MaterialSupplierProduct_materialId_fkey"
      FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialSupplierProduct_linkId_fkey') THEN
    ALTER TABLE "MaterialSupplierProduct" ADD CONSTRAINT "MaterialSupplierProduct_linkId_fkey"
      FOREIGN KEY ("linkId") REFERENCES "CompanyLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialSupplierProduct_sellerProductId_fkey') THEN
    ALTER TABLE "MaterialSupplierProduct" ADD CONSTRAINT "MaterialSupplierProduct_sellerProductId_fkey"
      FOREIGN KEY ("sellerProductId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
