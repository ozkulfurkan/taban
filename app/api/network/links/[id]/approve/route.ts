export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hasFullAccess } from '@/lib/access';
import { linkFor } from '@/lib/network';
import { rejectForeignRefs } from '@/lib/tenant';
import { logAction, getIp } from '@/lib/audit-logger';

// Satıcı isteği onaylar: alıcı firmayı mevcut bir müşteriyle eşler ya da yeni müşteri açar
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'seller');
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!hasFullAccess(user)) return NextResponse.json({ error: 'İsteği yalnızca firma yöneticisi onaylayabilir' }, { status: 403 });
  if (link.status !== 'PENDING') return NextResponse.json({ error: 'Bu istek zaten yanıtlanmış' }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  let customerId: string | null = typeof body?.customerId === 'string' ? body.customerId : null;
  if (customerId) {
    const foreign = await rejectForeignRefs(user.companyId, { customer: customerId });
    if (foreign) return foreign;
  } else if (body?.createCustomer) {
    const buyer = await prisma.company.findUnique({
      where: { id: link.buyerCompanyId }, select: { name: true, taxId: true, phone: true, address: true },
    });
    customerId = (await prisma.customer.create({
      data: { companyId: user.companyId, name: buyer!.name, taxId: buyer!.taxId, phone: buyer!.phone, address: buyer!.address },
      select: { id: true },
    })).id;
  } else {
    return NextResponse.json({ error: 'Müşteri seçin ya da yeni müşteri açın' }, { status: 400 });
  }

  const updated = await prisma.companyLink.update({
    where: { id: link.id },
    data: { status: 'ACTIVE', sellerCustomerId: customerId, approvedById: user.id, respondedAt: new Date() },
    select: { id: true, status: true, sellerCustomerId: true },
  });
  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'UPDATE', entity: 'CompanyLink',
    entityId: link.id, detail: `Firma bağlantısı onaylandı — ${link.buyerCompany.name}`, ip: getIp(req),
  });
  return NextResponse.json({ link: updated });
}
