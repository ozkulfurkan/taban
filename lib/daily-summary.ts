import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mail';
import { esc } from '@/lib/order-email';
import { formatQty } from '@/lib/order-units';
import { stageLabel } from '@/lib/order-status';

// Günlük özet e-postası (her sabah TR 10:00): bekleyen siparişler ve kasa/banka detayı.
// Firma ayarlardan kapatabilir (Company.dailySummaryEmail). Alıcılar: firma sahibi ve yöneticiler.

export const PENDING_STATUSES = ['ORDER_RECEIVED', 'IN_PRODUCTION', 'MOLDING', 'PAINTING', 'PACKAGING', 'READY_FOR_SHIPMENT'] as const;
const TR_OFFSET_MS = 3 * 60 * 60 * 1000; // Türkiye sabit UTC+3

/** Türkiye saatine göre günün başlangıcı (UTC Date) */
export function trDayStart(now: Date, addDays = 0) {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  return new Date(Date.UTC(tr.getUTCFullYear(), tr.getUTCMonth(), tr.getUTCDate() + addDays) - TR_OFFSET_MS);
}

export type PendingOrder = {
  id: string; orderNo: string; customerName: string; productName: string; productCode: string | null; totalQuantity: number; unit: string | null;
  status: string; confirmedAt: Date | null; dueDate: Date | null; isOverdue: boolean; isDueToday: boolean; isDueSoon: boolean;
};

/** Bekleyen siparişler: geciken → bugün → 3 gün içinde → diğerleri (panel ve e-posta aynı kural) */
export async function pendingOrders(companyId: string, now = new Date()): Promise<PendingOrder[]> {
  const today = trDayStart(now);
  const tomorrow = trDayStart(now, 1);
  const soon = trDayStart(now, 3);
  const orders = await prisma.soleOrder.findMany({
    where: { companyId, status: { in: [...PENDING_STATUSES] } },
    include: { customer: { select: { name: true } }, product: { select: { name: true, code: true } } },
    orderBy: [{ confirmedDeliveryDate: 'asc' }, { requestedDeliveryDate: 'asc' }, { createdAt: 'desc' }],
  });
  const mapped = orders.map(o => {
    const dueDate = o.confirmedDeliveryDate ?? o.requestedDeliveryDate ?? null;
    return {
      id: o.id, orderNo: o.orderNo, customerName: o.customer?.name ?? '—',
      productName: o.product?.name ?? o.productCode ?? '—', productCode: o.product?.code ?? o.productCode ?? null, totalQuantity: o.totalQuantity, unit: o.unit ?? null,
      status: o.status, confirmedAt: o.confirmedAt ?? null, dueDate,
      isOverdue: !!dueDate && dueDate < today,
      isDueToday: !!dueDate && dueDate >= today && dueDate < tomorrow,
      isDueSoon: !!dueDate && dueDate >= tomorrow && dueDate < soon,
    };
  });
  const urgency = (o: PendingOrder) => (o.isOverdue ? 0 : o.isDueToday ? 1 : o.isDueSoon ? 2 : 3);
  return mapped.sort((a, b) => urgency(a) - urgency(b));
}

export type AccountLine = { id: string; name: string; type: string; currency: string; balance: number; inflow: number; outflow: number };
export type DailySummary = {
  companyName: string; date: Date;
  orders: PendingOrder[];
  accounts: AccountLine[];
  sales: Record<string, number>; // dünkü satış (para birimine göre)
  collections: Record<string, number>; // dünkü tahsilat (cari para biriminde)
};

