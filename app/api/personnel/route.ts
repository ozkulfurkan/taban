import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json([]);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const employees = await (prisma.employee as any).findMany({
    where: {
      companyId: user.companyId,
      ...(status ? { status } : {}),
    },
    orderBy: { name: 'asc' },
  });

  // Her çalışan için bakiyeyi hesapla
  const ids = employees.map((e: any) => e.id);
  const ledgerTotals = ids.length > 0
    ? await (prisma.personnelLedger as any).groupBy({
        by: ['employeeId'],
        where: { employeeId: { in: ids } },
        _sum: { credit: true, debit: true },
      })
    : [];

  const lastPayments = ids.length > 0
    ? await (prisma.personnelLedger as any).findMany({
        where: { employeeId: { in: ids }, type: 'Maaş' },
        orderBy: { date: 'desc' },
        distinct: ['employeeId'],
        select: { employeeId: true, date: true },
      })
    : [];

  const balanceMap = new Map<string, number>();
  for (const t of ledgerTotals) {
    balanceMap.set(t.employeeId, (t._sum.credit ?? 0) - (t._sum.debit ?? 0));
  }
  const lastPayMap = new Map<string, string>();
  for (const p of lastPayments) {
    lastPayMap.set(p.employeeId, p.date);
  }

  const result = employees.map((e: any) => ({
    ...e,
    balance: balanceMap.get(e.id) ?? 0,
    lastPaymentDate: lastPayMap.get(e.id) ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const body = await req.json();
  const { name, department, role, salary, currency, hireDate, payday, phone, email, notes } = body;

  if (!name || !department || !role) {
    return NextResponse.json({ error: 'name, department, role zorunlu' }, { status: 400 });
  }

  const employee = await (prisma.employee as any).create({
    data: {
      companyId: user.companyId,
      name,
      department,
      role,
      salary: parseFloat(salary) || 0,
      currency: currency || 'TRY',
      status: 'active',
      hireDate: hireDate ? new Date(hireDate) : new Date(),
      payday: parseInt(payday) || 1,
      leaveBalance: 14,
      phone: phone || null,
      email: email || null,
      notes: notes || null,
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'CREATE',
    entity: 'Employee',
    entityId: employee.id,
    detail: `Personel oluşturuldu — ${employee.name}`,
    ip: getIp(req),
  });

  return NextResponse.json(employee, { status: 201 });
}
