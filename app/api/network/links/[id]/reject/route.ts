export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hasFullAccess } from '@/lib/access';
import { linkFor } from '@/lib/network';

// Satıcı isteği reddeder
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'seller');
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!hasFullAccess(user)) return NextResponse.json({ error: 'İsteği yalnızca firma yöneticisi yanıtlayabilir' }, { status: 403 });
  if (link.status !== 'PENDING') return NextResponse.json({ error: 'Bu istek zaten yanıtlanmış' }, { status: 409 });
  await prisma.companyLink.update({ where: { id: link.id }, data: { status: 'REJECTED', respondedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
