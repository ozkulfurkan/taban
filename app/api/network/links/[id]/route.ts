export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hasFullAccess } from '@/lib/access';
import { linkFor } from '@/lib/network';
import { logAction, getIp } from '@/lib/audit-logger';

// Bağlantıyı kaldır (iki taraf da yapabilir, yalnızca firma yöneticisi). Eski siparişler kalır.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id);
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!hasFullAccess(user)) return NextResponse.json({ error: 'Bağlantıyı yalnızca firma yöneticisi kaldırabilir' }, { status: 403 });

  await prisma.companyLink.update({ where: { id: link.id }, data: { status: 'REVOKED', respondedAt: new Date() } });
  const other = link.buyerCompanyId === user.companyId ? link.sellerCompany.name : link.buyerCompany.name;
  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'DELETE', entity: 'CompanyLink',
    entityId: link.id, detail: `Firma bağlantısı kaldırıldı — ${other}`, ip: getIp(req),
  });
  return NextResponse.json({ ok: true });
}
