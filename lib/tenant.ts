import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// İstek gövdesinden gelen kimliklerin (müşteri, ürün, fatura...) isteği yapan
// firmaya ait olduğunu doğrular. Başka firmanın kaydına bağlantı kurulmasını engeller.

const MODELS = {
  customer: 'customer',
  supplier: 'supplier',
  product: 'product',
  material: 'material',
  invoice: 'invoice',
  purchase: 'purchase',
  account: 'account',
  payment: 'payment',
  subcontractor: 'subcontractor',
  soleOrder: 'soleOrder',
  employee: 'employee',
  productCategory: 'productCategory',
  customerCategory: 'customerCategory',
  supplierCategory: 'supplierCategory',
} as const;

const LABELS: Record<keyof typeof MODELS, string> = {
  customer: 'Müşteri',
  supplier: 'Tedarikçi',
  product: 'Ürün',
  material: 'Hammadde',
  invoice: 'Fatura',
  purchase: 'Alış',
  account: 'Hesap',
  payment: 'Ödeme',
  subcontractor: 'Fasoncu',
  soleOrder: 'Sipariş',
  employee: 'Personel',
  productCategory: 'Ürün kategorisi',
  customerCategory: 'Müşteri kategorisi',
  supplierCategory: 'Tedarikçi kategorisi',
};

export type RefKind = keyof typeof MODELS;
export type Refs = Partial<Record<RefKind, unknown>>;

function collectIds(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [value];
  const ids = list.filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  return Array.from(new Set(ids));
}

// Geçersiz (başka firmaya ait ya da var olmayan) ilk kimliğin türünü döndürür.
export async function findForeignRef(companyId: string, refs: Refs, db: any = prisma): Promise<RefKind | null> {
  for (const kind of Object.keys(refs) as RefKind[]) {
    const ids = collectIds(refs[kind]);
    if (ids.length === 0) continue;
    const count = await db[MODELS[kind]].count({ where: { id: { in: ids }, companyId } });
    if (count !== ids.length) return kind;
  }
  return null;
}

// Route'larda kullanım:
//   const bad = await rejectForeignRefs(user.companyId, { customer: body.customerId });
//   if (bad) return bad;
export async function rejectForeignRefs(companyId: string, refs: Refs, db: any = prisma) {
  if (!companyId) return NextResponse.json({ error: 'Firma bulunamadı' }, { status: 400 });
  const kind = await findForeignRef(companyId, refs, db);
  if (!kind) return null;
  return NextResponse.json({ error: `${LABELS[kind]} bulunamadı` }, { status: 404 });
}

// Bir nesneden sadece izin verilen alanları alır (toplu atamayı önler).
export function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Partial<T> {
  const out: Record<string, any> = {};
  for (const k of keys) if (obj && Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  return out as Partial<T>;
}