/** Firmanın özet verisi: bekleyen siparişler, hesap bakiyeleri ve dünün hareketleri */
export async function buildDailySummary(companyId: string, now = new Date()): Promise<DailySummary | null> {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) return null;
  const from = trDayStart(now, -1);
  const to = trDayStart(now);
  const [orders, accounts, payments, invoices] = await Promise.all([
    pendingOrders(companyId, now),
    prisma.account.findMany({ where: { companyId }, orderBy: [{ type: 'asc' }, { name: 'asc' }] }),
    prisma.payment.findMany({ where: { companyId, date: { gte: from, lt: to } }, select: { type: true, accountId: true, amount: true, currency: true, originalAmount: true, originalCurrency: true, customerId: true } }),
    prisma.invoice.findMany({ where: { companyId, date: { gte: from, lt: to } }, select: { total: true, currency: true, isReturn: true } }),
  ]);
  const flow = new Map<string, { inflow: number; outflow: number }>();
  const collections: Record<string, number> = {};
  for (const p of payments) {
    if (p.type === 'RECEIVED' && p.customerId) collections[p.currency] = (collections[p.currency] ?? 0) + p.amount;
    if (!p.accountId) continue;
    // Hesaba giren/çıkan tutar hesabın dövizinde: farklı dövizli işlemde asıl tutar
    const amt = p.originalAmount ?? p.amount;
    const f = flow.get(p.accountId) ?? { inflow: 0, outflow: 0 };
    if (p.type === 'RECEIVED') f.inflow += amt; else f.outflow += amt;
    flow.set(p.accountId, f);
  }
  const sales: Record<string, number> = {};
  for (const i of invoices) sales[i.currency] = (sales[i.currency] ?? 0) + (i.isReturn ? -i.total : i.total);
  return {
    companyName: company.name,
    date: now,
    orders,
    accounts: accounts.map(a => ({ id: a.id, name: a.name, type: a.type, currency: a.currency, balance: a.balance, ...(flow.get(a.id) ?? { inflow: 0, outflow: 0 }) })),
    sales,
    collections,
  };
}

const money = (n: number, cur: string) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const day = (d: Date) => new Date(d.getTime() + TR_OFFSET_MS).toISOString().slice(0, 10).split('-').reverse().join('.');
const perCurrency = (r: Record<string, number>) => Object.entries(r).filter(([, v]) => Math.abs(v) >= 0.005).map(([c, v]) => money(v, c)).join(' · ') || '—';
const BORDO = '#6B1A2C';

