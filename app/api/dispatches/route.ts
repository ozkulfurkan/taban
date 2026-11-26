export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { duplicateGuarded } from '@/lib/request-dedup';
import { createDispatch } from '@/lib/dispatch';
import { canPrice } from '@/lib/dispatch-prices';
import { logAction, getIp } from '@/lib/audit-logger';

async function staff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return user?.companyId && user.type !== 'portal' ? user : null;
}

// Sevk fişleri listesi (tarih, müşteri, durum filtresi)
export async function GET(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const rows = await prisma.dispatch.findMany({
    where: {
      companyId: user.companyId,
      ...(sp.get('customerId') ? { customerId: sp.get('customerId')! } : {}),
      ...(status === 'DRAFT' || status === 'POSTED' || status === 'CANCELLED' ? { status } : {}),
    },
    select: {
      id: true, no: true, date: true, status: true, total: true, currency: true, carrier: true, vehiclePlate: true, lines: true,
      customer: { select: { id: true, name: true } }, invoice: { select: { id: true, invoiceNo: true } },
    },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });
  const pricing = canPrice(user);
  return NextResponse.json(rows.map(({ lines, total, ...r }) => ({
    ...r, total: pricing ? total : null,
    // Satışı cari hesaptan silinmiş eski fişler "işlenmedi" görünsün
    status: r.status === 'POSTED' && !r.invoice ? 'DRAFT' : r.status,
    lineCount: Array.isArray(lines) ? lines.length : 0,
    missingPrice: Array.isArray(lines) && (lines as any[]).some(l => l?.unitPrice == null),
  })));
}

// Yeni sevk fişi (+ isteğe bağlı cari hesaba işle)
async function create(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await createDispatch(user, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'CREATE', entity: 'Dispatch', entityId: r.dispatch.id,
    detail: `Sevk fişi oluşturuldu — ${r.dispatch.no}${r.posted ? ' (hesaba işlendi)' : ''}`, ip: getIp(req),
  });
  return NextResponse.json({ ...r.dispatch, posted: r.posted, postError: r.reason ?? null, stockWarnings: r.negativeStock }, { status: 201 });
}

export const POST = duplicateGuarded('dispatches', create);
