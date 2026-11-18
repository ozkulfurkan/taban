-- CreateTable
CREATE TABLE IF NOT EXISTS "DocumentCounter" (
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    CONSTRAINT "DocumentCounter_pkey" PRIMARY KEY ("companyId","key")
);
