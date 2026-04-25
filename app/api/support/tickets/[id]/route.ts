export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  const isAdmin = user.role === 'ADMIN';

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: params.id,
      ...(isAdmin ? {} : { companyId: user.companyId }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      messages: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      attachments: { select: { id: true, name: true, size: true, mimeType: true, createdAt: true } },
    },
  });

  if (!ticket) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  const isAdmin = user.role === 'ADMIN';

  const body = await req.json();
  const { status } = body;

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: params.id,
      ...(isAdmin ? {} : { companyId: user.companyId }),
    },
  });
  if (!ticket) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });

  const updated = await prisma.supportTicket.update({
    where: { id: params.id },
    data: {
      status: status as any,
      ...(status === 'COZULDU' ? { resolvedAt: new Date() } : {}),
    },
  });

  return NextResponse.json(updated);
}
