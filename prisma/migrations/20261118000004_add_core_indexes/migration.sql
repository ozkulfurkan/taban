-- Sık sorgulanan tablolar için indeksler (firma, tarih ve bağlı kayıt alanları).
-- Birden fazla çalıştırmak güvenlidir.
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Account_companyId_idx" ON "Account"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cek_companyId_idx" ON "Cek"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cek_customerId_idx" ON "Cek"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Cek_supplierId_idx" ON "Cek"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Customer_companyId_idx" ON "Customer"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_companyId_date_idx" ON "Invoice"("companyId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceItem_invoiceId_idx" ON "InvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Material_companyId_idx" ON "Material"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_companyId_date_idx" ON "Payment"("companyId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_supplierId_idx" ON "Payment"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_purchaseId_idx" ON "Payment"("purchaseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_accountId_idx" ON "Payment"("accountId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PriceHistory_materialId_idx" ON "PriceHistory"("materialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Product_companyId_idx" ON "Product"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductExtraCost_productId_idx" ON "ProductExtraCost"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductPart_productId_idx" ON "ProductPart"("productId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Purchase_companyId_date_idx" ON "Purchase"("companyId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseMaterial_purchaseId_idx" ON "PurchaseMaterial"("purchaseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PurchaseMaterial_materialId_idx" ON "PurchaseMaterial"("materialId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SoleCalculation_companyId_idx" ON "SoleCalculation"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SoleOrder_companyId_createdAt_idx" ON "SoleOrder"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SoleOrder_customerId_idx" ON "SoleOrder"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SolePart_calculationId_idx" ON "SolePart"("calculationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Supplier_companyId_idx" ON "Supplier"("companyId");

