import { test, expect, APIRequestContext } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { prisma, RUN, createCompany, cleanup } from '../security/helpers';

// Portal hesabı açılınca doğrulama e-postası yanıt dönmeden gönderilir (sunucusuz ortamda kesilmesin)
// ve yanıt e-postanın gidip gitmediğini söyler. Gönderim NOTIFY_OUTBOX'tan okunur.
const OUTBOX = process.env.NOTIFY_OUTBOX;
test.skip(!OUTBOX, 'NOTIFY_OUTBOX tanımlı olmalı (sunucu ile aynı)');

const lines = () => (OUTBOX && existsSync(OUTBOX) ? readFileSync(OUTBOX, 'utf8').split('\n').filter(Boolean) : []);

let A: { companyId: string; owner: APIRequestContext };
test.beforeAll(async () => { A = await createCompany('mail-kayit'); });
test.afterAll(async () => { await cleanup(); });

test('portal hesabı: doğrulama e-postası yanıttan önce gönderilir, yanıtta emailSent var', async () => {
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Mail Müşteri ${RUN}` } });
  const email = `sec-mail-${Math.random().toString(36).slice(2, 7)}-${RUN}@test.local`;
  const n = lines().length;
  const r = await A.owner.post('/api/portal/auth/register', { data: { customerId: cust.id, email, password: 'Portal123' } });
  expect(r.status(), await r.text()).toBe(201);
  expect((await r.json()).emailSent).toBe(true);
  // Yanıt geldiğinde e-posta zaten yazılmış olmalı (beklemeden)
  const sent = lines().slice(n).map(l => JSON.parse(l)).filter(e => e.kind === 'mail' && e.to === email);
  expect(sent).toHaveLength(1);
  expect(sent[0].html).toContain('/portal/verify-email?token=');
});
