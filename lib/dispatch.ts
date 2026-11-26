// Sevk fişi: müşteriye sevk edilen kalemler (açık siparişlerden ve/veya siparişsiz) tek fişte.
// - Sipariş kalemleri siparişin sevkiyatı olarak kaydedilir (saveShipment kuralları: kalan, fazla sevk sınırı, son sevkiyat).
// - "Cari hesaba işle" ile fişin tamamı tek satış (Invoice) olarak müşteriye yazılır: KDV, stok düşümü satışla aynı.
// - Fiyatı eksik kalem varsa ya da kullanıcının fiyat yetkisi yoksa fiş "taslak" kalır; yetkili kullanıcı sonradan işler.
// - Çift işleme yok: tamamı "Satışa Çevir" ile faturalanmış siparişin kalemi tekrar işlenmez; hesaba işlenmiş sevkiyatı olan
//   sipariş "Satışa Çevir" ile ikinci kez faturalanamaz (mark-converted).
import { prisma } from '@/lib/prisma';
import { nowUtc, parseDateInput } from '@/lib/time';
import { nextDocumentNumber, documentYear } from '@/lib/doc-number';
import { canPrice, resolvePrices } from '@/lib/dispatch-prices';
import { createSaleInvoice } from '@/lib/sale-invoice';
import { saveShipment } from '@/lib/order-notify';
import { remainingLines, shipLines, shippedSoFar, OVER_SHIP_FACTOR } from '@/lib/shipment';
import { cleanQuantity } from '@/lib/order-units';
import { dispatchTotals } from '@/lib/dispatch-print-html';
import { deleteSaleInvoice } from '@/lib/invoice-delete';

export type DispatchLine = {
  productId?: string | null; code?: string | null; name: string; unit?: string | null; qty: number;
  unitPrice?: number | null; priceSource?: 'special' | 'list' | 'manual' | null;
  orderId?: string | null; orderLineIndex?: number | null; invoiced?: boolean;
};
type User = { id?: string; companyId: string; role?: string; allowedPages?: string[]; name?: string | null };
type Fail = { ok: false; error: string; status: number };

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

