import { test, expect, APIRequestContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { prisma, RUN, createCompany, createUser, loggedIn, newClient, cleanup } from '../security/helpers';

// Günlük özet e-postası: secret, firma ayarı, alıcılar ve firma ayrımı. Gönderim NOTIFY_OUTBOX'tan okunur.
const OUTBOX = process.env.NOTIFY_OUTBOX;
const SECRET = process.env.CRON_SECRET;
test.skip(!OUTBOX || !SECRET, 'NOTIFY_OUTBOX ve CRON_SECRET tanımlı olmalı (sunucu ile aynı)');

type Mail = { kind: string; to?: string | string[]; subject?: string; html?: string };
const count = () => (OUTBOX && existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean).length : 0);
const after = (n: number): Mail[] => (OUTBOX && existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean).slice(n).map(l => JSON.parse(l)) : []);

let X: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let Y: { companyId: string; owner: APIRequestContext; ownerEmail: string };
let anon: APIRequestContext;

test.beforeAll(async () => {
  X = await createCompany('ozet-x');
  Y = await createCompany('ozet-y');
  anon = await newClient();
});
test.afterAll(async () => { await anon.dispose(); await cleanup(); });

const run = (...ids: string[]) => anon.get(`/api/cron/daily-summary?${ids.map(i => `companyId=${i}`).join('&')}`, { headers: { Authorization: `Bearer ${SECRET}` } });

test('secret olmadan çalışmaz', async () => {
  expect((await anon.get('/api/cron/daily-summary')).status()).toBe(401);
  expect((await anon.get('/api/cron/daily-summary', { headers: { Authorization: 'Bearer yanlis' } })).status()).toBe(401);
});

test('özet yalnızca kendi firmasının siparişlerini ve hesaplarını içerir; sahibe gider, düzenleyiciye gitmez', async () => {
  const editorEmail = await createUser(X.companyId, `ozet-ed-${RUN}`, 'EDITOR');
  const cx = await prisma.customer.create({ data: { companyId: X.companyId, name: `Özet Müşteri X ${RUN}` } });
  const cy = await prisma.customer.create({ data: { companyId: Y.companyId, name: `Özet Müşteri Y ${RUN}` } });
  await prisma.soleOrder.create({ data: { companyId: X.companyId, customerId: cx.id, orderNo: `OZX-${RUN}`, sizeDistribution: { '40': 10 }, totalQuantity: 10, confirmedDeliveryDate: new Date(Date.now() - 3 * 864e5) } });
  await prisma.soleOrder.create({ data: { companyId: Y.companyId, customerId: cy.id, orderNo: `OZY-${RUN}`, sizeDistribution: { '40': 10 }, totalQuantity: 10 } });
  const acc = await prisma.account.create({ data: { companyId: X.companyId, name: `Kasa X ${RUN}`, type: 'Kasa', currency: 'TRY', balance: 1234.5 } });
  await prisma.payment.create({ data: { companyId: X.companyId, type: 'RECEIVED', customerId: cx.id, accountId: acc.id, amount: 300, currency: 'TRY', date: new Date(Date.now() - 864e5) } as any });

  const n = count();
  const r = await run(X.companyId, Y.companyId);
  expect(r.status(), await r.text()).toBe(200);
  expect((await r.json()).sent).toBe(2);
  const mails = after(n).filter(e => e.kind === 'mail');
  const mx = mails.find(m => (Array.isArray(m.to) ? m.to : [m.to]).includes(X.ownerEmail))!;
  expect(mx).toBeTruthy();
  expect((Array.isArray(mx.to) ? mx.to : [mx.to])).not.toContain(editorEmail);
  expect(mx.subject).toContain('Günlük özet');
  expect(mx.html).toContain(`OZX-${RUN}`);
  expect(mx.html).toContain('Gecikti');
  expect(mx.html).toContain(`Kasa X ${RUN}`);
  expect(mx.html).toContain('1.234,50 TRY');
  expect(mx.html).not.toContain(`OZY-${RUN}`);
  expect(mx.html).not.toContain(`Özet Müşteri Y`);
});

test('ayar kapalıysa gönderilmez; yalnızca sahip/yönetici değiştirebilir', async () => {
  const editor = await loggedIn(await createUser(Y.companyId, `ozet-y-ed-${RUN}`, 'EDITOR'));
  expect((await editor.put('/api/company', { data: { dailySummaryEmail: false } })).status()).toBe(403);
  expect((await Y.owner.put('/api/company', { data: { dailySummaryEmail: false } })).status()).toBe(200);
  expect((await (await Y.owner.get('/api/company')).json()).dailySummaryEmail).toBe(false);

  const n = count();
  const r = await run(Y.companyId);
  expect((await r.json()).sent).toBe(0);
  expect(after(n).filter(e => e.kind === 'mail')).toHaveLength(0);
  await editor.dispose();
});
