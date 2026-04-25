export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const module_ = searchParams.get('module');
  const companyId = searchParams.get('companyId');
  const isAdmin = user.role === 'ADMIN';

  const where: any = {
    ...(isAdmin ? (companyId ? { companyId } : {}) : { companyId: user.companyId }),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(module_ ? { module: module_ } : {}),
  };

  const tickets = await prisma.supportTicket.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      company: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(tickets);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = session.user as any;
  if (!user.companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  try {
    const formData = await req.formData();
    const type = (formData.get('type') as string) || 'BUG';
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const module_ = formData.get('module') as string | null;
    const priority = (formData.get('priority') as string) || 'ORTA';
    const pageUrl = formData.get('pageUrl') as string | null;
    const browser = formData.get('browser') as string | null;
    const file = formData.get('screenshot') as File | null;

    if (!title || !description) {
      return NextResponse.json({ error: 'Konu ve açıklama zorunludur' }, { status: 400 });
    }

    const now = new Date();
    const year = now.getFullYear();
    const prefix = `TKT-${year}-`;

    const ticket = await prisma.$transaction(async (tx) => {
      const last = await tx.supportTicket.findFirst({
        where: { companyId: user.companyId, ticketNo: { startsWith: prefix } },
        orderBy: { ticketNo: 'desc' },
      });
      const seq = last ? parseInt(last.ticketNo.split('-')[2]) + 1 : 1;
      const ticketNo = `${prefix}${String(seq).padStart(4, '0')}`;

      const t = await tx.supportTicket.create({
        data: {
          ticketNo,
          companyId: user.companyId,
          userId: user.id,
          type: type as any,
          title,
          description,
          module: module_ || null,
          priority: priority as any,
          pageUrl: pageUrl || null,
          browser: browser || null,
        },
      });

      if (file && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        await tx.ticketAttachment.create({
          data: {
            ticketId: t.id,
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            data: buffer,
          },
        });
      }

      return t;
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (err: any) {
    console.error('Ticket create error:', err);
    return NextResponse.json({ error: 'Talep oluşturulamadı' }, { status: 500 });
  }
}
