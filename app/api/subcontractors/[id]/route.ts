import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: {
      materialStocks: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
      },
      subcontractorOrders: {
        where: { status: { notIn: ['RECEIVED', 'CANCELLED'] } },
        include: { product: { select: { id: true, name: true, code: true } } },
        orderBy: { createdAt: 'desc' },
      },
      materialTransfers: {
        include: {
          material: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      portalCustomer: { select: { id: true, email: true, isActive: true, emailVerified: true } },
    },
  });

  if (!subcontractor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(subcontractor);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, contactPerson, phone, address, email, isActive } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });

  const updated = await prisma.subcontractor.updateMany({
    where: { id: params.id, companyId: user.companyId },
    data: {
      name: name.trim(),
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      email: email?.trim() || null,
      isActive: isActive ?? true,
    },
  });

  if (updated.count === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const subcontractor = await prisma.subcontractor.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  return NextResponse.json(subcontractor);
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!['ADMIN', 'COMPANY_OWNER'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const activeOrders = await prisma.subcontractorOrder.count({
    where: {
      subcontractorId: params.id,
      companyId: user.companyId,
      status: { notIn: ['RECEIVED', 'CANCELLED'] },
    },
  });
  if (activeOrders > 0) {
    return NextResponse.json({ error: 'Aktif siparişler var, önce tamamlayın' }, { status: 400 });
  }

  await prisma.subcontractor.deleteMany({
    where: { id: params.id, companyId: user.companyId },
  });
  return NextResponse.json({ ok: true });
}
