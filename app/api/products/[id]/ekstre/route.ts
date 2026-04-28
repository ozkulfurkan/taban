import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const product = await prisma.product.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: { id: true, name: true, stock: true, unit: true, currency: true },
  });
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Purchases
  const purchaseItems = await (prisma.purchaseMaterial as any).findMany({
    where: { productId: params.id, purchase: { companyId: user.companyId } },
    include: { purchase: { select: { date: true, invoiceNo: true, supplier: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  // Sales
  const salesItems = await prisma.invoiceItem.findMany({
    where: { productId: params.id, invoice: { companyId: user.companyId, isReturn: false } },
    include: { invoice: { include: { customer: { select: { id: true, name: true } } } } },
    orderBy: { invoice: { date: 'desc' } },
  });

  // Returns
  const returnItems = await prisma.invoiceItem.findMany({
    where: { productId: params.id, invoice: { companyId: user.companyId, isReturn: true } },
    include: { invoice: { include: { customer: { select: { id: true, name: true } } } } },
    orderBy: { invoice: { date: 'desc' } },
  });

  type Entry = {
    id: string;
    date: Date;
    type: 'satis' | 'iade' | 'alis';
    party: string;
    invoiceNo: string | null;
    qty: number;
    unitPrice: number;
    currency: string;
  };

  const entries: Entry[] = [];

  for (const pm of purchaseItems) {
    entries.push({
      id: `pur-${pm.id}`,
      date: pm.purchase.date,
      type: 'alis',
      party: pm.purchase.supplier?.name ?? '—',
      invoiceNo: pm.purchase.invoiceNo,
      qty: pm.kgAmount,
      unitPrice: pm.pricePerKg ?? 0,
      currency: 'USD',
    });
  }

  for (const ii of salesItems) {
    entries.push({
      id: ii.id,
      date: (ii as any).invoice.date,
      type: 'satis',
      party: (ii as any).invoice.customer?.name ?? '—',
      invoiceNo: (ii as any).invoice.invoiceNo,
      qty: -ii.quantity,
      unitPrice: ii.unitPrice,
      currency: (ii as any).invoice.currency,
    });
  }

  for (const ii of returnItems) {
    entries.push({
      id: `ret-${ii.id}`,
      date: (ii as any).invoice.date,
      type: 'iade',
      party: (ii as any).invoice.customer?.name ?? '—',
      invoiceNo: (ii as any).invoice.invoiceNo,
      qty: ii.quantity,
      unitPrice: ii.unitPrice,
      currency: (ii as any).invoice.currency,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ product, entries });
}
