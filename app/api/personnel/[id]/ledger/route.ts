import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const employee = await (prisma.employee as any).findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { date, type, description, debit, credit, account } = body;

  if (!type || (debit == null && credit == null)) {
    return NextResponse.json({ error: 'type ve tutar zorunlu' }, { status: 400 });
  }

  const entry = await (prisma.personnelLedger as any).create({
    data: {
      companyId: user.companyId,
      employeeId: params.id,
      date: date ? new Date(date) : new Date(),
      type,
      description: description || '',
      debit: parseFloat(debit) || 0,
      credit: parseFloat(credit) || 0,
      account: account || null,
      createdBy: user.name || user.email || 'Sistem',
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PersonnelLedger',
    entityId: entry.id,
    detail: `${type} — ${employee.name} — ${parseFloat(debit) || parseFloat(credit)} TL`,
    ip: getIp(req),
  });

  return NextResponse.json(entry, { status: 201 });
}
