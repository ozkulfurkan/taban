import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';
import { orderRecipients, pushToPortalCustomer, pushToUsers } from '@/lib/push';
import { statusLabel } from '@/lib/order-status';
import { formatQty } from '@/lib/order-units';
import { OVER_SHIP_FACTOR, buildShipped, formatDiff, remainingLines, shipLines, shippedSoFar, type ShippedLine } from '@/lib/shipment';

// Sipariş durumu değişince siparişi verene e-posta: portal müşterisi ya da bağlı SoleCost
// firmasında siparişi veren kullanıcı. Tüm durum değiştiren uçlar bunu kullanır.

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function recipientOf(orderId: string) {
  const order = await prisma.soleOrder.findUnique({
    where: { id: orderId },
    select: {
      orderNo: true, unit: true, totalQuantity: true, buyerUserId: true, confirmedDeliveryDate: true,
      company: { select: { name: true } },
      portalCustomer: { select: { email: true, name: true, isActive: true } },
      link: { select: { status: true, buyerCompanyId: true } },
    },
  });
  if (!order) return null;
  // Pasif portal hesabına ve kaldırılmış bağlantıya bildirim gitmez
  if (order.portalCustomer) return order.portalCustomer.isActive ? { order, to: order.portalCustomer.email, name: order.portalCustomer.name } : null;
  if (order.buyerUserId && order.link?.status === 'ACTIVE') {
    // Siparişi veren kullanıcı hâlâ alıcı firmada olmalı
    const u = await prisma.user.findFirst({ where: { id: order.buyerUserId, companyId: order.link.buyerCompanyId }, select: { email: true, name: true } });
    if (u?.email) return { order, to: u.email, name: u.name };
  }
  return null;
}

/** Siparişi verene anlık bildirim: portal müşterisi ya da bağlı firmada siparişi veren + siparişleri görenler */
export async function pushToBuyer(orderId: string, title: (company: string, orderNo: string) => string, body: string) {
  try {
    const o = await prisma.soleOrder.findUnique({
      where: { id: orderId },
      select: {
        orderNo: true, portalCustomerId: true, buyerUserId: true, companyId: true, company: { select: { name: true } },
        portalCustomer: { select: { isActive: true } }, link: { select: { buyerCompanyId: true, status: true } },
      },
    });
    if (!o) return;
    const msg = { title: title(o.company.name, o.orderNo), body };
    if (o.portalCustomerId) {
      if (o.portalCustomer?.isActive) await pushToPortalCustomer(o.portalCustomerId, { ...msg, url: `/siparisler/${orderId}` });
    } else if (o.link?.status === 'ACTIVE') {
      // Alıcı firmada siparişleri görenler + siparişi veren (hâlâ o firmadaysa)
      const ids = await orderRecipients(o.link.buyerCompanyId);
      const buyer = o.buyerUserId
        ? await prisma.user.findFirst({ where: { id: o.buyerUserId, companyId: o.link.buyerCompanyId }, select: { id: true } })
        : null;
      // Siparişi alan (satıcı) firmanın kullanıcıları alıcı bildirimini hiçbir koşulda almaz
      const sellerIds = new Set((await prisma.user.findMany({ where: { companyId: o.companyId }, select: { id: true } })).map(u => u.id));
      await pushToUsers([...ids, buyer?.id].filter((id): id is string => !!id && !sellerIds.has(id)), { ...msg, url: `/siparis/verilen/${orderId}` });
    }
  } catch (e) {
    console.error('pushToBuyer', e);
  }
}