/** E-posta HTML'i (saf fonksiyon: test edilebilir; tüm metinler kaçışlı) */
export function summaryHtml(s: DailySummary, settingsUrl: string) {
  const th = 'style="text-align:left;padding:6px 8px;border-bottom:1px solid #EDE2E5;color:#6B5B60;font-size:12px;font-weight:600"';
  const td = 'style="padding:6px 8px;border-bottom:1px solid #F3ECEE;font-size:13px"';
  const tdr = 'style="padding:6px 8px;border-bottom:1px solid #F3ECEE;font-size:13px;text-align:right;white-space:nowrap"';
  const overdue = s.orders.filter(o => o.isOverdue).length;
  const today = s.orders.filter(o => o.isDueToday).length;
  const waiting = s.orders.filter(o => o.status === 'ORDER_RECEIVED' && !o.confirmedAt).length;
  const shown = s.orders.slice(0, 25);
  const flag = (o: PendingOrder) => (o.isOverdue ? '<b style="color:#B42318">Gecikti</b>' : o.isDueToday ? '<b style="color:#A15C07">Bugün</b>' : o.isDueSoon ? 'Yakında' : '');

  const totals: Record<string, number> = {};
  for (const a of s.accounts) totals[a.currency] = (totals[a.currency] ?? 0) + a.balance;

  return `<!doctype html><html lang="tr"><body style="margin:0;background:#F6F3F4;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1F1418">
<div style="max-width:680px;margin:0 auto;padding:20px">
  <div style="background:${BORDO};color:#fff;border-radius:14px;padding:18px 20px">
    <div style="font-size:12px;letter-spacing:2px;font-weight:700;opacity:.85">SOLE COST · GÜNLÜK ÖZET</div>
    <div style="font-size:20px;font-weight:700;margin-top:4px">${esc(s.companyName)}</div>
    <div style="font-size:13px;opacity:.85">${day(s.date)}</div>
  </div>

  <div style="background:#fff;border-radius:14px;padding:16px 20px;margin-top:14px">
    <div style="font-size:16px;font-weight:700;color:${BORDO}">Bekleyen siparişler (${s.orders.length})</div>
    <div style="font-size:13px;color:#6B5B60;margin:4px 0 10px">${overdue} geciken · ${today} bugün teslim · ${waiting} onay bekliyor</div>
    ${shown.length ? `<table style="width:100%;border-collapse:collapse">
      <tr><th ${th}>Sipariş</th><th ${th}>Müşteri / ürün</th><th ${th}>Durum</th><th ${th} style="text-align:right">Miktar</th><th ${th}>Termin</th></tr>
      ${shown.map(o => `<tr><td ${td}><b>${esc(o.orderNo)}</b></td><td ${td}>${esc(o.customerName)}<br><span style="color:#6B5B60;font-size:12px">${esc(o.productName)}</span></td><td ${td}>${esc(stageLabel(o))}</td><td ${tdr}>${esc(formatQty(o.totalQuantity, o.unit))}</td><td ${td}>${o.dueDate ? day(o.dueDate) : '—'} ${flag(o)}</td></tr>`).join('')}
    </table>${s.orders.length > shown.length ? `<div style="font-size:12px;color:#6B5B60;margin-top:6px">+${s.orders.length - shown.length} sipariş daha</div>` : ''}` : '<div style="font-size:13px;color:#6B5B60">Bekleyen sipariş yok.</div>'}
  </div>

  <div style="background:#fff;border-radius:14px;padding:16px 20px;margin-top:14px">
    <div style="font-size:16px;font-weight:700;color:${BORDO}">Kasa ve banka</div>
    ${s.accounts.length ? `<table style="width:100%;border-collapse:collapse;margin-top:8px">
      <tr><th ${th}>Hesap</th><th ${th} style="text-align:right">Dün giriş</th><th ${th} style="text-align:right">Dün çıkış</th><th ${th} style="text-align:right">Bakiye</th></tr>
      ${s.accounts.map(a => `<tr><td ${td}>${esc(a.name)}<br><span style="color:#6B5B60;font-size:12px">${esc(a.type)}</span></td><td ${tdr}>${a.inflow ? `<span style="color:#157046">+${money(a.inflow, a.currency)}</span>` : '—'}</td><td ${tdr}>${a.outflow ? `<span style="color:#B42318">−${money(a.outflow, a.currency)}</span>` : '—'}</td><td ${tdr}><b>${money(a.balance, a.currency)}</b></td></tr>`).join('')}
      <tr><td ${td}><b>Toplam</b></td><td ${td}></td><td ${td}></td><td ${tdr}><b>${perCurrency(totals)}</b></td></tr>
    </table>` : '<div style="font-size:13px;color:#6B5B60;margin-top:6px">Kayıtlı kasa / banka hesabı yok.</div>'}
    <div style="font-size:13px;color:#6B5B60;margin-top:10px">Dünkü satış: <b style="color:#1F1418">${perCurrency(s.sales)}</b> · Dünkü tahsilat: <b style="color:#1F1418">${perCurrency(s.collections)}</b></div>
  </div>

  <div style="font-size:12px;color:#9A8A90;text-align:center;margin-top:16px;line-height:1.6">
    Bu e-posta her sabah SoleCost tarafından gönderilir.<br>
    Almak istemiyorsanız <a href="${esc(settingsUrl)}" style="color:${BORDO}">Ayarlar</a> bölümünden "Günlük özet e-postası"nı kapatabilirsiniz.
  </div>
</div></body></html>`;
}

/** Ayarı açık tüm firmalara özet gönderir; gönderilen firma sayısını döndürür */
export async function sendDailySummaries(now = new Date()) {
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://www.solecost.com';
  const companies = await prisma.company.findMany({
    where: { dailySummaryEmail: true, deletionScheduledAt: null },
    select: { id: true, users: { where: { role: { in: ['ADMIN', 'COMPANY_OWNER'] }, deletionScheduledAt: null }, select: { email: true } } },
  });
  let sent = 0;
  for (const c of companies) {
    const to = c.users.map(u => u.email).filter(Boolean);
    if (!to.length) continue;
    try {
      const s = await buildDailySummary(c.id, now);
      if (!s) continue;
      await sendMail({
        to,
        subject: `${s.companyName} · Günlük özet ${day(now)} · ${s.orders.length} bekleyen sipariş`,
        html: summaryHtml(s, `${baseUrl}/settings`),
      });
      sent++;
    } catch (e) {
      console.error('daily-summary', c.id, e);
    }
  }
  return { companies: companies.length, sent };
}
