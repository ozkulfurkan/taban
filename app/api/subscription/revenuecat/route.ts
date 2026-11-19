export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { syncCompanyFromRevenueCat, webhookAppUserIds } from '@/lib/revenuecat';

// RevenueCat webhook'u (satın alma, yenileme, iptal, süre dolması...). Olay içeriğine güvenilmez:
// yalnızca hangi firmanın değiştiği alınır, güncel durum RevenueCat REST API'sinden okunur.
// Panelde Authorization başlığı REVENUECAT_WEBHOOK_AUTH değeriyle tanımlanır.

function authorized(req: NextRequest) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const got = req.headers.get('authorization') ?? '';
  if (!expected) return false;
  const a = Buffer.from(got), b = Buffer.from(expected), c = Buffer.from(`Bearer ${expected}`);
  return (a.length === b.length && timingSafeEqual(a, b)) || (a.length === c.length && timingSafeEqual(a, c));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const ids = webhookAppUserIds(body?.event);
  // Yalnızca gerçekten firma olan kimlikler (test olayı ya da başka uygulama kimliği yok sayılır)
  const companies = ids.length ? await prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true } }) : [];
  try {
    for (const c of companies) await syncCompanyFromRevenueCat(c.id);
  } catch (e) {
    console.error('revenuecat webhook', e);
    // RevenueCat 200 dışını yeniden dener; geçici API hatasında yeniden denensin
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, synced: companies.length });
}
