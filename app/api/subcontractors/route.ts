import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const subcontractors = await prisma.subcontractor.findMany({
    where: { companyId: user.companyId, isActive: true },
    select: { id: true, name: true, contactPerson: true, phone: true, email: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(subcontractors);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role === 'VIEWER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { name, contactPerson, phone, address, email } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'İsim zorunlu' }, { status: 400 });

  const subcontractor = await prisma.subcontractor.create({
    data: {
      companyId: user.companyId,
      name: name.trim(),
      contactPerson: contactPerson?.trim() || null,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      email: email?.trim() || null,
    },
  });

  return NextResponse.json(subcontractor, { status: 201 });
}
