import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const calculation = await prisma.materialCalculation.findFirst({
    where: { id: params.id, companyId: user.companyId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!calculation) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });
  return NextResponse.json(calculation);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.materialCalculation.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  const body = await req.json();
  const { name, notes, kurUsd, kurEur, kdvRate, laborPerKg, laborCur, items } = body;

  await prisma.materialCalculationItem.deleteMany({ where: { calculationId: params.id } });

  const calculation = await prisma.materialCalculation.update({
    where: { id: params.id },
    data: {
      name: name?.trim() || existing.name,
      notes: notes || null,
      kurUsd: parseFloat(kurUsd) || 0,
      kurEur: parseFloat(kurEur) || 0,
      kdvRate: parseFloat(kdvRate) || 0.20,
      laborPerKg: parseFloat(laborPerKg) || 0,
      laborCur: laborCur || 'TRY',
      items: {
        create: (items || []).map((item: any, idx: number) => ({
          name: item.name || '',
          qty: parseFloat(item.qty) || 0,
          currency: item.currency || 'TRY',
          unitPriceExVat: parseFloat(item.unitPriceExVat) || 0,
          sortOrder: idx,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  });

  return NextResponse.json(calculation);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const existing = await prisma.materialCalculation.findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  await prisma.materialCalculation.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