/** Müşterinin açık siparişlerinin kalan kalemleri (sevk ekranı için) */
export async function openLines(user: User, customerId: string, excludeDispatchId?: string) {
  const found = await prisma.soleOrder.findMany({
    where: {
      companyId: user.companyId, customerId,
      // Düzenlemede: bu fişle "Sevk Edildi" olmuş sipariş de listelenir
      OR: [{ status: { notIn: ['SHIPPED', 'CANCELLED'] } }, ...(excludeDispatchId ? [{ status: 'SHIPPED' as const, shipments: { some: { dispatchId: excludeDispatchId } } }] : [])],
    },
    select: {
      id: true, orderNo: true, status: true, createdAt: true, requestedDeliveryDate: true, confirmedDeliveryDate: true, invoiceId: true,
      orderItems: true, unit: true, totalQuantity: true, productId: true, productCode: true, color: true,
      product: { select: { name: true, code: true } },
      shipments: { select: { items: true, invoiceId: true, dispatchId: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const orders = found.map(o => ({ ...o, shipments: o.shipments.filter(x => !excludeDispatchId || x.dispatchId !== excludeDispatchId) }));
  const ids = orders.flatMap(o => shipLines(o).map(l => l.productId).filter((x): x is string => !!x));
  const prices = canPrice(user) ? await resolvePrices(user.companyId, customerId, ids) : {};
  return orders.map(o => ({
    orderId: o.id, orderNo: o.orderNo, status: o.status, invoiced: !!o.invoiceId,
    termin: o.confirmedDeliveryDate ?? o.requestedDeliveryDate,
    lines: remainingLines(shipLines(o), shippedSoFar(o.shipments)).filter(l => l.remaining > 0).map(l => ({
      orderLineIndex: l.index, productId: l.productId, code: l.productCode, name: l.productName || l.productCode, unit: l.unit,
      ordered: l.ordered, remaining: l.remaining, color: o.color ?? null,
      price: l.productId ? prices[l.productId] ?? null : null,
    })),
  })).filter(o => o.lines.length);
}

type Prepared = {
  customerId: string; currency: string; date: Date; vatRate: number; lines: DispatchLine[];
  orders: Array<{ id: string; status: string; orderNo: string; invoiceId: string | null; orderItems: unknown; unit: string | null; totalQuantity: number; productId: string | null; productCode: string | null; product: { name: string; code: string | null } | null; shipments: Array<{ items: unknown }> }>;
  header: { carrier: string | null; vehiclePlate: string | null; driverName: string | null; notes: string | null };
};

/** Girdiyi doğrular ve fiş kalemlerini kurar. excludeDispatchId: düzenlenen fişin kendi sevkiyatları kalandan düşülmez. */
async function prepareDispatch(user: User, body: any, excludeDispatchId?: string): Promise<{ ok: true; p: Prepared } | Fail> {
  const customerId = str(body?.customerId, 64);
  if (!customerId) return { ok: false, error: 'Müşteri seçin', status: 400 };
  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: user.companyId }, select: { id: true, currency: true } });
  if (!customer) return { ok: false, error: 'Müşteri bulunamadı', status: 404 };
  const raw: any[] = Array.isArray(body?.lines) ? body.lines : [];
  if (!raw.length) return { ok: false, error: 'Sevk edilecek en az bir kalem seçin', status: 400 };
  if (raw.length > 200) return { ok: false, error: 'Bir fişte en fazla 200 kalem olabilir', status: 400 };
  const date = body?.date ? parseDateInput(body.date) : nowUtc();
  if (!date) return { ok: false, error: 'Tarih geçersiz', status: 400 };
  const vatRate = Number(body?.vatRate ?? 0);
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) return { ok: false, error: 'KDV oranı 0 ile 100 arasında olmalı', status: 400 };

  // Ürünler ve siparişler firmaya (ve sipariş müşteriye) ait olmalı
  const productIds = Array.from(new Set(raw.map(l => l?.productId).filter((x): x is string => typeof x === 'string' && !!x)));
  const products = productIds.length
    ? await prisma.product.findMany({ where: { companyId: user.companyId, id: { in: productIds } }, select: { id: true, name: true, code: true, unit: true } })
    : [];
  if (products.length !== productIds.length) return { ok: false, error: 'Ürün bulunamadı', status: 404 };
  const orderIds = Array.from(new Set(raw.map(l => l?.orderId).filter((x): x is string => typeof x === 'string' && !!x)));
  const found = orderIds.length
    ? await prisma.soleOrder.findMany({
        where: { companyId: user.companyId, id: { in: orderIds } },
        select: { id: true, customerId: true, status: true, invoiceId: true, orderNo: true, orderItems: true, unit: true, totalQuantity: true, productId: true, productCode: true, product: { select: { name: true, code: true } }, shipments: { select: { items: true, dispatchId: true } } },
      })
    : [];
  if (found.length !== orderIds.length) return { ok: false, error: 'Sipariş bulunamadı', status: 404 };
  if (found.some(o => o.customerId !== customerId)) return { ok: false, error: 'Sipariş bu müşteriye ait değil', status: 400 };
  // Düzenlemede: bu fişle "Sevk Edildi" olmuş sipariş açık sayılır
  const mineShipped = (o: (typeof found)[number]) => !!excludeDispatchId && o.shipments.some(x => x.dispatchId === excludeDispatchId);
  if (found.some(o => o.status === 'CANCELLED' || (o.status === 'SHIPPED' && !mineShipped(o)))) return { ok: false, error: 'Sevk edilmiş ya da iptal edilmiş siparişe sevk girilemez', status: 400 };
  const orders = found.map(o => ({ ...o, shipments: o.shipments.filter(x => !excludeDispatchId || x.dispatchId !== excludeDispatchId) }));

  // Sipariş kaleminin ürünü (istemci productId göndermese de fiyat ve stok için kullanılır)
  const lineProductIds = raw.flatMap(l => {
    const o = l?.orderId ? orders.find(x => x.id === l.orderId) : null;
    const sl = o ? shipLines(o).find(s => s.index === Number(l.orderLineIndex)) : null;
    return sl?.productId && !productIds.includes(sl.productId) ? [sl.productId] : [];
  });
  if (lineProductIds.length) {
    products.push(...await prisma.product.findMany({ where: { companyId: user.companyId, id: { in: Array.from(new Set(lineProductIds)) } }, select: { id: true, name: true, code: true, unit: true } }));
  }
  const pricing = canPrice(user);
  const resolved = await resolvePrices(user.companyId, customerId, products.map(x => x.id));
  const lines: DispatchLine[] = [];
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i] ?? {};
    const order = l.orderId ? orders.find(o => o.id === l.orderId) : null;
    const sl = order ? shipLines(order).find(s => s.index === Number(l.orderLineIndex)) : null;
    if (order && !sl) return { ok: false, error: `${i + 1}. kalem: sipariş kalemi bulunamadı`, status: 400 };
    const pid = l.productId || sl?.productId || null;
    const p = pid ? products.find(x => x.id === pid) : null;
    const unit = sl?.unit ?? p?.unit ?? str(l.unit, 20) ?? 'adet';
    const qty = cleanQuantity(Number(String(l.qty ?? '').replace(',', '.')), unit);
    if (qty == null || qty <= 0) return { ok: false, error: `${i + 1}. kalem: miktar geçersiz`, status: 400 };
    const name = str(l.name, 200) ?? sl?.productName ?? p?.name ?? sl?.productCode ?? null;
    if (!name) return { ok: false, error: `${i + 1}. kalem: ürün adı boş`, status: 400 };
    // Fiyat: yetkili kullanıcı elle girebilir; değilse yalnızca kayıtlı fiyat kullanılır
    const manual = pricing && l.unitPrice !== undefined && l.unitPrice !== null && l.unitPrice !== '' ? Number(String(l.unitPrice).replace(',', '.')) : null;
    if (manual != null && (!Number.isFinite(manual) || manual < 0 || manual > 1e9)) return { ok: false, error: `${i + 1}. kalem: fiyat geçersiz`, status: 400 };
    const reg = p ? resolved[p.id] : undefined;
    const unitPrice = manual ?? reg?.unitPrice ?? null;
    const priceSource = manual != null ? (reg && Math.abs(reg.unitPrice - manual) < 1e-6 ? reg.source : 'manual') : reg?.source ?? null;
    lines.push({
      productId: p?.id ?? null, code: str(l.code, 50) ?? sl?.productCode ?? p?.code ?? null, name, unit, qty, unitPrice, priceSource,
      orderId: order?.id ?? null, orderLineIndex: sl ? sl.index : null, invoiced: !!order?.invoiceId,
    });
  }

  // Sipariş kalemleri: aynı kalem iki kez seçilmesin; fazla sevk sınırı
  for (const o of orders) {
    const mine = lines.filter(l => l.orderId === o.id);
    const idx = mine.map(l => l.orderLineIndex);
    if (new Set(idx).size !== idx.length) return { ok: false, error: `${o.orderNo}: aynı kalem iki kez seçildi`, status: 400 };
    const rem = remainingLines(shipLines(o), shippedSoFar(o.shipments));
    for (const l of mine) {
      const r = rem.find(x => x.index === l.orderLineIndex)!;
      if (l.qty > r.remaining * OVER_SHIP_FACTOR + 1e-9) return { ok: false, error: `${o.orderNo} · ${l.name}: sevk miktarı kalan miktarın çok üzerinde`, status: 400 };
    }
  }
  return {
    ok: true,
    p: {
      customerId, currency: customer.currency ?? 'TRY', date, vatRate, lines, orders,
      header: { carrier: str(body?.carrier, 100), vehiclePlate: str(body?.vehiclePlate, 20), driverName: str(body?.driverName, 100), notes: str(body?.notes, 500) },
    },
  };
}

