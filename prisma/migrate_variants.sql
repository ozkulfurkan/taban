-- ============================================================
-- MaterialVariant → Flat Material Migration
-- Her varyant kendi başına bir Material olur, category = parent adı
-- ============================================================

-- 1. Material tablosuna category kolonu ekle (yoksa)
ALTER TABLE "Material" ADD COLUMN IF NOT EXISTS "category" TEXT;

-- 2. Her MaterialVariant için yeni Material kaydı oluştur
-- Geçici tablo: eski variantId → yeni materialId eşlemesi
CREATE TEMP TABLE variant_to_material AS
SELECT
  v.id AS variant_id,
  gen_random_uuid()::text AS new_material_id,
  m."companyId",
  m.name || ' - ' || v."colorName" || COALESCE(' (' || v.code || ')', '') AS new_name,
  m.name AS category,
  m.supplier,
  m."pricePerKg",
  m.currency,
  m.description,
  v.stock,
  v."materialId" AS parent_material_id
FROM "MaterialVariant" v
JOIN "Material" m ON m.id = v."materialId";

-- 3. Yeni Material kayıtlarını ekle
INSERT INTO "Material" (id, "companyId", name, category, supplier, "pricePerKg", currency, description, stock, "createdAt", "updatedAt")
SELECT
  new_material_id,
  "companyId",
  new_name,
  category,
  supplier,
  "pricePerKg",
  currency,
  description,
  stock,
  NOW(),
  NOW()
FROM variant_to_material;

-- 4. Parent material'lara category = kendi adları ata
-- (variantı olan materialler "kategori" olarak kalır)
UPDATE "Material" m
SET category = m.name
WHERE EXISTS (
  SELECT 1 FROM "MaterialVariant" v WHERE v."materialId" = m.id
);

-- 5. ProductPart: materialVariantId olan satırları yeni materialId ile güncelle
UPDATE "ProductPart" pp
SET "materialId" = vtm.new_material_id
FROM variant_to_material vtm
WHERE pp."materialVariantId" = vtm.variant_id;

-- 6. PurchaseMaterial: materialVariantId olan satırları güncelle
UPDATE "PurchaseMaterial" pm
SET "materialId" = vtm.new_material_id
FROM variant_to_material vtm
WHERE pm."materialVariantId" = vtm.variant_id;

-- 7. MaterialTransfer: materialVariantId olan satırları güncelle
UPDATE "MaterialTransfer" mt
SET "materialId" = vtm.new_material_id
FROM variant_to_material vtm
WHERE mt."materialVariantId" = vtm.variant_id;

-- 8. SubcontractorStock: materialVariantId olan satırları güncelle
-- Önce çakışan kayıtları birleştir (aynı subcontractorId+materialId varsa quantity topla)
UPDATE "SubcontractorStock" ss
SET "materialId" = vtm.new_material_id
FROM variant_to_material vtm
WHERE ss."materialVariantId" = vtm.variant_id;

-- Duplicate olan SubcontractorStock kayıtlarını birleştir
-- (aynı subcontractorId + yeni materialId)
WITH dupes AS (
  SELECT "subcontractorId", "materialId", SUM(quantity) AS total_qty, MIN(id) AS keep_id
  FROM "SubcontractorStock"
  GROUP BY "subcontractorId", "materialId"
  HAVING COUNT(*) > 1
)
UPDATE "SubcontractorStock" ss
SET quantity = d.total_qty
FROM dupes d
WHERE ss.id = d.keep_id
  AND ss."subcontractorId" = d."subcontractorId"
  AND ss."materialId" = d."materialId";

DELETE FROM "SubcontractorStock" ss
USING (
  SELECT "subcontractorId", "materialId", MIN(id) AS keep_id
  FROM "SubcontractorStock"
  GROUP BY "subcontractorId", "materialId"
  HAVING COUNT(*) > 1
) dup
WHERE ss."subcontractorId" = dup."subcontractorId"
  AND ss."materialId" = dup."materialId"
  AND ss.id != dup.keep_id;

-- 9. SubcontractorScrap: materialVariantId olan satırları güncelle
UPDATE "SubcontractorScrap" sc
SET "materialId" = vtm.new_material_id
FROM variant_to_material vtm
WHERE sc."materialVariantId" = vtm.variant_id;

-- Geçici tablo kaldır
DROP TABLE variant_to_material;
