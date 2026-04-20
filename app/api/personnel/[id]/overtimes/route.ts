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
    const overtimes = await (prisma.personnelOvertime as any).findMany({
      where: { employeeId: params.id, companyId: user.companyId },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json(overtimes);
  } catch (err: any) {
    console.error('[GET /api/personnel/:id/overtimes]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'DB hatası' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { date, hours, amount, note } = body;
  if (!date || !hours) return NextResponse.json({ error: 'Zorunlu alan eksik' }, { status: 400 });

  try {
    const ot = await (prisma.personnelOvertime as any).create({
      data: {
        companyId: user.companyId,
        employeeId: params.id,
        date: new Date(date),
        hours: parseFloat(hours) || 0,
        amount: parseFloat(amount) || 0,
        note: note || null,
        createdBy: user.name || user.email || 'Sistem',
      },
    });
    return NextResponse.json(ot, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/personnel/:id/overtimes]', err?.message);
    return NextResponse.json({ error: err?.message ?? 'DB hatası' }, { status: 500 });
  }
}
