import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

type Params = { params: { id: string } };

// Kasa bakiyesini düşen tipler (nakit çıkışı var)
const CASH_OUT_TYPES = ['Maaş', 'Avans'];

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
  const { date, type, description, debit, credit, account, accountId } = body;

  if (!type || (debit == null && credit == null)) {
    return NextResponse.json({ error: 'type ve tutar zorunlu' }, { status: 400 });
  }

  const creditAmt = parseFloat(credit) || 0;
  const debitAmt = parseFloat(debit) || 0;

  const entry = await (prisma.personnelLedger as any).create({
    data: {
      companyId: user.companyId,
      employeeId: params.id,
      date: date ? new Date(date) : new Date(),
      type,
      description: description || '',
      debit: debitAmt,
      credit: creditAmt,
      account: account || null,
      createdBy: user.name || user.email || 'Sistem',
    },
  });

  // Kasa bakiyesini düş (Maaş / Avans için nakit çıkışı)
  if (CASH_OUT_TYPES.includes(type) && accountId && creditAmt > 0) {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: -creditAmt } },
    });
  }

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'PersonnelLedger',
    entityId: entry.id,
    detail: `${type} — ${employee.name} — ${creditAmt || debitAmt} TL`,
    ip: getIp(req),
  });

  return NextResponse.json(entry, { status: 201 });
}
