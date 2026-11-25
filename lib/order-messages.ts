// Sipariş içi mesajlaşma ve müşterinin iptal/değişiklik talepleri (portal müşterisi ↔ firma).
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { orderRecipients, pushToPortalCustomer, pushToUsers } from '@/lib/push';
import { pushToBuyer } from '@/lib/order-notify';

export const MESSAGE_KINDS = ['MESSAGE', 'CANCEL_REQUEST', 'CHANGE_REQUEST'] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];
export const MAX_MESSAGE = 2000;

export const MESSAGE_SELECT = {
  id: true, kind: true, authorType: true, authorName: true, body: true, createdAt: true,
  resolvedAt: true, resolution: true, readByStaffAt: true, readByCustomerAt: true,
} as const;

export const REQUEST_LABEL: Record<string, string> = { CANCEL_REQUEST: 'İptal talebi', CHANGE_REQUEST: 'Değişiklik talebi' };

export function cleanMessageBody(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s.slice(0, MAX_MESSAGE) : null;
}

/** Müşteri tarafı: talep açılabilir mi (onaylanmış, sevk/iptal edilmemiş, açık talebi olmayan sipariş) */
export async function requestError(order: { id: string; status: string; confirmedAt: Date | null }, kind: string): Promise<string | null> {
  if (kind === 'MESSAGE') return null;
  if (!(MESSAGE_KINDS as readonly string[]).includes(kind)) return 'Geçersiz talep';
  if (order.status === 'SHIPPED' || order.status === 'CANCELLED') return 'Sevk ya da iptal edilmiş siparişte talep açılamaz';
  const open = await prisma.orderMessage.count({ where: { orderId: order.id, kind: { in: ['CANCEL_REQUEST', 'CHANGE_REQUEST'] }, resolvedAt: null } });
  if (open) return 'Bu sipariş için yanıt bekleyen bir talebiniz var';
  return null;
}

const preview = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}…` : s);

/** Müşteri mesajı/talebi firmaya bildirilir (sipariş izni olan kullanıcılar) */
export async function notifyStaffOfMessage(orderId: string, kind: string, body: string) {
  try {
    const o = await prisma.soleOrder.findUnique({ where: { id: orderId }, select: { companyId: true, orderNo: true, customer: { select: { name: true } } } });
    if (!o) return;
    const ids = await orderRecipients(o.companyId);
    const what = kind === 'CANCELLED' ? 'İptal' : REQUEST_LABEL[kind] ?? 'Yeni mesaj';
    await pushToUsers(ids, { title: `${o.customer?.name ?? 'Müşteri'} · ${o.orderNo}`, body: `${what}: ${preview(body)}`, url: `/siparis/gelen/${orderId}` });
  } catch (e) {
    console.error('notifyStaffOfMessage', e);
  }
}

/**
 * Firma mesajı ya da talep yanıtı karşı tarafa bildirilir: firma ağı siparişinde alıcı firmanın sipariş görenlerine
 * (pushToBuyer), portal siparişinde siparişi veren portal müşterisine (yoksa aynı müşterinin portal hesaplarına).
 */
export async function notifyCustomerOfMessage(orderId: string, text: string) {
  try {
    const o = await prisma.soleOrder.findUnique({
      where: { id: orderId },
      select: { orderNo: true, companyId: true, customerId: true, portalCustomerId: true, linkId: true, company: { select: { name: true } } },
    });
    if (!o) return;
    if (o.linkId && !o.portalCustomerId) {
      await pushToBuyer(orderId, (company, no) => `${company} · ${no}`, preview(text));
      return;
    }
    const targets = o.portalCustomerId
      ? [o.portalCustomerId]
      : (await prisma.portalCustomer.findMany({ where: { companyId: o.companyId, customerId: o.customerId, isActive: true }, select: { id: true } })).map(p => p.id);
    for (const id of targets) await pushToPortalCustomer(id, { title: `${o.company.name} · ${o.orderNo}`, body: preview(text), url: `/siparisler/${orderId}` });
  } catch (e) {
    console.error('notifyCustomerOfMessage', e);
  }
}

/** Firma listeleri için: okunmamış müşteri mesajı sayısı ve açık talep */
export const STAFF_MESSAGE_INCLUDE = {
  _count: { select: { messages: { where: { authorType: 'customer', readByStaffAt: null } } } },
  messages: { where: { kind: { in: ['CANCEL_REQUEST', 'CHANGE_REQUEST'] }, resolvedAt: null }, select: { kind: true }, take: 1 },
} satisfies Prisma.SoleOrderInclude;
export function withMessageInfo(o: any) {
  const { _count, messages, ...rest } = o as any;
  return { ...rest, unreadMessages: _count?.messages ?? 0, openRequest: messages?.[0]?.kind ?? null };
}

/**
 * Siparişin mesajlaşabileceği karşı taraf: firma ağı (alıcı firma), portal (siparişi veren ya da müşterinin aktif portal
 * hesabı) ya da yok. Karşı taraf yoksa mesaj kutusu gösterilmez ve firma mesajı kabul edilmez.
 */
export async function messageCounterparty(o: { linkId?: string | null; portalCustomerId?: string | null; companyId: string; customerId: string }): Promise<'network' | 'portal' | null> {
  if (o.linkId) {
    const link = await prisma.companyLink.findUnique({ where: { id: o.linkId }, select: { status: true } }).catch(() => null);
    if (link?.status === 'ACTIVE') return 'network';
  }
  if (o.portalCustomerId) return 'portal';
  const n = await prisma.portalCustomer.count({ where: { companyId: o.companyId, customerId: o.customerId, isActive: true } });
  return n > 0 ? 'portal' : null;
}
