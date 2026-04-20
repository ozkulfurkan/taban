import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { logAction, getIp } from '@/lib/audit-logger';

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const employee = await (prisma.employee as any).findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const ledger = await (prisma.personnelLedger as any).findMany({
    where: { employeeId: params.id },
    orderBy: { date: 'asc' },
  });

  return NextResponse.json({ ...employee, ledger });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await (prisma.employee as any).findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { name, department, role, salary, currency, hireDate, payday, phone, email, notes, status } = body;

  const updated = await (prisma.employee as any).update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(department !== undefined && { department }),
      ...(role !== undefined && { role }),
      ...(salary !== undefined && { salary: parseFloat(salary) }),
      ...(currency !== undefined && { currency }),
      ...(hireDate !== undefined && { hireDate: new Date(hireDate) }),
      ...(payday !== undefined && { payday: parseInt(payday) }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(email !== undefined && { email: email || null }),
      ...(notes !== undefined && { notes: notes || null }),
      ...(status !== undefined && { status }),
    },
  });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'UPDATE',
    entity: 'Employee',
    entityId: params.id,
    detail: `Personel güncellendi — ${updated.name}`,
    ip: getIp(req),
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const existing = await (prisma.employee as any).findFirst({
    where: { id: params.id, companyId: user.companyId },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await (prisma.personnelLedger as any).deleteMany({ where: { employeeId: params.id } });
  await (prisma.employee as any).delete({ where: { id: params.id } });

  await logAction({
    companyId: user.companyId,
    userId: user.id,
    userName: user.name,
    action: 'DELETE',
    entity: 'Employee',
    entityId: params.id,
    detail: `Personel silindi — ${existing.name}`,
    ip: getIp(req),
  });

  return NextResponse.json({ ok: true });
}
