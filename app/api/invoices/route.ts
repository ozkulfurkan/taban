import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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

  const sign = isReturn ? -1 : 1;

  const subtotal = sign * items.reduce((s: number, i: any) => {
    const qty = parseFloat(i.quantity) || 0;
    const price = parseFloat(i.unitPrice) || 0;
    const disc = parseFloat(i.discount) || 0;
    return s + qty * price * (1 - disc / 100);
  }, 0);
  const vatRate = parseFloat(rest.vatRate) || 0;
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
      date: new Date(rest.date || now),
      dueDate: rest.dueDate ? new Date(rest.dueDate) : null,
      currency: rest.currency || 'USD',
      subtotal,
      vatRate,
      vatAmount,
      total,
      paidAmount: 0,
      status: 'PENDING',
      isReturn,
      notes: rest.notes || null,
      items: {
        create: items.map((i: any) => {
          const qty = parseFloat(i.quantity) || 0;
          const price = parseFloat(i.unitPrice) || 0;
          const disc = parseFloat(i.discount) || 0;
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
    const qty = parseFloat(i.quantity) || 0;
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

    // Hammadde ve varyant bazında kg kullanımını topla
    const materialMap = new Map<string, number>();  // materialId -> kgAmount
    const variantMap = new Map<string, number>();   // variantId -> kgAmount

    for (const item of productItems) {
      const qty = parseFloat(item.quantity) || 0;
      const product = products.find((p: any) => p.id === item.productId);
      if (!product) continue;

      // Build partId -> variantId map from sale-time selections
      const pvMap: Record<string, string> = {};
      if (Array.isArray(item.partVariants)) {
        item.partVariants.forEach((pv: any) => { pvMap[pv.partId] = pv.variantId; });
      }

      for (const part of product.parts) {
        const grossGrams = part.gramsPerPiece * (1 + part.wasteRate / 100);
        const kgUsed = (grossGrams * qty) / 1000;

        const selectedVariantId = pvMap[part.id];
        if (selectedVariantId) {
          variantMap.set(selectedVariantId, (variantMap.get(selectedVariantId) || 0) + kgUsed);
        } else if (part.materialVariantId) {
          variantMap.set(part.materialVariantId, (variantMap.get(part.materialVariantId) || 0) + kgUsed);
        } else if (part.materialId) {
          materialMap.set(part.materialId, (materialMap.get(part.materialId) || 0) + kgUsed);
        }
      }
    }

    const totalUpdates: Promise<any>[] = [];

    // Deduct from Material.stock (parts without variant)
    Array.from(materialMap.entries()).forEach(([materialId, kgAmount]) => {
      totalUpdates.push(
        prisma.material.updateMany({
          where: { id: materialId, companyId: user.companyId },
          data: { stock: { decrement: kgAmount } },
        })
      );
    });

    // Deduct from MaterialVariant.stock (parts with variant)
    Array.from(variantMap.entries()).forEach(([variantId, kgAmount]) => {
      totalUpdates.push(
        prisma.materialVariant.updateMany({
          where: { id: variantId },
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
