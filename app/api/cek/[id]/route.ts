import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { removeSupplierPayment, removePayment, ...body } = await req.json();

  if (removePayment) {
    // Reverting ODENDI → PORTFOY: delete linked payment and restore kasa balance
    const cek = await prisma.cek.findFirst({ where: { id: params.id, companyId: user.companyId } });
    if (cek?.paymentId) {
      const payment = await prisma.payment.findUnique({ where: { id: cek.paymentId } });
      if (payment) {
        await prisma.payment.delete({ where: { id: cek.paymentId } });
        if (payment.accountId) {
          // Reverse RECEIVED: decrement balance
          await prisma.account.update({
            where: { id: payment.accountId },
            data: { balance: { increment: -payment.amount } },
          });
        }
      }
    }
    await prisma.cek.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: { ...body, paymentId: null },
    });
  } else if (removeSupplierPayment) {
    const cek = await prisma.cek.findFirst({
      where: { id: params.id, companyId: user.companyId },
    });
    if (cek?.supplierId) {
      const whereClause: any = {
        supplierId: cek.supplierId,
        companyId: user.companyId,
        method: 'Çek',
        amount: cek.tutar,
      };
      if (cek.seriNo) whereClause.notes = { contains: cek.seriNo };
      const payment = await prisma.payment.findFirst({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
      });
      if (payment) await prisma.payment.delete({ where: { id: payment.id } });
    }
    await prisma.cek.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: { ...body, supplierId: null },
    });
  } else {
    await prisma.cek.updateMany({
      where: { id: params.id, companyId: user.companyId },
      data: body,
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const cek = await prisma.cek.findFirst({
    where: { id: params.id, companyId: user.companyId },
    select: { borclu: true, tutar: true, currency: true, seriNo: true },
  });
  await prisma.cek.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  if (cek) {
    await logAction({
      companyId: user.companyId,
      userId: user.id,
      userName: user.name,
      action: 'DELETE',
      entity: 'Cek',
      entityId: params.id,
      detail: `Çek silindi — ${cek.borclu} ${cek.tutar} ${cek.currency}`,
      meta: { tutar: cek.tutar, currency: cek.currency, seriNo: cek.seriNo },
      ip: getIp(req),
    });
  }
  return NextResponse.json({ ok: true });
}
