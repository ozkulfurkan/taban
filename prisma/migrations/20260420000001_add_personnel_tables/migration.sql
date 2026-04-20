-- AddPersonnelTables: safely adds new tables introduced with personnel module
-- Uses IF NOT EXISTS so it's safe to run on existing databases

-- Employee
CREATE TABLE IF NOT EXISTS "Employee" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "salary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TRY',
    "status" TEXT NOT NULL DEFAULT 'active',
    "hireDate" TIMESTAMP(3) NOT NULL,
    "payday" INTEGER NOT NULL DEFAULT 1,
    "leaveBalance" DOUBLE PRECISION NOT NULL DEFAULT 14,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- PersonnelLedger
CREATE TABLE IF NOT EXISTS "PersonnelLedger" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "debit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "account" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonnelLedger_pkey" PRIMARY KEY ("id")
);

-- PersonnelDocument
CREATE TABLE IF NOT EXISTS "PersonnelDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonnelDocument_pkey" PRIMARY KEY ("id")
);

-- SubcontractorStock
CREATE TABLE IF NOT EXISTS "SubcontractorStock" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SubcontractorStock_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "Employee_companyId_idx" ON "Employee"("companyId");
CREATE INDEX IF NOT EXISTS "PersonnelLedger_employeeId_idx" ON "PersonnelLedger"("employeeId");
CREATE INDEX IF NOT EXISTS "PersonnelLedger_companyId_idx" ON "PersonnelLedger"("companyId");
CREATE INDEX IF NOT EXISTS "PersonnelDocument_employeeId_idx" ON "PersonnelDocument"("employeeId");
CREATE INDEX IF NOT EXISTS "PersonnelDocument_companyId_idx" ON "PersonnelDocument"("companyId");
CREATE INDEX IF NOT EXISTS "SubcontractorStock_subcontractorId_idx" ON "SubcontractorStock"("subcontractorId");
CREATE UNIQUE INDEX IF NOT EXISTS "SubcontractorStock_subcontractorId_materialId_key" ON "SubcontractorStock"("subcontractorId", "materialId");

-- Foreign Keys (skip if already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Employee_companyId_fkey') THEN
    ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonnelLedger_employeeId_fkey') THEN
    ALTER TABLE "PersonnelLedger" ADD CONSTRAINT "PersonnelLedger_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonnelDocument_companyId_fkey') THEN
    ALTER TABLE "PersonnelDocument" ADD CONSTRAINT "PersonnelDocument_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PersonnelDocument_employeeId_fkey') THEN
    ALTER TABLE "PersonnelDocument" ADD CONSTRAINT "PersonnelDocument_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubcontractorStock_subcontractorId_fkey') THEN
    ALTER TABLE "SubcontractorStock" ADD CONSTRAINT "SubcontractorStock_subcontractorId_fkey"
      FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SubcontractorStock_materialId_fkey') THEN
    ALTER TABLE "SubcontractorStock" ADD CONSTRAINT "SubcontractorStock_materialId_fkey"
      FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
