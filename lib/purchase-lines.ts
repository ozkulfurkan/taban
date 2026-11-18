// Alış kalemleri ve stok etkileri tek yerde: yeni alış, alış düzenleme ve
// alış silme aynı kuralları kullanır.
//  - ürün kalemi: ürün stoğu artar
//  - hammadde kalemi: ana depo (Material.stock) ya da fasoncu deposu artar
// Her kalem bir PurchaseMaterial satırı olarak saklanır (kgAmount = miktar).
import type { Prisma } from '@prisma/client';
import { parseAmount, round2 } from './money';

type Tx = Prisma.TransactionClient;

export type PurchaseLineInput = {
  productId?: string | null;
  materialId?: string | null;
  subcontractorId?: string | null;
  qty: unknown;
  unitPrice: unknown;
};

export type PurchaseLine = {
  productId: string | null;
  materialId: string | null;
  subcontractorId: string | null;
  qty: number;
  unitPrice: number;
};

export type ValidatedLines = { ok: true; lines: PurchaseLine[]; total: number } | { ok: false; error: string };

export function validatePurchaseLines(items: unknown): ValidatedLines {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'En az bir kalem girin' };
  const lines: PurchaseLine[] = [];
  for (let k = 0; k < items.length; k++) {
    const i = (items[k] ?? {}) as PurchaseLineInput;
    const qty = parseAmount(i.qty);
    const unitPrice = parseAmount(i.unitPrice);
    if (!(qty > 0)) return { ok: false, error: `${k + 1}. kalem: miktar 0'dan büyük olmalı` };
    if (!(unitPrice >= 0)) return { ok: false, error: `${k + 1}. kalem: birim fiyat geçersiz` };
    if (unitPrice > 1e9 || qty > 1e9) return { ok: false, error: `${k + 1}. kalem: tutar çok büyük` };
    const productId = i.productId || null;
    const materialId = productId ? null : i.materialId || null;
    if (!productId && !materialId) return { ok: false, error: `${k + 1}. kalem: ürün ya da hammadde seçin` };
    lines.push({ productId, materialId, subcontractorId: materialId ? i.subcontractorId || null : null, qty, unitPrice });
  }
  const total = round2(lines.reduce((s, l) => s + round2(l.qty * l.unitPrice), 0));
  if (!(total > 0)) return { ok: false, error: 'Alış toplamı 0 olamaz' };
  return { ok: true, lines, total };
}

async function changeSubcontractorStock(tx: Tx, subcontractorId: string, materialId: string, delta: number) {
  const existing = await tx.subcontractorStock.findFirst({ where: { subcontractorId, materialId } });
  if (existing) {
    await tx.subcontractorStock.update({ where: { id: existing.id }, data: { quantity: { increment: delta } } });
  } else if (delta !== 0) { // iade depoda kayıt yokken de eksiye düşebilir
    await tx.subcontractorStock.create({ data: { subcontractorId, materialId, quantity: delta } });
  }
}

// Kalemleri kaydeder ve stoğu değiştirir: alışta artar (dir=1), alış iadesinde azalır (dir=-1).
export async function applyPurchaseLines(tx: Tx, companyId: string, purchaseId: string, lines: PurchaseLine[], dir: 1 | -1 = 1) {
  for (const l of lines) {
    await tx.purchaseMaterial.create({
      data: {
        purchaseId,
        productId: l.productId,
        materialId: l.materialId,
        subcontractorId: l.subcontractorId,
        kgAmount: l.qty,
        pricePerKg: l.unitPrice || null,
      },
    });
    const delta = dir * l.qty;
    if (l.productId) {
      await tx.product.updateMany({ where: { id: l.productId, companyId }, data: { stock: { increment: delta } } });
    } else if (l.materialId && l.subcontractorId) {
      await changeSubcontractorStock(tx, l.subcontractorId, l.materialId, delta);
    } else if (l.materialId) {
      await tx.material.updateMany({ where: { id: l.materialId, companyId }, data: { stock: { increment: delta } } });
    }
  }
}

// Alışın (ya da iadenin, dir=-1) mevcut kalemlerinin stok etkisini geri alır ve kalemleri siler.
export async function reversePurchaseLines(tx: Tx, companyId: string, purchaseId: string, dir: 1 | -1 = 1) {
  const existing = await tx.purchaseMaterial.findMany({ where: { purchaseId } });
  for (const pm of existing) {
    const delta = -dir * pm.kgAmount;
    if (pm.productId) {
      await tx.product.updateMany({ where: { id: pm.productId, companyId }, data: { stock: { increment: delta } } });
    } else if (pm.materialId && pm.subcontractorId) {
      await changeSubcontractorStock(tx, pm.subcontractorId, pm.materialId, delta);
    } else if (pm.materialId) {
      await tx.material.updateMany({ where: { id: pm.materialId, companyId }, data: { stock: { increment: delta } } });
    }
  }
  await tx.purchaseMaterial.deleteMany({ where: { purchaseId } });
  return existing.length;
}

export function purchaseStatus(paidAmount: number, total: number) {
  return paidAmount <= 0 ? 'PENDING' : paidAmount < total - 0.005 ? 'PARTIAL' : 'PAID';
}
