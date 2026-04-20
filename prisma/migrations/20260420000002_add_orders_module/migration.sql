-- AlterTable: portalCustomerId optional
ALTER TABLE "SoleOrder" ALTER COLUMN "portalCustomerId" DROP NOT NULL;

-- AlterTable: new fields on SoleOrder
ALTER TABLE "SoleOrder" ADD COLUMN "partVariantsData" JSONB;
ALTER TABLE "SoleOrder" ADD COLUMN "invoiceId" TEXT;
ALTER TABLE "SoleOrder" ADD COLUMN "convertedAt" TIMESTAMP(3);

-- CreateIndex: unique invoiceId
CREATE UNIQUE INDEX "SoleOrder_invoiceId_key" ON "SoleOrder"("invoiceId");

-- AddForeignKey: SoleOrder.invoiceId -> Invoice.id
ALTER TABLE "SoleOrder" ADD CONSTRAINT "SoleOrder_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