/** Fişin sipariş kalemlerini siparişlerin sevkiyatı olarak yazar (seçilmeyen kalem 0; son sevkiyat kalan bitince otomatik) */
async function writeShipments(dispatch: { id: string; no: string; notes: string | null }, p: Prepared) {
  let notes = dispatch.notes;
  for (const o of p.orders) {
    const mine = p.lines.filter(l => l.orderId === o.id);
    const fresh = await prisma.soleOrder.findUniqueOrThrow({ where: { id: o.id }, select: { id: true, status: true, orderItems: true, unit: true, totalQuantity: true, productId: true, productCode: true } });
    const items = shipLines(o).map(s => ({ index: s.index, shipped: mine.find(l => l.orderLineIndex === s.index)?.qty ?? 0 }));
    const r = await saveShipment(fresh as any, {
      shipmentDate: p.date.toISOString(), mode: 'new', deliveryNoteNo: dispatch.no,
      carrier: p.header.carrier, trackingNo: p.header.vehiclePlate, notes: p.header.notes, items,
    });
    if ('error' in r) {
      notes = [notes, `Uyarı: ${o.orderNo} sevkiyatı kaydedilemedi (${r.error})`].filter(Boolean).join(' · ');
      await prisma.dispatch.update({ where: { id: dispatch.id }, data: { notes } });
      continue;
    }
    await prisma.orderShipment.update({ where: { id: r.shipment.id }, data: { dispatchId: dispatch.id } });
  }
}

