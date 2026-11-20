-- Ürün fotoğrafı ve katalog PDF'i. Tekrar çalıştırılması güvenlidir.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUpdatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductImage_productId_key" ON "ProductImage"("productId");
CREATE INDEX IF NOT EXISTS "ProductImage_companyId_idx" ON "ProductImage"("companyId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProductImage_productId_fkey') THEN
    ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
