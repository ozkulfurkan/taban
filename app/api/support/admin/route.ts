export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [yeni, inceleniyor, cevaplandi, cozuldu, kritik, tickets, companies] = await Promise.all([
    prisma.supportTicket.count({ where: { status: 'YENI' } }),
    prisma.supportTicket.count({ where: { status: 'INCELENIYOR' } }),
    prisma.supportTicket.count({ where: { status: 'CEVAPLANDI' } }),
    prisma.supportTicket.count({ where: { status: 'COZULDU' } }),
    prisma.supportTicket.count({ where: { priority: 'KRITIK', status: { not: 'COZULDU' } } }),
    prisma.supportTicket.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        company: { select: { id: true, name: true } },
        _count: { select: { messages: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return NextResponse.json({ stats: { yeni, inceleniyor, cevaplandi, cozuldu, kritik }, tickets, companies });
}
