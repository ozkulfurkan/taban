import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInput, parseDateInputOrNow } from '@/lib/time';
import { parseAmount, round2 } from '@/lib/money';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';
import { nextDocumentNumber, documentYear } from '@/lib/doc-number';
import { validatePurchaseLines, applyPurchaseLines, type PurchaseLine } from '@/lib/purchase-lines';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const purchases = await prisma.purchase.findMany({
    where: { companyId: user.companyId },
    include: {
      supplier: { select: { id: true, name: true } },
      purchaseMaterials: {
        include: {
          material: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, code: true } },
          subcontractor: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { supplierId, invoiceNo, date, total, notes, items = [] } = body;
  const isReturn = body.isReturn === true; // tedarikçiye mal iadesi
  const foreign = await rejectForeignRefs(user.companyId, {
    supplier: supplierId,
    product: (items as any[]).map(i => i?.productId),
    material: (items as any[]).map(i => i?.materialId),
    subcontractor: (items as any[]).map(i => i?.subcontractorId),
  });
  if (foreign) return foreign;
  let { currency } = body;

  if (!supplierId) return NextResponse.json({ error: 'supplierId required' }, { status: 400 });

  // Para birimi doğrulama: tedarikçi para birimiyle eşleşmeli
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, companyId: user.companyId },
    select: { currency: true },
  });
  if (supplier?.currency) {
    if (currency && currency !== supplier.currency) {
      return NextResponse.json(
        { error: `Para birimi uyumsuz. Tedarikçi para birimi: ${supplier.currency}` },
        { status: 400 }
      );
    }
    currency = supplier.currency;
  }

  // Kalemli alış: toplam kalemlerden hesaplanır. Kalemsiz (eski kullanım) sadece toplam.
  let lines: PurchaseLine[] = [];
  let computedTotal: number;
  if (Array.isArray(items) && items.length > 0) {
    const v = validatePurchaseLines(items);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
    lines = v.lines;
    computedTotal = v.total;
  } else if (isReturn) {
    return NextResponse.json({ error: 'İade için en az bir kalem girin' }, { status: 400 });
  } else {
    const n = parseAmount(total);
    computedTotal = round2(Number.isFinite(n) ? n : 0);
  }
  if (!(computedTotal > 0)) return NextResponse.json({ error: 'Alış toplamı 0 olamaz' }, { status: 400 });

  // Alış ALF-, alış iadesi ALI- ile numaralanır
  const alfPrefix = `${isReturn ? 'ALI' : 'ALF'}-${documentYear(parseDateInput(date) ?? new Date())}-`;
  const manualNo = typeof invoiceNo === 'string' && invoiceNo.trim() ? invoiceNo.trim() : null;
  if (manualNo && await prisma.purchase.findFirst({ where: { companyId: user.companyId, invoiceNo: manualNo }, select: { id: true } })) {
    return NextResponse.json({ error: `${manualNo} numaralı alış zaten var` }, { status: 409 });
  }

  try {
  const purchase = await prisma.$transaction(async (tx) => {
    const resolvedInvoiceNo = manualNo ?? await nextDocumentNumber('purchase', user.companyId, alfPrefix, { db: tx });
    const created = await tx.purchase.create({
      data: {
        companyId: user.companyId,
        supplierId,
        invoiceNo: resolvedInvoiceNo,
        date: parseDateInputOrNow(date),
        currency: currency || 'TRY',
        total: computedTotal,
        notes: notes || null,
        isReturn,
      },
    });
    // Kalemler ve stok değişimi aynı işlemde: biri başarısız olursa alış da oluşmaz
    await applyPurchaseLines(tx, user.companyId, created.id, lines, isReturn ? -1 : 1);
    return created;
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'Purchase',
    entityId: purchase.id,
    detail: `${isReturn ? 'Alış iadesi' : 'Alış'} kaydedildi — ${purchase.invoiceNo ?? purchase.id} ${computedTotal} ${purchase.currency}`,
    meta: { total: computedTotal, currency: purchase.currency },
    ip: getIp(req),
  });
  // İade stoğu eksiye düşürebilir (engellenmez) ama kullanıcı uyarılır
  let stockWarnings: any[] = [];
  if (isReturn) {
    const pIds = lines.map(l => l.productId).filter(Boolean) as string[];
    const mIds = lines.filter(l => l.materialId && !l.subcontractorId).map(l => l.materialId) as string[];
    const [ps, ms] = await Promise.all([
      pIds.length ? prisma.product.findMany({ where: { id: { in: pIds }, companyId: user.companyId, stock: { lt: 0 } }, select: { id: true, name: true, stock: true, unit: true } }) : [],
      mIds.length ? prisma.material.findMany({ where: { id: { in: mIds }, companyId: user.companyId, stock: { lt: 0 } }, select: { id: true, name: true, stock: true } }) : [],
    ]);
    stockWarnings = [...ps, ...ms.map(m => ({ ...m, unit: 'kg' }))];
  }
  return NextResponse.json({ ...purchase, stockWarnings }, { status: 201 });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: 'Purchase',
      detail: `Alış kaydedilemedi: ${err?.message ?? 'Bilinmeyen hata'}`,
      meta: { supplierId, invoiceNo },
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Alış kaydedilemedi' }, { status: 500 });
  }
}
