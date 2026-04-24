import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { nowUtc, parseDateInput } from '@/lib/time';
import { logAction, getIp } from '@/lib/audit-logger';

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

  const parseNum = (v: any) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
  const sign = isReturn ? -1 : 1;

  const subtotal = sign * items.reduce((s: number, i: any) => {
    const qty = parseNum(i.quantity);
    const price = parseNum(i.unitPrice);
    const disc = parseNum(i.discount);
    return s + qty * price * (1 - disc / 100);
  }, 0);
  const vatRate = parseNum(rest.vatRate);
  const vatAmount = subtotal * vatRate / 100;
  const total = subtotal + vatAmount;

  const now = new Date();
  const prefix = isReturn ? 'IAD' : 'FTR';
  const invoiceNo = rest.invoiceNo || `${prefix}-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${Math.floor(Math.random()*9000)+1000}`;

  try {
  const invoice = await prisma.invoice.create({
    data: {
      companyId: user.companyId,
      customerId: rest.customerId,
      invoiceNo,
      date: parseDateInput(rest.date) ?? nowUtc(),
      dueDate: rest.dueDate ? parseDateInput(rest.dueDate) : null,
      currency: rest.currency || 'USD',
      subtotal,
      vatRate,
      vatAmount,
      total,
      paidAmount: 0,
      status: 'PENDING',
      isReturn,
      notes: rest.notes || null,
      createdById: user.id || null,
      items: {
        create: items.map((i: any) => {
          const qty = parseNum(i.quantity);
          const price = parseNum(i.unitPrice);
          const disc = parseNum(i.discount);
          return {
            description: i.description,
            productId: i.productId || null,
            quantity: qty,
            unitPrice: price,
            discount: disc,
            total: sign * qty * price * (1 - disc / 100),
            notes: i.notes || null,
            partVariantsData: Array.isArray(i.partVariantsData) && i.partVariantsData.length > 0
              ? i.partVariantsData
              : undefined,
          };
        }),
      },
    },
    include: { items: true, customer: true },
  });

  // Ürün stoğunu güncelle (product.stock)
  const productItems = items.filter((i: any) => i.productId);
  const stockUpdates = productItems.map((i: any) => {
    const qty = parseNum(i.quantity);
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
      const qty = parseNum(item.quantity);
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
  return NextResponse.json(invoice);
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