/**
 * Fişin etkilerini geri alır: bağlı satış silinir (stok geri gelir), sipariş sevkiyatları silinir,
 * bu fişle "Sevk Edildi" olan sipariş kalanı varsa "Sevkiyata Hazır"a döner.
 */
async function revertDispatch(user: User & { companyType?: string | null }, d: { id: string; no: string; invoiceId: string | null }, reason: string) {
  const shipments = await prisma.orderShipment.findMany({ where: { dispatchId: d.id }, select: { id: true, orderId: true } });
  await prisma.$transaction(async tx => {
    if (d.invoiceId) await deleteSaleInvoice(tx, user, d.invoiceId);
    await tx.orderShipment.deleteMany({ where: { dispatchId: d.id } });
    for (const orderId of Array.from(new Set(shipments.map(s => s.orderId)))) {
      const o = await tx.soleOrder.findUnique({ where: { id: orderId }, select: { id: true, status: true, orderItems: true, unit: true, totalQuantity: true, productId: true, productCode: true, product: { select: { name: true, code: true } }, shipments: { select: { items: true } } } });
      if (!o || o.status !== 'SHIPPED') continue;
      const open = remainingLines(shipLines(o), shippedSoFar(o.shipments)).some(l => l.remaining > 0);
      if (open) await tx.soleOrder.update({ where: { id: o.id }, data: { status: 'READY_FOR_SHIPMENT', statusHistory: { create: { status: 'READY_FOR_SHIPMENT', note: `Sevk fişi ${d.no} ${reason}` } } } });
    }
  });
}

/** Fişin silinip düzenlenebilmesi için kontroller (yetki, tahsilat) */
async function editable(user: User, id: string): Promise<{ ok: true; d: any } | Fail> {
  const d = await prisma.dispatch.findFirst({ where: { id, companyId: user.companyId }, include: { invoice: { select: { id: true, invoiceNo: true, paidAmount: true } } } });
  if (!d) return { ok: false, error: 'Sevk fişi bulunamadı', status: 404 };
  if (d.status === 'POSTING') return { ok: false, error: 'Fiş şu an hesaba işleniyor; biraz sonra tekrar deneyin', status: 409 };
  if (d.invoice && !canPrice(user)) return { ok: false, error: 'Hesaba işlenmiş fişi yalnızca yöneticiniz değiştirebilir', status: 403 };
  if (d.invoice && d.invoice.paidAmount > 0.005) {
    return { ok: false, error: `${d.invoice.invoiceNo} satışına tahsilat bağlı; önce cari hesaptan tahsilatı silin`, status: 409 };
  }
  return { ok: true, d };
}

