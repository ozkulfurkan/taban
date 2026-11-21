import { prisma } from '@/lib/prisma';
import { buildPushBatches, type PushMessage } from '@/lib/push-message';
import { writeOutbox } from '@/lib/outbox';

export { isExpoToken, type PushMessage } from '@/lib/push-message';

// Mobil anlık bildirim (Expo push servisi). Gönderim hiçbir zaman çağıran işlemi bozmaz:
// hata loglanır, sipariş/durum kaydı etkilenmez. Uygulamayı silen cihazların kayıtları temizlenir.
// EXPO_ACCESS_TOKEN tanımlıysa (expo.dev → Access tokens, "push security" açıksa gerekli) gönderilir.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

type Ticket = { status: 'ok' | 'error'; message?: string; details?: { error?: string } };

async function send(tokens: string[], msg: PushMessage) {
  if (writeOutbox({ kind: 'push', tokens, title: msg.title, body: msg.body, url: msg.url ?? null })) return;
  const batches = buildPushBatches(tokens, msg);
  const dead: string[] = [];
  for (const batch of batches) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(batch),
      });
      const json = await res.json().catch(() => null) as { data?: Ticket[] } | null;
      if (!res.ok) { console.error('push send', res.status, JSON.stringify(json)?.slice(0, 300)); continue; }
      json?.data?.forEach((t, i) => { if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(batch[i].to); });
    } catch (e) {
      console.error('push send', e);
    }
  }
  if (dead.length) await prisma.pushToken.deleteMany({ where: { token: { in: dead } } }).catch(() => {});
}

/** Bildirim kutusuna kayıt; hata loglanır, gönderimi ve çağıran işlemi bozmaz */
async function saveInbox(rows: Array<{ userId?: string; companyId?: string | null; portalCustomerId?: string }>, msg: PushMessage) {
  if (!rows.length) return;
  try {
    await prisma.notification.createMany({
      data: rows.map(r => ({ ...r, title: msg.title.slice(0, 200), body: msg.body.slice(0, 1000), url: msg.url ?? null })),
    });
  } catch (e) {
    console.error('notification inbox', e);
  }
}

/** Firma kullanıcılarına (verilen id'ler): bildirim kutusuna yazılır ve cihazlara gönderilir */
export async function pushToUsers(userIds: (string | null | undefined)[], msg: PushMessage) {
  try {
    const ids = Array.from(new Set(userIds.filter((x): x is string => !!x)));
    if (!ids.length) return;
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, companyId: true } });
    await saveInbox(users.map(u => ({ userId: u.id, companyId: u.companyId })), msg);
    const rows = await prisma.pushToken.findMany({ where: { userId: { in: ids } }, select: { token: true } });
    await send(rows.map(r => r.token), msg);
  } catch (e) {
    console.error('pushToUsers', e);
  }
}

/** Portal müşterisine: bildirim kutusuna yazılır ve cihazlarına gönderilir */
export async function pushToPortalCustomer(portalCustomerId: string | null | undefined, msg: PushMessage) {
  try {
    if (!portalCustomerId) return;
    await saveInbox([{ portalCustomerId }], msg);
    const rows = await prisma.pushToken.findMany({ where: { portalCustomerId }, select: { token: true } });
    await send(rows.map(r => r.token), msg);
  } catch (e) {
    console.error('pushToPortalCustomer', e);
  }
}

/** Firmada siparişleri görebilen kullanıcılar: sahip/yönetici ve "Siparişler" sayfa izni olanlar (web ile aynı kural) */
export async function orderRecipients(companyId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { companyId, OR: [{ role: { in: ['ADMIN', 'COMPANY_OWNER'] } }, { allowedPages: { has: 'orders' } }] },
    select: { id: true },
  });
  return users.map(u => u.id);
}