export async function notifyOrderStatus(orderId: string, status: string, note?: string | null) {
  const unit = (await prisma.soleOrder.findUnique({ where: { id: orderId }, select: { unit: true } }).catch(() => null))?.unit;
  await pushToBuyer(
    orderId,
    (company, no) => `${company} · ${no}`,
    `${status === 'CANCELLED' ? 'Siparişiniz iptal edildi' : `Siparişiniz: ${statusLabel(status, unit)}`}${note ? ` — ${note}` : ''}`,
  );
  try {
    const r = await recipientOf(orderId);
    if (!r) return;
    const { order } = r;
    const label = statusLabel(status, order.unit);
    const termin = order.confirmedDeliveryDate ? new Date(order.confirmedDeliveryDate).toLocaleDateString('tr-TR') : null;
    const lead = status === 'CANCELLED'
      ? `<strong>${esc(order.orderNo)}</strong> numaralı siparişiniz <strong>iptal edildi</strong>.`
      : `<strong>${esc(order.orderNo)}</strong> numaralı siparişiniz <strong>${esc(label)}</strong> aşamasına geçti.`;
    await sendMail({
      to: r.to,
      subject: `${order.company.name} · Siparişiniz ${status === 'CANCELLED' ? 'iptal edildi' : `güncellendi: ${label}`} (${order.orderNo})`,
      html: `
        <p>Merhaba ${esc(r.name ?? r.to)},</p>
        <p>${esc(order.company.name)} firmasına verdiğiniz ${lead}</p>
        <p>Miktar: <strong>${esc(formatQty(order.totalQuantity, order.unit))}</strong></p>
        ${note ? `<p>Not: ${esc(note)}</p>` : ''}
        ${termin && status !== 'CANCELLED' ? `<p>Termin: <strong>${termin}</strong></p>` : ''}
      `,
      text: `${order.company.name} · Sipariş ${order.orderNo}: ${status === 'CANCELLED' ? 'iptal edildi' : label}${note ? ` — ${note}` : ''}`,
    });
  } catch (e) {
    console.error('notifyOrderStatus', e);
  }
}

/** Satıcı siparişi onayladı: sipariş verene push + e-posta (termin varsa yazılır) */
export async function notifyOrderConfirmed(orderId: string, note?: string | null) {
  const o = await prisma.soleOrder.findUnique({ where: { id: orderId }, select: { confirmedDeliveryDate: true } }).catch(() => null);
  const termin = o?.confirmedDeliveryDate ? new Date(o.confirmedDeliveryDate).toLocaleDateString('tr-TR') : null;
  await pushToBuyer(
    orderId,
    (company, no) => `${company} · ${no}`,
    `Siparişiniz onaylandı${termin ? ` · Termin: ${termin}` : ''}${note ? ` — ${note}` : ''}`,
  );
  try {
    const r = await recipientOf(orderId);
    if (!r) return;
    const { order } = r;
    await sendMail({
      to: r.to,
      subject: `${order.company.name} · Siparişiniz onaylandı (${order.orderNo})`,
      html: `
        <p>Merhaba ${esc(r.name ?? r.to)},</p>
        <p>${esc(order.company.name)} firmasına verdiğiniz <strong>${esc(order.orderNo)}</strong> numaralı sipariş <strong>onaylandı</strong>.</p>
        <p>Miktar: <strong>${esc(formatQty(order.totalQuantity, order.unit))}</strong></p>
        ${termin ? `<p>Termin: <strong>${termin}</strong></p>` : ''}
        ${note ? `<p>Not: ${esc(note)}</p>` : ''}
      `,
      text: `${order.company.name} · Sipariş ${order.orderNo} onaylandı${termin ? `. Termin: ${termin}` : ''}`,
    });
  } catch (e) {
    console.error('notifyOrderConfirmed', e);
  }
}

/** Termin tarihi değişti (durum aynı): sipariş verene push + e-posta */
export async function notifyOrderTermin(orderId: string, date: Date | null) {
  const termin = date ? date.toLocaleDateString('tr-TR') : null;
  await pushToBuyer(orderId, (company, no) => `${company} · ${no}`, termin ? `Termin tarihi: ${termin}` : 'Termin tarihi kaldırıldı');
  try {
    const r = await recipientOf(orderId);
    if (!r) return;
    await sendMail({
      to: r.to,
      subject: `${r.order.company.name} · Termin güncellendi (${r.order.orderNo})`,
      html: `<p>Merhaba ${esc(r.name ?? r.to)},</p><p><strong>${esc(r.order.orderNo)}</strong> numaralı siparişinizin termin tarihi ${termin ? `<strong>${termin}</strong> olarak güncellendi` : 'kaldırıldı'}.</p>`,
      text: `Sipariş ${r.order.orderNo} termin: ${termin ?? 'kaldırıldı'}`,
    });
  } catch (e) {
    console.error('notifyOrderTermin', e);
  }
}

