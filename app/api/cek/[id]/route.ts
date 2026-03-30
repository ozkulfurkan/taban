import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { removeSupplierPayment, ...body } = await req.json();

  if (removeSupplierPayment) {
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

  await prisma.cek.deleteMany({ where: { id: params.id, companyId: user.companyId } });
  return NextResponse.json({ ok: true });
}
