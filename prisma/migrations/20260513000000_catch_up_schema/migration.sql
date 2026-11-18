-- Migration geçmişini şemayla eşitler.
-- Bu tablolar ve sütunlar canlıya "prisma db push" ile eklenmiş, migration geçmişine
-- hiç yazılmamıştı; bu yüzden boş bir veritabanında "prisma migrate deploy" hata veriyordu.
-- Her ifade "yoksa oluştur" biçimindedir: canlı veritabanında hiçbir şey değiştirmez,
-- boş veritabanında eksikleri tamamlar.

DO $$ BEGIN
  CREATE TYPE "TicketStatus" AS ENUM ('YENI', 'INCELENIYOR', 'CEVAPLANDI', 'COZULDU');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TicketPriority" AS ENUM ('DUSUK', 'ORTA', 'KRITIK');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "TicketType" AS ENUM ('BUG', 'ONERI');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CompanyType" AS ENUM ('SOLE_MANUFACTURER', 'MATERIAL_SUPPLIER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "PurchaseMaterial" DROP CONSTRAINT IF EXISTS "PurchaseMaterial_materialId_fkey";

ALTER TABLE "SoleOrder" DROP CONSTRAINT IF EXISTS "SoleOrder_portalCustomerId_fkey";

ALTER TABLE "Cek" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "companyType" "CompanyType" NOT NULL DEFAULT 'SOLE_MANUFACTURER';

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
ADD COLUMN IF NOT EXISTS "status" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "PersonnelLedger" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
ADD COLUMN IF NOT EXISTS "renk" TEXT,
ADD COLUMN IF NOT EXISTS "shore" TEXT;

ALTER TABLE "PurchaseMaterial" ADD COLUMN IF NOT EXISTS "productId" TEXT,
ALTER COLUMN "materialId" DROP NOT NULL;

ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "categoryId" TEXT,
ADD COLUMN IF NOT EXISTS "status" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "CustomerCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupplierCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerProductPrice" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProductPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialCalculation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "kurUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kurEur" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "kdvRate" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "laborPerKg" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "laborCur" TEXT NOT NULL DEFAULT 'TRY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCalculation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialCalculationItem" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "unitPriceExVat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MaterialCalculationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SupportTicket" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL DEFAULT 'BUG',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "module" TEXT,
    "priority" "TicketPriority" NOT NULL DEFAULT 'ORTA',
    "status" "TicketStatus" NOT NULL DEFAULT 'YENI',
    "pageUrl" TEXT,
    "browser" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TicketAttachment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BarcodeSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "labelWidth" INTEGER NOT NULL DEFAULT 100,
    "labelHeight" INTEGER NOT NULL DEFAULT 100,
    "labelPadding" INTEGER NOT NULL DEFAULT 3,
    "companyFontSize" INTEGER NOT NULL DEFAULT 7,
    "productFontSize" INTEGER NOT NULL DEFAULT 9,
    "productCodeFontSize" INTEGER NOT NULL DEFAULT 7,
    "detailsFontSize" INTEGER NOT NULL DEFAULT 6,
    "barcodeFontSize" INTEGER NOT NULL DEFAULT 6,
    "dateFontSize" INTEGER NOT NULL DEFAULT 6,
    "barcodeHeight" INTEGER NOT NULL DEFAULT 35,
    "defaultQtyPerPack" TEXT NOT NULL DEFAULT '1',
    "defaultQtyUnit" TEXT NOT NULL DEFAULT 'adet',

    CONSTRAINT "BarcodeSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BarcodeSequence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BarcodeSequence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProductStockAdjustment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductStockAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DocumentCounter" (
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("companyId","key")
);

CREATE INDEX IF NOT EXISTS "CustomerCategory_companyId_idx" ON "CustomerCategory"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerCategory_companyId_name_key" ON "CustomerCategory"("companyId", "name");

CREATE INDEX IF NOT EXISTS "SupplierCategory_companyId_idx" ON "SupplierCategory"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierCategory_companyId_name_key" ON "SupplierCategory"("companyId", "name");

CREATE INDEX IF NOT EXISTS "ProductCategory_companyId_idx" ON "ProductCategory"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "ProductCategory_companyId_name_key" ON "ProductCategory"("companyId", "name");

CREATE INDEX IF NOT EXISTS "CustomerProductPrice_companyId_idx" ON "CustomerProductPrice"("companyId");

CREATE INDEX IF NOT EXISTS "CustomerProductPrice_customerId_idx" ON "CustomerProductPrice"("customerId");

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerProductPrice_customerId_productId_key" ON "CustomerProductPrice"("customerId", "productId");

CREATE INDEX IF NOT EXISTS "MaterialCalculation_companyId_idx" ON "MaterialCalculation"("companyId");

CREATE INDEX IF NOT EXISTS "MaterialCalculationItem_calculationId_idx" ON "MaterialCalculationItem"("calculationId");

CREATE INDEX IF NOT EXISTS "SupportTicket_companyId_idx" ON "SupportTicket"("companyId");

CREATE INDEX IF NOT EXISTS "SupportTicket_status_idx" ON "SupportTicket"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_companyId_ticketNo_key" ON "SupportTicket"("companyId", "ticketNo");

CREATE UNIQUE INDEX IF NOT EXISTS "BarcodeSettings_companyId_key" ON "BarcodeSettings"("companyId");

CREATE INDEX IF NOT EXISTS "BarcodeSettings_companyId_idx" ON "BarcodeSettings"("companyId");

CREATE INDEX IF NOT EXISTS "BarcodeSequence_companyId_idx" ON "BarcodeSequence"("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "BarcodeSequence_companyId_date_key" ON "BarcodeSequence"("companyId", "date");

CREATE INDEX IF NOT EXISTS "ProductStockAdjustment_productId_idx" ON "ProductStockAdjustment"("productId");

CREATE INDEX IF NOT EXISTS "ProductStockAdjustment_companyId_idx" ON "ProductStockAdjustment"("companyId");

CREATE INDEX IF NOT EXISTS "LoginAttempt_key_createdAt_idx" ON "LoginAttempt"("key", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_companyId_invoiceNo_key" ON "Invoice"("companyId", "invoiceNo");

CREATE UNIQUE INDEX IF NOT EXISTS "Purchase_companyId_invoiceNo_key" ON "Purchase"("companyId", "invoiceNo");

CREATE UNIQUE INDEX IF NOT EXISTS "SoleOrder_companyId_orderNo_key" ON "SoleOrder"("companyId", "orderNo");

DO $$ BEGIN
  ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerCategory" ADD CONSTRAINT "CustomerCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Customer" ADD CONSTRAINT "Customer_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CustomerCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierCategory" ADD CONSTRAINT "SupplierCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "SupplierCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseMaterial" ADD CONSTRAINT "PurchaseMaterial_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseMaterial" ADD CONSTRAINT "PurchaseMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SoleOrder" ADD CONSTRAINT "SoleOrder_portalCustomerId_fkey" FOREIGN KEY ("portalCustomerId") REFERENCES "PortalCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CustomerProductPrice" ADD CONSTRAINT "CustomerProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialCalculation" ADD CONSTRAINT "MaterialCalculation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MaterialCalculationItem" ADD CONSTRAINT "MaterialCalculationItem_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "MaterialCalculation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BarcodeSettings" ADD CONSTRAINT "BarcodeSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductStockAdjustment" ADD CONSTRAINT "ProductStockAdjustment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProductStockAdjustment" ADD CONSTRAINT "ProductStockAdjustment_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
