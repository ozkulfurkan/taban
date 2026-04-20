import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  try {
    const leaves = await (prisma.personnelLeave as any).findMany({
      where: { employeeId: params.id, companyId: user.companyId },
      orderBy: { startDate: 'desc' },
    });
    return NextResponse.json(leaves);
  } catch (err: any) {
    console.error('[GET /api/personnel/:id/leaves]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'DB hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { startDate, endDate, type, days, note } = body;
  if (!startDate || !endDate || !type) return NextResponse.json({ error: 'Zorunlu alan eksik' }, { status: 400 });

  try {
    const leave = await (prisma.personnelLeave as any).create({
      data: {
        companyId: user.companyId,
        employeeId: params.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        type,
        days: parseFloat(days) || 0,
        note: note || null,
        createdBy: user.name || user.email || 'Sistem',
      },
    });

    // kalan izin güncelle
    await (prisma.employee as any).update({
      where: { id: params.id },
      data: { leaveBalance: { increment: -(parseFloat(days) || 0) } },
    });

    return NextResponse.json(leave, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/personnel/:id/leaves]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'DB hatası' }, { status: 500 });
  }
}
