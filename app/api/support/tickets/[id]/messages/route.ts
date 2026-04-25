export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  const isAdmin = user.role === 'ADMIN';

  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: params.id,
      ...(isAdmin ? {} : { companyId: user.companyId }),
    },
  });
  if (!ticket) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });

  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: 'Mesaj boş olamaz' }, { status: 400 });

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId: params.id,
      userId: user.id,
      isAdmin,
      content: content.trim(),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  // Auto-update status when admin replies
  if (isAdmin && ticket.status === 'YENI') {
    await prisma.supportTicket.update({
      where: { id: params.id },
      data: { status: 'CEVAPLANDI' },
    });
  } else if (!isAdmin && ticket.status === 'CEVAPLANDI') {
    await prisma.supportTicket.update({
      where: { id: params.id },
      data: { status: 'INCELENIYOR' },
    });
  }

  return NextResponse.json(message, { status: 201 });
}
