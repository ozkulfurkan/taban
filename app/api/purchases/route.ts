import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInputOrNow } from '@/lib/time';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const purchases = await prisma.purchase.findMany({
    where: { companyId: user.companyId },
    include: { supplier: { select: { id: true, name: true } } },
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

  const parseNum = (v: any) => parseFloat(String(v ?? '').replace(',', '.')) || 0;

  const computedTotal = items.length > 0
    ? items.reduce((s: number, i: any) => s + parseNum(i.qty) * parseNum(i.unitPrice), 0)
    : parseNum(total);

  if (computedTotal <= 0) return NextResponse.json({ error: 'Invalid total' }, { status: 400 });

  const purchase = await prisma.purchase.create({
    data: {
      companyId: user.companyId,
      supplierId,
      invoiceNo: invoiceNo || null,
      date: parseDateInputOrNow(date),
      currency: currency || 'TRY',
      total: computedTotal,
      notes: notes || null,
    },
  });

  // Handle items: update product/material stock and create PurchaseMaterial records
  const ops: Promise<any>[] = [];

  for (const i of items) {
    const qty = parseNum(i.qty);
    const unitPrice = parseNum(i.unitPrice);

    if (i.productId) {
      ops.push(prisma.product.updateMany({
        where: { id: i.productId, companyId: user.companyId },
        data: { stock: { increment: qty } },
      }));
    }

    if (i.materialId) {
      ops.push(prisma.purchaseMaterial.create({
        data: {
          purchaseId: purchase.id,
          materialId: i.materialId,
          subcontractorId: i.subcontractorId || null,
          kgAmount: qty,
          pricePerKg: unitPrice || null,
        },
      }));

      if (i.subcontractorId) {
        // Fasoncu deposuna yönlendir: SubcontractorStock upsert
        ops.push(
          prisma.subcontractorStock.findFirst({
            where: { subcontractorId: i.subcontractorId, materialId: i.materialId },
          }).then(existing => {
            if (existing) {
              return prisma.subcontractorStock.update({
                where: { id: existing.id },
                data: { quantity: { increment: qty } },
              });
            }
            return prisma.subcontractorStock.create({
              data: { subcontractorId: i.subcontractorId, materialId: i.materialId, quantity: qty },
            });
          })
        );
      } else {
        ops.push(prisma.material.updateMany({
          where: { id: i.materialId, companyId: user.companyId },
          data: { stock: { increment: qty } },
        }));
      }
    }
  }

  if (ops.length > 0) {
    await Promise.all(ops);
  }

  return NextResponse.json(purchase, { status: 201 });
}
