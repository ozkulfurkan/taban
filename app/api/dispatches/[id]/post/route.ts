export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { postDispatch } from '@/lib/dispatch';
import { logAction, getIp } from '@/lib/audit-logger';

// Taslak sevk fişini cari hesaba işle (eksik fiyatlar { prices: { satırNo: fiyat } } ile tamamlanabilir)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await postDispatch(user, params.id, body?.prices);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAction({ companyId: user.companyId, userId: user.id, userName: user.name, action: 'UPDATE', entity: 'Dispatch', entityId: params.id, detail: `Sevk fişi hesaba işlendi — ${r.invoice.invoiceNo}`, ip: getIp(req) });
  return NextResponse.json({ ok: true, invoice: { id: r.invoice.id, invoiceNo: r.invoice.invoiceNo }, stockWarnings: r.negativeStock });
}
