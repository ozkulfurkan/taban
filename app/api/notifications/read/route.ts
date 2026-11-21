import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationOwner } from '@/lib/notification-owner';

// Okundu işareti: { ids: [...] } ya da { all: true }. Yalnızca kişinin kendi kayıtları değişir.
export async function POST(req: NextRequest) {
  const owner = await notificationOwner();
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string').slice(0, 500) : [];
  if (!body?.all && !ids.length) return NextResponse.json({ error: 'Okundu yapılacak bildirim seçin' }, { status: 400 });
  const r = await prisma.notification.updateMany({
    where: { ...owner.where, readAt: null, ...(body?.all ? {} : { id: { in: ids } }) },
    data: { readAt: new Date() },
  });
  const unreadCount = await prisma.notification.count({ where: { ...owner.where, readAt: null } });
  return NextResponse.json({ updated: r.count, unreadCount });
}
