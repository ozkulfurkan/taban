import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

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
  const { supplierId, invoiceNo, date, currency, total, notes, items = [] } = body;

  if (!supplierId) return NextResponse.json({ error: 'supplierId required' }, { status: 400 });

  const computedTotal = items.length > 0
    ? items.reduce((s: number, i: any) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)
    : parseFloat(total) || 0;

  if (computedTotal <= 0) return NextResponse.json({ error: 'Invalid total' }, { status: 400 });

  const purchase = await prisma.purchase.create({
    data: {
      companyId: user.companyId,
      supplierId,
      invoiceNo: invoiceNo || null,
      date: new Date(date || Date.now()),
      currency: currency || 'TRY',
      total: computedTotal,
      notes: notes || null,
    },
  });

  // Increase product stock for items that have a productId
  const stockUpdates = items
    .filter((i: any) => i.productId)
    .map((i: any) => {
      const qty = parseFloat(i.qty) || 0;
      return prisma.product.updateMany({
        where: { id: i.productId, companyId: user.companyId },
        data: { stock: { increment: qty } },
      });
    });

  if (stockUpdates.length > 0) {
    await Promise.all(stockUpdates);
  }

  return NextResponse.json(purchase, { status: 201 });
}
