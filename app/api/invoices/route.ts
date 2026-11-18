import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { nowUtc, parseDateInput } from '@/lib/time';
import { logAction, getIp } from '@/lib/audit-logger';
import { rejectForeignRefs } from '@/lib/tenant';
import { validateInvoiceInput } from '@/lib/invoice-input';
import { nextDocumentNumber, documentYear } from '@/lib/doc-number';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const invoices = await prisma.invoice.findMany({
    where: {
      companyId: user.companyId,
      ...(status ? { status: status as any } : {}),
    },
    include: {
      customer: { select: { id: true, name: true } },
      items: true,
      createdBy: { select: { name: true } },
      soleOrder: { select: { orderNo: true } },
    },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { items = [], isReturn = false, ...rest } = body;

  if (!rest.customerId) return NextResponse.json({ error: 'Müşteri seçilmedi' }, { status: 400 });
  const foreign = await rejectForeignRefs(user.companyId, {
    customer: rest.customerId,
    product: (items as any[]).map(i => i?.productId),
  });
  if (foreign) return foreign;

  // Para birimi doğrulama: müşteri para birimiyle eşleşmeli
  if (rest.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: rest.customerId, companyId: user.companyId },
      select: { currency: true },
    });
    if (customer && rest.currency && customer.currency !== rest.currency) {
      return NextResponse.json(
        { error: `Para birimi uyumsuz. Müşteri para birimi: ${customer.currency}` },
        { status: 400 }
      );
    }
    // Müşteri para birimini kullan
    if (customer?.currency) rest.currency = customer.currency;
  }

  const input = validateInvoiceInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
  const { lines, vatRate, subtotal, vatAmount, total } = input;
  const invoiceDate = parseDateInput(rest.date) ?? nowUtc();
  // Yıl fatura tarihinden alınır (2027 tarihli fatura FTR-2027- ile başlar)
  const ftrPrefix = `${isReturn ? 'IAD' : 'FTR'}-${documentYear(invoiceDate)}-`;
  const manualNo = typeof rest.invoiceNo === 'string' && rest.invoiceNo.trim() ? rest.invoiceNo.trim() : null;
  if (manualNo && await prisma.invoice.findFirst({ where: { companyId: user.companyId, invoiceNo: manualNo }, select: { id: true } })) {
    return NextResponse.json({ error: `${manualNo} numaralı fatura zaten var` }, { status: 409 });
  }

  try {
  const invoice = await prisma.$transaction(async (tx) => {
    const resolvedInvoiceNo = manualNo ?? await nextDocumentNumber('invoice', user.companyId, ftrPrefix, { db: tx });
    return tx.invoice.create({
    data: {
      companyId: user.companyId,
      customerId: rest.customerId,
      invoiceNo: resolvedInvoiceNo,
      date: invoiceDate,
      dueDate: rest.dueDate ? parseDateInput(rest.dueDate) : null,
      currency: rest.currency || 'USD',
      // Tutarlar iade faturasında da pozitif saklanır; yönü isReturn belirler
      subtotal,
      vatRate,
      vatAmount,
      total,
      paidAmount: 0,
      status: 'PENDING',
      isReturn,
      notes: rest.notes || null,
      createdById: user.id || null,
      items: { create: lines },
    },
    include: { items: true, customer: true },
    });
  });

  // Ürün stoğunu güncelle (product.stock)
  const productItems = lines.filter((i): i is typeof i & { productId: string } => !!i.productId);
  const stockUpdates = productItems.map((i: any) => {
    const qty = i.quantity;
    const delta = isReturn ? qty : -qty;
    return prisma.product.updateMany({
      where: { id: i.productId, companyId: user.companyId },
      data: { stock: { increment: delta } },
    });
  });
  if (stockUpdates.length > 0) await Promise.all(stockUpdates);

  // Otomatik hammadde stoğu düşümü (sadece SOLE_MANUFACTURER satış faturalarında)
  const company = await prisma.company.findUnique({ where: { id: user.companyId }, select: { companyType: true } });
  if (productItems.length > 0 && !isReturn && company?.companyType !== 'MATERIAL_SUPPLIER') {
    const ids: string[] = [];

for (let i = 0; i < productItems.length; i++) {
  const id = productItems[i].productId;
  if (ids.indexOf(id) === -1) {
    ids.push(id);
  }
}

const uniqueProductIds = ids;
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds as string[] }, companyId: user.companyId },
      include: { parts: true },
    });

    // Hammadde bazında kg kullanımını topla
    const materialMap = new Map<string, number>();  // materialId -> kgAmount

    for (const item of productItems) {
      const qty = item.quantity;
      const product = products.find((p: any) => p.id === item.productId);
      if (!product) continue;

      const partVariants: Array<{ partId: string; materialId: string }> =
        Array.isArray(item.partVariantsData) ? (item.partVariantsData as any) : [];

      for (const part of product.parts) {
        const matId = partVariants.find(pv => pv.partId === part.id)?.materialId ?? part.materialId;
        if (!matId) continue;
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * qty) / 1000;
        materialMap.set(matId, (materialMap.get(matId) || 0) + kgUsed);
      }
    }

    const totalUpdates: Promise<any>[] = [];

    Array.from(materialMap.entries()).forEach(([materialId, kgAmount]) => {
      totalUpdates.push(
        prisma.material.updateMany({
          where: { id: materialId, companyId: user.companyId },
          data: { stock: { decrement: kgAmount } },
        })
      );
    });

    if (totalUpdates.length > 0) {
      totalUpdates.push(
        prisma.invoice.update({ where: { id: invoice.id }, data: { stockDeducted: true } })
      );
      await Promise.all(totalUpdates);
    }
  }

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: isReturn ? 'ReturnInvoice' : 'Invoice',
    entityId: invoice.id,
    detail: `${isReturn ? 'İade faturası' : 'Fatura'} oluşturuldu — ${invoice.invoiceNo}`,
    meta: { total: invoice.total, currency: invoice.currency },
    ip: getIp(req),
  });
  // Stok eksiye düşebilir (satış engellenmez) ama kullanıcı uyarılır
  const negativeStock = productItems.length && !isReturn
    ? await prisma.product.findMany({
        where: { id: { in: productItems.map(i => i.productId) }, companyId: user.companyId, stock: { lt: 0 } },
        select: { id: true, name: true, code: true, stock: true, unit: true },
      })
    : [];
  return NextResponse.json({ ...invoice, stockWarnings: negativeStock });
  } catch (err: any) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'ERROR',
      entity: isReturn ? 'ReturnInvoice' : 'Invoice',
      detail: `${isReturn ? 'İade faturası' : 'Fatura'} oluşturulamadı: ${err?.message ?? 'Bilinmeyen hata'}`,
      ip: getIp(req),
    });
    return NextResponse.json({ error: 'Fatura oluşturulamadı' }, { status: 500 });
  }
}
