export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { notificationOwner } from '@/lib/notification-owner';

// Bildirim kutusu: yeniden eskiye, sayfalı (?before=<son görülen id>&limit=20) + okunmamış sayısı
export async function GET(req: NextRequest) {
  const owner = await notificationOwner();
  if (!owner) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get('limit')) || 20, 1), 50);
  const before = sp.get('before');

  let where = owner.where;
  if (before) {
    // İmleç yalnızca kişinin kendi kaydıysa geçerli
    const ref = await prisma.notification.findFirst({ where: { ...owner.where, id: before }, select: { id: true, createdAt: true } });
    if (!ref) return NextResponse.json({ items: [], unreadCount: 0, nextCursor: null });
    where = { ...owner.where, OR: [{ createdAt: { lt: ref.createdAt } }, { createdAt: ref.createdAt, id: { lt: ref.id } }] };
  }
  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, title: true, body: true, url: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { ...owner.where, readAt: null } }),
  ]);
  const items = rows.slice(0, limit);
  return NextResponse.json({ items, unreadCount, nextCursor: rows.length > limit ? items[items.length - 1].id : null });
}
