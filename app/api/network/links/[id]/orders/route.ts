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
  // Ürün adı ve kodu satıcının kataloğundan alınır (istemciden gelen değer kullanılmaz)
  const byId = new Map(catalog.map(p => [p.id, p]));
  // Beden adetleri pozitif tam sayıya çevrilir, toplam sunucuda hesaplanır
  const orderItems = (body.orderItems as any[]).map(i => {
    const sizeDistribution: Record<string, number> = {};
    for (const [size, qty] of Object.entries(i.sizeDistribution && typeof i.sizeDistribution === 'object' ? i.sizeDistribution : {})) {
      const n = Math.floor(Number(qty));
      if (Number.isFinite(n) && n > 0) sizeDistribution[String(size).slice(0, 10)] = n;
    }
    return {
      productId: i.productId as string,
      productCode: byId.get(i.productId)!.code ?? '',
      productName: byId.get(i.productId)!.name,
      color: typeof i.color === 'string' ? i.color.trim().slice(0, 100) : '',
      sizeDistribution,
      totalQuantity: Object.values(sizeDistribution).reduce((s, n) => s + n, 0),
    };
  });
  if (orderItems.some(i => i.totalQuantity === 0)) return NextResponse.json({ error: 'Her kalemde en az 1 adet olmalı' }, { status: 400 });

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
