export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });
  const user = session.user as any;
  const isAdmin = user.role === 'ADMIN';

  const attachment = await prisma.ticketAttachment.findFirst({
    where: {
      id: params.attachmentId,
      ticket: {
        id: params.id,
        ...(isAdmin ? {} : { companyId: user.companyId }),
      },
    },
  });

  if (!attachment) return new NextResponse('Not found', { status: 404 });

  return new NextResponse(attachment.data, {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Disposition': `inline; filename="${attachment.name}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