export async function notifyOrderShipped(orderId: string, s: { shipmentDate: Date | string; deliveryNoteNo?: string | null; carrier?: string | null; trackingNo?: string | null }, items?: ShippedLine[], partial = false) {
  const what = partial ? 'Siparişinizin bir kısmı sevk edildi' : 'Siparişiniz sevk edildi';
  await pushToBuyer(
    orderId,
    (company, no) => `${company} · ${no}`,
    `${what}${s.carrier ? ` (${s.carrier}${s.trackingNo ? ` ${s.trackingNo}` : ''})` : ''}`,
  );
  try {
    const r = await recipientOf(orderId);
    if (!r) return;
    const { order } = r;
    const row = (k: string, v?: string | null) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">${k}:</td><td><strong>${esc(v)}</strong></td></tr>` : '');
    await sendMail({
      to: r.to,
      subject: `${order.company.name} · ${what} (${order.orderNo})`,
      html: `
        <p>Merhaba ${esc(r.name ?? r.to)},</p>
        <p>${esc(order.company.name)} firmasına verdiğiniz <strong>${esc(order.orderNo)}</strong> numaralı sipariş${partial ? 'in bir kısmı' : ''} sevk edildi.</p>
        ${items?.length ? `<table style="border-collapse:collapse;margin-top:8px;font-size:13px;">
          <tr><th style="text-align:left;padding:4px 12px 4px 0;color:#666;">Ürün</th><th style="text-align:right;padding:4px 12px;color:#666;">${partial ? 'Kalan' : 'Sipariş'}</th><th style="text-align:right;padding:4px 12px;color:#666;">Sevk edilen</th><th style="text-align:right;padding:4px 0;color:#666;">Fark</th></tr>
          ${items.map(i => `<tr><td style="padding:4px 12px 4px 0;">${esc([i.productCode, i.productName].filter(Boolean).join(' '))}</td><td style="text-align:right;padding:4px 12px;">${esc(formatQty(i.ordered, i.unit))}</td><td style="text-align:right;padding:4px 12px;"><strong>${esc(formatQty(i.shipped, i.unit))}</strong></td><td style="text-align:right;padding:4px 0;">${esc(formatDiff(i.ordered, i.shipped, i.unit) || '—')}</td></tr>`).join('')}
        </table>` : ''}
        <table style="border-collapse:collapse;margin-top:12px;">
          ${row('Sevk Tarihi', new Date(s.shipmentDate).toLocaleDateString('tr-TR'))}
          ${row('İrsaliye No', s.deliveryNoteNo)}
          ${row('Taşıyıcı', s.carrier)}
          ${row('Takip No', s.trackingNo)}
        </table>
      `,
      text: `Sipariş ${order.orderNo} sevk edildi. İrsaliye: ${s.deliveryNoteNo ?? '-'}`,
    });
  } catch (e) {
    console.error('notifyOrderShipped', e);
  }
}

const VALID: OrderStatus[] = ['ORDER_RECEIVED', 'IN_PRODUCTION', 'MOLDING', 'PAINTING', 'PACKAGING', 'READY_FOR_SHIPMENT', 'SHIPPED', 'CANCELLED'];
export const isOrderStatus = (s: unknown): s is OrderStatus => typeof s === 'string' && (VALID as string[]).includes(s);

/**
 * Sevkiyatı kaydeder (kısmi sevkiyat destekli).
 * - shipmentId verilirse o sevkiyat düzenlenir; mode: 'new' ise yeni sevkiyat açılır;
 *   ikisi de yoksa (eski istemciler, mobil) son sevkiyat düzenlenir, hiç yoksa oluşturulur.
 * - Boş bırakılan kalem kalan miktar kadar sayılır (ilk sevkiyatta kalan = sipariş miktarı).
 * - final: son sevkiyat mı (verilmezse: eski istemcide evet, yeni sevkiyatta kalan 0 ise evet).
 *   Son sevkiyatta sipariş "Sevk Edildi" olur; kısmi sevkte durum değişmez, geçmişe ve müşteriye bildirilir.
 */
