import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { parseDateInput, parseDateEndOfDay } from '@/lib/time';

const LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ logs: [], total: 0, page: 1, pages: 0 });

  // Sadece admin ve company_owner görebilir
  if (user.role !== 'ADMIN' && user.role !== 'COMPANY_OWNER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const entity = searchParams.get('entity') ?? '';
  const action = searchParams.get('action') ?? '';
  const fromStr = searchParams.get('from');
  const toStr = searchParams.get('to');

  const where: any = { companyId: user.companyId };
  if (entity) where.entity = entity;
  if (action) where.action = action;
  if (fromStr || toStr) {
    where.createdAt = {};
    if (fromStr) where.createdAt.gte = parseDateInput(fromStr) ?? undefined;
    if (toStr) where.createdAt.lte = parseDateEndOfDay(toStr) ?? undefined;
  }

  const [logs, total] = await Promise.all([
    (prisma.auditLog as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * LIMIT,
      take: LIMIT,
    }),
    (prisma.auditLog as any).count({ where }),
  ]);

  return NextResponse.json({ logs, total, page, pages: Math.ceil(total / LIMIT) });
}
