export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { rejectForeignRefs } from '@/lib/tenant';
import { koliBarcode, koliSequenceKey, planBoxes, type KoliMode } from '@/lib/koli';

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

async function staff() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any;
  return user?.companyId && user.type !== 'portal' ? user : null;
}

// Koli kayıtları: ?barcode=… ile tek koli (okutma), ?orderId=… ile siparişin kolileri, yoksa son 100 koli
export async function GET(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const barcode = sp.get('barcode')?.trim();
  if (barcode) {
    const koli = await prisma.koli.findUnique({ where: { companyId_barcode: { companyId: user.companyId, barcode } } });
    return koli ? NextResponse.json(koli) : NextResponse.json({ error: 'Koli bulunamadı' }, { status: 404 });
  }
  const orderId = sp.get('orderId');
  const list = await prisma.koli.findMany({
    where: { companyId: user.companyId, ...(orderId ? { orderId } : {}) },
    orderBy: { createdAt: 'desc' }, take: 100,
  });
  return NextResponse.json(list);
}

// Koli etiketi bas: koliler kaydedilir, her birine tekrar etmeyen barkod verilir; istenirse toplam stoğa eklenir
export async function POST(req: NextRequest) {
  const user = await staff();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Hammaddeci firmalar ürün sayfasındaki barkod etiketini kullanır
  if (user.companyType === 'MATERIAL_SUPPLIER') {
    return NextResponse.json({ error: 'Koli etiketi tabancı ve ayakkabıcı firmalar içindir' }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));

  const productId = str(body?.productId, 50);
  const customerId = str(body?.customerId, 50);
  const orderId = str(body?.orderId, 50);
  const foreign = await rejectForeignRefs(user.companyId, { product: productId, customer: customerId, soleOrder: orderId });
  if (foreign) return foreign;

  const mode: KoliMode = body?.mode === 'single' ? 'single' : 'mixed';
  const plan = planBoxes(mode, body?.rows, body?.boxCount);
  if ('error' in plan) return NextResponse.json({ error: plan.error }, { status: 400 });

  const product = productId
    ? await prisma.product.findFirst({ where: { id: productId, companyId: user.companyId }, select: { id: true, code: true, name: true, unit: true } })
    : null;
  const productName = product?.name ?? str(body?.productName, 200);
  if (!productName) return NextResponse.json({ error: 'Ürün seçin ya da ürün adı yazın' }, { status: 400 });
  const customer = customerId ? await prisma.customer.findFirst({ where: { id: customerId, companyId: user.companyId }, select: { name: true } }) : null;
  const order = orderId ? await prisma.soleOrder.findFirst({ where: { id: orderId, companyId: user.companyId }, select: { orderNo: true } }) : null;
  const unit = str(body?.unit, 20) ?? product?.unit ?? 'çift';
  const addToStock = body?.addToStock === true && !!product;

  const now = new Date();
  const key = koliSequenceKey(now);
  const n = plan.boxes.length;
  const created = await prisma.$transaction(async tx => {
    const seq = await tx.barcodeSequence.upsert({
      where: { companyId_date: { companyId: user.companyId, date: key } },
      update: { lastNumber: { increment: n } },
      create: { companyId: user.companyId, date: key, lastNumber: n },
    });
    const from = seq.lastNumber - n + 1;
    const rows = plan.boxes.map((b, i) => ({
      companyId: user.companyId, barcode: koliBarcode(now, from + i),
      productId: product?.id ?? null, productCode: product?.code ?? str(body?.productCode, 100), productName,
      color: str(body?.color, 100), customerId: customerId ?? null, customerName: customer?.name ?? str(body?.customerName, 200),
      orderId: orderId ?? null, orderNo: order?.orderNo ?? null, unit,
      sizes: b.sizes, totalQuantity: b.totalQuantity, boxIndex: b.boxIndex, boxCount: b.boxCount, createdById: user.id ?? null,
    }));
    await tx.koli.createMany({ data: rows });
    if (addToStock) {
      const total = rows.reduce((a, r) => a + r.totalQuantity, 0);
      await tx.product.update({ where: { id: product!.id }, data: { stock: { increment: total } } });
      await tx.productStockAdjustment.create({
        data: { companyId: user.companyId, productId: product!.id, delta: total, type: 'koli_etiketi', notes: `${rows.length} koli · ${rows[0].barcode}${rows.length > 1 ? ` – ${rows[rows.length - 1].barcode}` : ''}` },
      });
    }
    return rows;
  });

  return NextResponse.json({ labels: created.map(({ companyId: _c, createdById: _u, ...r }) => r) }, { status: 201 });
}
