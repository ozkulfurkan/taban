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

  // Verify invoice belongs to same company
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId: user.companyId } });
  if (!invoice) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 });

  const order = await prisma.soleOrder.update({
    where: { id: params.id },
    data: {
      invoiceId,
      convertedAt: new Date(),
      statusHistory: {
        create: { status: existing.status, note: `Satışa çevrildi — Fatura: ${invoice.invoiceNo}` },
      },
    },
  });

  return NextResponse.json({ ok: true, order });
}
