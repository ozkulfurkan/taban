import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { nowUtc, parseDateInput } from '@/lib/time';

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
            partVariantsData: Array.isArray(i.partVariants) && i.partVariants.length > 0
              ? i.partVariants
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

  // Otomatik hammadde stoğu düşümü (sadece satış faturalarında)
  if (productItems.length > 0 && !isReturn) {
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

      for (const part of product.parts) {
        if (!part.materialId) continue;
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * qty) / 1000;
        materialMap.set(part.materialId, (materialMap.get(part.materialId) || 0) + kgUsed);
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

  return NextResponse.json(invoice);
}