/** Sevk fişini oluşturur; post=true ise (fiyatlar tamamsa ve yetki varsa) satış açar */
export async function createDispatch(user: User, body: any): Promise<{ ok: true; dispatch: any; posted: boolean; reason?: string; negativeStock: any[] } | Fail> {
  const prep = await prepareDispatch(user, body);
  if (!prep.ok) return prep;
  const { p } = prep;
  const totals = dispatchTotals(p.lines.filter(l => !l.invoiced).map(l => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice })), p.vatRate);
  const dispatch = await prisma.$transaction(async tx => {
    const no = await nextDocumentNumber('dispatch', user.companyId, `SVK-${documentYear(p.date)}-`, { db: tx });
    return tx.dispatch.create({
      data: {
        companyId: user.companyId, customerId: p.customerId, no, date: p.date, currency: p.currency, vatRate: p.vatRate, ...p.header,
        lines: p.lines as any, subtotal: totals.subtotal, total: totals.total, status: 'DRAFT', createdById: user.id ?? null,
      },
    });
  });
  await writeShipments(dispatch, p);
  return finish(user, dispatch.id, !!body?.post);
}

/** Sevk fişini düzenler: önce yeni girdi doğrulanır, sonra eski etkiler geri alınıp fiş aynı numarayla yeniden yazılır */
export async function updateDispatch(user: User & { companyType?: string | null }, id: string, body: any): Promise<{ ok: true; dispatch: any; posted: boolean; reason?: string; negativeStock: any[] } | Fail> {
  const chk = await editable(user, id);
  if (!chk.ok) return chk;
  const old = chk.d;
  const prep = await prepareDispatch(user, body, id);
  if (!prep.ok) return prep;
  const { p } = prep;
  await revertDispatch(user, old, 'düzenlendi');
  const totals = dispatchTotals(p.lines.filter(l => !l.invoiced).map(l => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice })), p.vatRate);
  const dispatch = await prisma.dispatch.update({
    where: { id },
    data: {
      customerId: p.customerId, date: p.date, currency: p.currency, vatRate: p.vatRate, ...p.header,
      lines: p.lines as any, subtotal: totals.subtotal, total: totals.total, status: 'DRAFT', invoiceId: null,
    },
  });
  await writeShipments(dispatch, p);
  return finish(user, id, !!body?.post);
}

/** Sevk fişini siler: bağlı satış ve sipariş sevkiyatları geri alınır */
export async function deleteDispatch(user: User & { companyType?: string | null }, id: string): Promise<{ ok: true; no: string } | Fail> {
  const chk = await editable(user, id);
  if (!chk.ok) return chk;
  await revertDispatch(user, chk.d, 'silindi');
  await prisma.dispatch.delete({ where: { id } });
  return { ok: true, no: chk.d.no };
}

async function finish(user: User, id: string, post: boolean) {
  let posted = false; let reason: string | undefined; let negativeStock: any[] = [];
  if (post) {
    const res = await postDispatch(user, id);
    if (res.ok) { posted = true; negativeStock = res.negativeStock; } else reason = res.error;
  }
  const fresh = await prisma.dispatch.findUnique({ where: { id }, include: { invoice: { select: { id: true, invoiceNo: true } } } });
  return { ok: true as const, dispatch: fresh, posted, reason, negativeStock };
}

