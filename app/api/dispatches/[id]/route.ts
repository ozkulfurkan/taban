export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { dispatchPrintData, updateDispatch, deleteDispatch } from '@/lib/dispatch';
import { logAction, getIp } from '@/lib/audit-logger';

// Sevk fişi detayı ve yazdırma verisi (fiyatlar yalnızca yetkiliye)
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const d = await dispatchPrintData(user, params.id);
  if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const settings = await prisma.printSettings.findUnique({ where: { companyId: user.companyId } });
  return NextResponse.json({ ...d, printSettings: settings });
}

// Yazdırıldı bilgisi
export async function PATCH(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await prisma.dispatch.updateMany({ where: { id: params.id, companyId: user.companyId }, data: { printedAt: new Date() } });
  if (!r.count) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Düzenle: kalemler, miktarlar, fiyatlar, başlık. Hesaba işlenmişse satış yeniden oluşturulur (aynı fiş numarası).
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await updateDispatch(user, params.id, body);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'UPDATE', entity: 'Dispatch', entityId: params.id,
    detail: `Sevk fişi düzenlendi — ${r.dispatch?.no}${r.posted ? ` · hesaba işlendi (${r.dispatch?.invoice?.invoiceNo})` : ''}`, ip: getIp(req),
  });
  return NextResponse.json({ ...r.dispatch, posted: r.posted, postError: r.reason ?? null, stockWarnings: r.negativeStock });
}

// Sil: bağlı satış (stok geri gelir) ve sipariş sevkiyatları geri alınır
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const r = await deleteDispatch(user, params.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  await logAction({ companyId: user.companyId, userId: user.id, userName: user.name, action: 'DELETE', entity: 'Dispatch', entityId: params.id, detail: `Sevk fişi silindi — ${r.no}`, ip: getIp(req) });
  return NextResponse.json({ ok: true });
}
