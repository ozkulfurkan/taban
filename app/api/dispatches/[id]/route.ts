export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { dispatchPrintData } from '@/lib/dispatch';

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
