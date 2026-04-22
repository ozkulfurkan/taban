import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const calculations = await prisma.materialCalculation.findMany({
    where: { companyId: user.companyId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(calculations);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, notes, kurUsd, kurEur, kdvRate, laborPerKg, laborCur, items } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Ad zorunludur' }, { status: 400 });

  const calculation = await prisma.materialCalculation.create({
    data: {
      companyId: user.companyId,
      name: name.trim(),
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

  return NextResponse.json(calculation, { status: 201 });
}