/** Taslak fişi cari hesaba işler (satış açar). prices: yetkili kullanıcının eksik fiyatları tamamlaması için { satırNo: fiyat } */
export async function postDispatch(user: User, id: string, prices?: Record<string, unknown>): Promise<{ ok: true; invoice: any; negativeStock: any[] } | Fail> {
  if (!canPrice(user)) return { ok: false, error: 'Fiyat yetkiniz olmadığı için fiş hesaba işlenemedi; yöneticiniz işleyebilir', status: 403 };
  const d = await prisma.dispatch.findFirst({ where: { id, companyId: user.companyId } });
  if (!d) return { ok: false, error: 'Sevk fişi bulunamadı', status: 404 };
  // Satışı cari hesaptan silinmiş eski kayıtlar POSTED kalmış olabilir: bağlı satış yoksa yeniden işlenebilir
  if (d.invoiceId) return { ok: false, error: 'Fiş zaten hesaba işlendi', status: 409 };
  if (d.status === 'CANCELLED') return { ok: false, error: 'İptal edilmiş fiş işlenemez', status: 400 };
  const lines = (Array.isArray(d.lines) ? d.lines : []) as DispatchLine[];
  for (const [k, v] of Object.entries(prices ?? {})) {
    const i = Number(k); const n = Number(String(v).replace(',', '.'));
    if (!lines[i] || !Number.isFinite(n) || n < 0 || n > 1e9) return { ok: false, error: `${i + 1}. kalem: fiyat geçersiz`, status: 400 };
    lines[i] = { ...lines[i], unitPrice: n, priceSource: 'manual' };
  }
  // Tamamı "Satışa Çevir" ile faturalanmış siparişin kalemi tekrar işlenmez
  const orderIds = Array.from(new Set(lines.map(l => l.orderId).filter((x): x is string => !!x)));
  const invoicedOrders = orderIds.length
    ? new Set((await prisma.soleOrder.findMany({ where: { id: { in: orderIds }, invoiceId: { not: null } }, select: { id: true } })).map(o => o.id))
    : new Set<string>();
  const billable = lines.map((l, i) => ({ l, i })).filter(({ l }) => !(l.orderId && invoicedOrders.has(l.orderId)));
  if (!billable.length) return { ok: false, error: 'Fişteki tüm kalemler daha önce satışa çevrilmiş', status: 409 };
  const missing = billable.filter(({ l }) => l.unitPrice == null);
  if (missing.length) {
    await prisma.dispatch.update({ where: { id }, data: { lines: lines as any } });
    return { ok: false, error: `Fiyatı girilmemiş kalem var: ${missing.map(({ l }) => l.name).join(', ')}`, status: 400 };
  }

  // Yarışa karşı: fişi önce "işleniyor" olarak kilitle
  const claimed = await prisma.dispatch.updateMany({ where: { id, status: { in: ['DRAFT', 'POSTED'] }, invoiceId: null }, data: { status: 'POSTING' } });
  if (!claimed.count) return { ok: false, error: 'Fiş zaten işleniyor ya da işlendi', status: 409 };
  try {
    const r = await createSaleInvoice(user.companyId, user.id ?? null, {
      customerId: d.customerId, date: d.date.toISOString(), vatRate: d.vatRate, currency: d.currency,
      irsaliyeNo: d.no, sevkTarihi: d.date.toISOString(), notes: `Sevk fişi ${d.no}${d.notes ? ` · ${d.notes}` : ''}`,
      items: billable.map(({ l }) => ({ description: [l.code, l.name].filter(Boolean).join(' · '), productId: l.productId ?? null, quantity: l.qty, unitPrice: l.unitPrice })),
    });
    if (!r.ok) { await prisma.dispatch.update({ where: { id }, data: { status: 'DRAFT' } }); return r; }
    const totals = dispatchTotals(billable.map(({ l }) => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice })), d.vatRate);
    await prisma.dispatch.update({ where: { id }, data: { status: 'POSTED', invoiceId: r.invoice.id, lines: lines as any, subtotal: totals.subtotal, total: totals.total } });
    await prisma.orderShipment.updateMany({ where: { dispatchId: id }, data: { invoiceId: r.invoice.id } });
    return { ok: true, invoice: r.invoice, negativeStock: r.negativeStock };
  } catch (e) {
    await prisma.dispatch.update({ where: { id }, data: { status: 'DRAFT' } }).catch(() => {});
    throw e;
  }
}

/** Yazdırma verisi: firma, müşteri ve kalemler (fiyatlar yalnızca yetkiliye) */
export async function dispatchPrintData(user: User, id: string) {
  const d = await prisma.dispatch.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: { select: { name: true, address: true, taxId: true } },
      company: { select: { name: true, address: true, phone: true, taxId: true } },
      invoice: { select: { id: true, invoiceNo: true } },
      shipments: { select: { orderId: true, order: { select: { orderNo: true } } } },
    },
  });
  if (!d) return null;
  const pricing = canPrice(user);
  const lines = ((Array.isArray(d.lines) ? d.lines : []) as DispatchLine[]).map(l => (pricing ? l : { ...l, unitPrice: null, priceSource: null }));
  return { ...d, lines, subtotal: pricing ? d.subtotal : null, total: pricing ? d.total : null, canPrice: pricing };
}
