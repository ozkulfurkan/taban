import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || user?.portalType !== 'SUBCONTRACTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const subcontractorId = user.subcontractorId;
  if (!subcontractorId) return NextResponse.json({ error: 'Fasoncu bulunamadı' }, { status: 404 });

  const [transfers, adjustments, stocks] = await Promise.all([
    prisma.materialTransfer.findMany({
      where: { subcontractorId, companyId: user.companyId },
      orderBy: { transferDate: 'desc' },
      include: { material: { select: { id: true, name: true } } },
    }),
    prisma.stockAdjustment.findMany({
      where: { subcontractorId, companyId: user.companyId },
      orderBy: { createdAt: 'desc' },
      include: { material: { select: { id: true, name: true } } },
    }),
    prisma.subcontractorStock.findMany({
      where: { subcontractorId },
      include: { material: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  type Entry = {
    id: string;
    date: Date;
    type: string;
    materialId: string;
    materialName: string;
    kgAmount: number;
    notes: string | null;
  };

  const entries: Entry[] = [];

  for (const t of transfers) {
    entries.push({
      id: `tr-${t.id}`,
      date: t.transferDate,
      type: t.direction === 'OUTGOING' ? 'gelen' : 'iade',
      materialId: t.materialId,
      materialName: (t as any).material?.name ?? '—',
      kgAmount: t.direction === 'OUTGOING' ? t.quantity : -t.quantity,
      notes: t.notes,
    });
  }

  for (const a of adjustments) {
    entries.push({
      id: `adj-${a.id}`,
      date: a.createdAt,
      type: a.type,
      materialId: a.materialId,
      materialName: (a as any).material?.name ?? '—',
      kgAmount: a.delta,
      notes: a.notes,
    });
  }

  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ stocks, entries });
}
