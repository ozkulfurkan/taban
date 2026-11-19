export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { shareUrl } from '@/lib/statement-share';

// Portal müşterisinin hesap ekstresi linki. Yalnızca firma bu müşteri için ekstre linki
// oluşturmuşsa (ve kapatmamışsa) döner; böylece ekstreyi görme izni firmanın kararıdır.
export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (user?.type !== 'portal' || !user?.customerId || !user?.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const link = await prisma.statementShareLink.findFirst({
    where: { companyId: user.companyId, customerId: user.customerId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { token: true },
  });

  return NextResponse.json({ url: link ? shareUrl(link.token) : null });
}
