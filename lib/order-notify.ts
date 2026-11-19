import type { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';
import { statusLabel } from '@/lib/order-status';
import { formatQty } from '@/lib/order-units';

// Sipariş durumu değişince siparişi verene e-posta: portal müşterisi ya da bağlı SoleCost
// firmasında siparişi veren kullanıcı. Tüm durum değiştiren uçlar bunu kullanır.

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

async function recipientOf(orderId: string) {
  const order = await prisma.soleOrder.findUnique({
    where: { id: orderId },
    select: {
      orderNo: true, unit: true, totalQuantity: true, buyerUserId: true, confirmedDeliveryDate: true,
      company: { select: { name: true } },
      portalCustomer: { select: { email: true, name: true } },
      link: { select: { status: true } },
    },
  });
  if (!order) return null;
  if (order.portalCustomer) return { order, to: order.portalCustomer.email, name: order.portalCustomer.name };
  if (order.buyerUserId) {
    const u = await prisma.user.findUnique({ where: { id: order.buyerUserId }, select: { email: true, name: true } });
    if (u?.email) return { order, to: u.email, name: u.name };
  }
  return null;
}

export async function notifyOrderStatus(orderId: string, status: string, note?: string | null) {
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

export async function notifyOrderShipped(orderId: string, s: { shipmentDate: Date | string; deliveryNoteNo?: string | null; carrier?: string | null; trackingNo?: string | null }) {
  try {
    const r = await recipientOf(orderId);
    if (!r) return;
    const { order } = r;
    const row = (k: string, v?: string | null) => (v ? `<tr><td style="padding:4px 12px 4px 0;color:#666;">${k}:</td><td><strong>${esc(v)}</strong></td></tr>` : '');
    await sendMail({
      to: r.to,
      subject: `${order.company.name} · Siparişiniz sevk edildi (${order.orderNo})`,
      html: `
        <p>Merhaba ${esc(r.name ?? r.to)},</p>
        <p>${esc(order.company.name)} firmasına verdiğiniz <strong>${esc(order.orderNo)}</strong> numaralı sipariş (${esc(formatQty(order.totalQuantity, order.unit))}) sevk edildi.</p>
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

/** Sevkiyatı kaydeder; sipariş henüz sevk edilmediyse durumu SHIPPED yapar, geçmişe yazar ve bildirir */
export async function saveShipment(orderId: string, currentStatus: string, s: {
  shipmentDate: string; deliveryNoteNo?: string | null; carrier?: string | null; trackingNo?: string | null; notes?: string | null;
}) {
  const shipmentDate = new Date(s.shipmentDate);
  if (!s.shipmentDate || isNaN(shipmentDate.getTime())) return { error: 'Geçerli bir sevk tarihi girin' };
  const data = {
    shipmentDate,
    deliveryNoteNo: s.deliveryNoteNo?.trim() || null,
    trackingNo: s.trackingNo?.trim() || null,
    carrier: s.carrier?.trim() || null,
    notes: s.notes?.trim() || null,
  };
  const shipment = await prisma.orderShipment.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
  if (currentStatus !== 'SHIPPED') {
    await prisma.soleOrder.update({
      where: { id: orderId },
      data: {
        status: 'SHIPPED',
        statusHistory: { create: { status: 'SHIPPED', note: data.deliveryNoteNo ? `İrsaliye: ${data.deliveryNoteNo}` : 'Sevk edildi' } },
      },
    });
    await notifyOrderShipped(orderId, data);
  }
  return { shipment };
}
