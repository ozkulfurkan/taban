-- İade faturaları eskiden negatif tutarla kaydediliyordu; düzenlenen iadeler ise pozitif.
-- Artık tüm tutarlar pozitif saklanıyor, yönü "isReturn" belirliyor.
-- Birden fazla çalıştırmak güvenlidir (sadece negatif kayıtları değiştirir).
UPDATE "InvoiceItem" SET "total" = ABS("total")
WHERE "total" < 0 AND "invoiceId" IN (SELECT "id" FROM "Invoice" WHERE "isReturn" = true);

UPDATE "Invoice" SET "subtotal" = ABS("subtotal"), "vatAmount" = ABS("vatAmount"), "total" = ABS("total")
WHERE "isReturn" = true AND ("total" < 0 OR "subtotal" < 0 OR "vatAmount" < 0);
