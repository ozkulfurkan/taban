export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { createSoleOrder } from '@/lib/orders';
import { itemsInCatalog, linkFor, sellerCatalog } from '@/lib/network';
import { logAction, getIp } from '@/lib/audit-logger';

// Alıcı firma, onaylı bağlantı üzerinden satıcıya sipariş verir. Sipariş satıcıda,
// eşlenen müşteri adına portal siparişleriyle aynı biçimde oluşur.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  if (!user?.companyId || user.type === 'portal') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await linkFor(user.companyId, params.id, 'buyer');
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (link.status !== 'ACTIVE' || !link.sellerCustomerId) return NextResponse.json({ error: 'Bağlantı onaylanmadı' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const catalog = await sellerCatalog(link);
  if (!itemsInCatalog(body?.orderItems, new Set(catalog.map(p => p.id)))) {
    return NextResponse.json({ error: 'Sepette katalogda olmayan ürün var' }, { status: 400 });
  }
  // Kalemler createSoleOrder içinde ürün birimine göre doğrulanır (çift: beden asortisi, diğerleri: miktar);
  // ürün adı, kodu ve birimi satıcının kayıtlarından alınır, toplam sunucuda hesaplanır.
  const orderItems = body.orderItems as unknown[];

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true, name: true } });
  const result = await createSoleOrder(
    {
      companyId: link.sellerCompanyId, customerId: link.sellerCustomerId, linkId: link.id, buyerUserId: user.id,
      contact: me ? { email: me.email, name: me.name } : null,
    },
    { orderItems, requestedDeliveryDate: body.requestedDeliveryDate, notes: body.notes },
  );
  if (!result.order) return NextResponse.json({ error: result.error }, { status: result.status });

  await logAction({
    companyId: user.companyId, userId: user.id, userName: user.name, action: 'CREATE', entity: 'NetworkOrder',
    entityId: result.order.id, detail: `${link.sellerCompany.name} firmasına sipariş verildi — ${result.order.orderNo}`, ip: getIp(req),
  });
  return NextResponse.json({ id: result.order.id, orderNo: result.order.orderNo, totalQuantity: result.order.totalQuantity }, { status: 201 });
}
