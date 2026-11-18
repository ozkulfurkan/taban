import { test, expect } from '@playwright/test';

// Ekstrede tutarlar carinin dövizinde yazar (USD cariye "TL" yazılmamalı).

const RUN = Date.now().toString(36);

test('USD tedarikçi ve müşteri ekstresi USD gösterir', async ({ page }) => {
  const sup = await (await page.request.post('/api/suppliers', { data: { name: `Ekstre USD Ted ${RUN}`, currency: 'USD' } })).json();
  const mat = await (await page.request.post('/api/materials', { data: { name: `Ekstre Mal ${RUN}`, pricePerKg: 2, currency: 'USD' } })).json();
  await page.request.post('/api/purchases', { data: { supplierId: sup.id, items: [{ materialId: mat.id, qty: 10, unitPrice: 2 }] } });

  await page.goto(`/suppliers/${sup.id}/ekstre`);
  const table = page.locator('table').first();
  await expect(table).toContainText('20,00 USD');
  await expect(table).not.toContainText(' TL');
  await expect(page.getByText('20,00 USD').first()).toBeVisible();

  const cus = await (await page.request.post('/api/customers', { data: { name: `Ekstre USD Mus ${RUN}`, currency: 'USD' } })).json();
  await page.request.post('/api/invoices', { data: { customerId: cus.id, items: [{ description: 'Taban', quantity: 3, unitPrice: 5 }] } });
  await page.goto(`/customers/${cus.id}/ekstre`);
  await expect(page.locator('table').first()).toContainText('15,00 USD');
  await expect(page.locator('table').first()).not.toContainText('TRY');
});
