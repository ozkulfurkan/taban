export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { invoiceId } = await req.json();
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId gerekli' }, { status: 400 });

  const existing = await prisma.soleOrder.findFirst({ where: { id: params.id, companyId: user.companyId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (existing.status === 'CANCELLED') return NextResponse.json({ error: 'İptal edilmiş sipariş satışa çevrilemez' }, { status: 400 });
  if (existing.invoiceId) return NextResponse.json({ error: 'Sipariş zaten satışa çevrildi' }, { status: 409 });
  // Sevk fişiyle cari hesaba işlenmiş sevkiyatı olan sipariş ikinci kez faturalanmaz
  if (await prisma.orderShipment.count({ where: { orderId: params.id, invoiceId: { not: null } } })) {
    return NextResponse.json({ error: 'Bu siparişin sevkiyatı sevk fişiyle cari hesaba işlendi; ayrıca satışa çevrilemez' }, { status: 409 });
  }

  // Fatura aynı firmaya ve siparişin müşterisine ait olmalı; başka siparişe bağlı olmamalı
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: user.companyId } });
  if (!invoice) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 });
  if (invoice.customerId !== existing.customerId) return NextResponse.json({ error: 'Fatura bu siparişin müşterisine ait değil' }, { status: 400 });

  // Aynı anda iki çevirme gelirse yalnızca biri geçer
  const claimed = await prisma.soleOrder.updateMany({ where: { id: params.id, invoiceId: null }, data: { invoiceId, convertedAt: new Date() } });
  if (!claimed.count) return NextResponse.json({ error: 'Sipariş zaten satışa çevrildi' }, { status: 409 });
  await prisma.orderStatusHistory.create({ data: { orderId: params.id, status: existing.status, note: `Satışa çevrildi — Fatura: ${invoice.invoiceNo}` } });
  const order = await prisma.soleOrder.findUnique({ where: { id: params.id } });

  return NextResponse.json({ ok: true, order });
}