export async function saveShipment(order: {
  id: string; status: string; orderItems?: unknown; unit?: string | null; totalQuantity: number;
  productId?: string | null; productCode?: string | null;
}, s: {
  shipmentDate: string; deliveryNoteNo?: string | null; carrier?: string | null; trackingNo?: string | null; notes?: string | null;
  items?: Record<number, unknown> | Array<{ index: number; shipped: unknown }>;
  shipmentId?: string | null; mode?: 'new' | 'edit'; final?: boolean;
}) {
  if (order.status === 'CANCELLED') return { error: 'İptal edilmiş sipariş sevk edilemez' };
  const shipmentDate = new Date(s.shipmentDate);
  if (!s.shipmentDate || isNaN(shipmentDate.getTime())) return { error: 'Geçerli bir sevk tarihi girin' };
  const input: Record<number, unknown> = Array.isArray(s.items)
    ? Object.fromEntries(s.items.map(i => [Number(i?.index), i?.shipped]))
    : (s.items ?? {});

  const existing = await prisma.orderShipment.findMany({ where: { orderId: order.id }, orderBy: [{ shipmentDate: 'asc' }, { createdAt: 'asc' }] });
  const legacy = !s.shipmentId && s.mode !== 'new';
  const target = s.shipmentId
    ? existing.find(x => x.id === s.shipmentId)
    : legacy ? existing[existing.length - 1] : undefined;
  if (s.shipmentId && !target) return { error: 'Sevkiyat bulunamadı' };

  const lines = shipLines(order);
  const prior = shippedSoFar(existing.filter(x => x.id !== target?.id));
  const rem = remainingLines(lines, prior);
  if (rem.every(l => l.remaining <= 0) && !target) return { error: 'Siparişin tamamı sevk edildi' };
  // Boş kalem = kalan miktar; sevk satırı "sipariş" sütununda kalan miktarı taşır
  const built = buildShipped(rem.map(l => ({ ...l, ordered: l.remaining })), input);
  if ('error' in built) return { error: built.error };
  for (const it of built.items) {
    const r = rem.find(l => l.index === it.index)!;
    if (it.shipped > r.remaining * OVER_SHIP_FACTOR + 1e-9 && it.shipped > 0) {
      return { error: `${r.productCode || r.productName || 'Kalem'}: sevk miktarı kalan miktarın (${formatQty(r.remaining, r.unit)}) çok üzerinde` };
    }
  }
  const after = remainingLines(lines, { ...prior, ...Object.fromEntries(built.items.map(i => [i.index, (prior[i.index] ?? 0) + i.shipped])) });
  const final = typeof s.final === 'boolean' ? s.final : legacy ? true : after.every(l => l.remaining <= 0);

  const data = {
    shipmentDate,
    deliveryNoteNo: s.deliveryNoteNo?.trim().slice(0, 50) || null,
    trackingNo: s.trackingNo?.trim().slice(0, 100) || null,
    carrier: s.carrier?.trim().slice(0, 100) || null,
    notes: s.notes?.trim().slice(0, 500) || null,
    items: built.items as any,
    totalQuantity: built.total,
  };
  const orderId = order.id;
  const shipment = target
    ? await prisma.orderShipment.update({ where: { id: target.id }, data })
    : await prisma.orderShipment.create({ data: { orderId, ...data } });

  const allShipped = Math.round((Object.values(prior).reduce((a, b) => a + b, 0) + built.total) * 1000) / 1000;
  if (final && order.status !== 'SHIPPED') {
    const diff = formatDiff(order.totalQuantity, allShipped, order.unit);
    const note = [data.deliveryNoteNo ? `İrsaliye: ${data.deliveryNoteNo}` : 'Sevk edildi', `${formatQty(allShipped, order.unit)}${diff ? ` (${diff})` : ''}`].join(' · ');
    await prisma.soleOrder.update({
      where: { id: orderId },
      data: { status: 'SHIPPED', statusHistory: { create: { status: 'SHIPPED', note } } },
    });
    await notifyOrderShipped(orderId, data, built.items);
  } else if (!final && !target) {
    // Kısmi sevk: durum değişmez, geçmişe yazılır ve müşteriye bildirilir
    const note = `Kısmi sevk${data.deliveryNoteNo ? ` (İrsaliye: ${data.deliveryNoteNo})` : ''}: ${formatQty(built.total, order.unit)} · toplam ${formatQty(allShipped, order.unit)} / ${formatQty(order.totalQuantity, order.unit)}`;
    await prisma.orderStatusHistory.create({ data: { orderId, status: order.status as OrderStatus, note } });
    await notifyOrderShipped(orderId, data, built.items, true);
  }
  return { shipment };
}
