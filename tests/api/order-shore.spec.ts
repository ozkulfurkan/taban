import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import { prisma, RUN, PASSWORD, createCompany, createPortalCustomer, loggedIn, cleanup } from '../security/helpers';

// Hammadde siparişinde renk yerine shore: seviye (Yumuşak/Standart/Sert) + değer (varsayılan 65, ±2).
test.afterAll(async () => { await cleanup(); });

test('hammadde siparişi: shore kaydedilir, varsayılan Standart · 65, geçersiz değer reddedilir, renk tutulmaz', async () => {
  const A = await createCompany('shore');
  const cust = await prisma.customer.create({ data: { companyId: A.companyId, name: `Shore Müşteri ${RUN}` } });
  const kg = await prisma.product.create({ data: { companyId: A.companyId, name: `PVC Granül ${RUN}`, code: 'PVC', unit: 'kg', portalVisible: true } as any });
  const portal = await loggedIn(await createPortalCustomer(cust.id, 'shore-p'), PASSWORD, 'portal-credentials');
  const order = (item: Record<string, unknown>) => portal.post('/api/portal/me/orders', { data: { orderItems: [{ productId: kg.id, quantity: 250, ...item }] } });

  const outbox = process.env.NOTIFY_OUTBOX;
  const before = outbox && existsSync(outbox) ? readFileSync(outbox, 'utf8').split('\n').filter(Boolean).length : 0;
  const r1 = await order({ color: 'Mavi', shoreLevel: 'Sert', shoreValue: 70 });
  expect(r1.status(), await r1.text()).toBe(201);
  const o1 = await prisma.soleOrder.findUniqueOrThrow({ where: { id: (await r1.json()).id } });
  const item1 = (o1.orderItems as any[])[0];
  expect(item1).toMatchObject({ shoreLevel: 'Sert', shoreValue: 70, color: '', unit: 'kg', quantity: 250 });

  const r2 = await order({});
  expect(r2.status()).toBe(201);
  const o2 = await prisma.soleOrder.findUniqueOrThrow({ where: { id: (await r2.json()).id } });
  expect((o2.orderItems as any[])[0]).toMatchObject({ shoreLevel: 'Standart', shoreValue: 65 });

  expect((await order({ shoreLevel: 'Sert', shoreValue: 150 })).status()).toBe(400);

  // Üretim emri e-postasında renk yerine shore ve ±2 notu
  if (outbox) {
    const mails = readFileSync(outbox, 'utf8').split('\n').filter(Boolean).slice(before).map(l => JSON.parse(l)).filter(e => e.kind === 'mail');
    const html = mails.map(m => m.html as string).join('\n');
    expect(html).toContain('Sert · 70 Shore (±2)');
    expect(html).toContain('±2 oynayabilir');
  }
  await portal.dispose();
});
