import { test, expect, Page } from '@playwright/test';

// Satış, iade ve alış ekranları (yeni ve düzenleme) aynı ortak belge ekranını kullanır.

const RUN0 = Date.now().toString(36);
let n = 0;

async function fixtures(page: Page) {
  const RUN = `${RUN0}${n++}`;
  const post = async (url: string, data: any) => {
    const r = await page.request.post(url, { data });
    expect(r.ok(), `${url} ${await r.text()}`).toBeTruthy();
    return r.json();
  };
  const customer = await post('/api/customers', { name: `Belge Müşteri ${RUN}`, currency: 'USD' });
  const supplier = await post('/api/suppliers', { name: `Belge Tedarikçi ${RUN}`, currency: 'USD' });
  const product = await post('/api/products', { name: `Belge Taban ${RUN}`, code: `BT${RUN}`, unitPrice: 5, currency: 'USD', stock: 100 });
  const material = await post('/api/materials', { name: `Belge Kauçuk ${RUN}`, pricePerKg: 2, currency: 'USD' });
  return { customer, supplier, product, material, RUN };
}

async function expectSameLayout(page: Page) {
  await expect(page.getByRole('region', { name: 'Kalemler' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Elle Kalem Ekle' })).toBeVisible();
  await expect(page.getByText('Genel Toplam').last()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Geri$/ })).toBeVisible();
}

async function addFromSearch(page: Page, text: string, qty: string) {
  await page.getByRole('textbox', { name: /arayın/ }).fill(text);
  await page.getByRole('listbox').getByRole('option').first().click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[inputmode="decimal"]').first().fill(qty);
  await dialog.getByRole('button', { name: 'Ekle', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('satış, iade ve alış aynı ekran düzenini kullanır', async ({ page }) => {
  const f = await fixtures(page);
  for (const url of [`/invoices/new?customerId=${f.customer.id}`, `/invoices/return?customerId=${f.customer.id}`, `/purchases/new?supplierId=${f.supplier.id}`]) {
    await page.goto(url);
    await expectSameLayout(page);
  }
});

test('satış kaydı ve düzenleme aynı ekranda', async ({ page }) => {
  const f = await fixtures(page);
  const RUN = f.RUN;
  await page.goto(`/invoices/new?customerId=${f.customer.id}`);
  await addFromSearch(page, `BT${RUN}`, '3');
  await page.getByLabel('İrsaliye No').fill('IRS-UI');
  await page.getByRole('button', { name: 'Faturayı Kaydet' }).click();
  // Ürünün parça bilgisi yok ama stok yeterli: onay penceresi çıkmaz
  await expect(page).toHaveURL(new RegExp(`/customers/${f.customer.id}`));

  const list = await (await page.request.get(`/api/invoices?customerId=${f.customer.id}`)).json();
  expect(list).toHaveLength(1);
  expect(list[0].total).toBe(15);

  await page.goto(`/invoices/${list[0].id}`);
  await expect(page.getByText('IRS-UI')).toBeVisible();
  await page.getByRole('link', { name: 'Düzenle' }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${list[0].id}/edit`));
  await expectSameLayout(page);
  await page.getByRole('row', { name: new RegExp(`Belge Taban ${RUN}`) }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[inputmode="decimal"]').first().fill('4');
  await dialog.getByRole('button', { name: 'Güncelle' }).click();
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${list[0].id}$`));
  const inv = await (await page.request.get(`/api/invoices/${list[0].id}`)).json();
  expect(inv.total).toBe(20);
  expect(inv.irsaliyeNo).toBe('IRS-UI');
});

test('alış tedarikçi sayfasından aynı ekranla açılır, kaydedilir ve düzenlenir', async ({ page }) => {
  const f = await fixtures(page);
  const RUN = f.RUN;
  await page.goto(`/suppliers/${f.supplier.id}`);
  await page.getByRole('link', { name: /Yeni Alış|New Purchase/ }).click();
  await expect(page).toHaveURL(/\/purchases\/new\?supplierId=/);
  await addFromSearch(page, `Belge Kauçuk ${RUN}`, '10');
  await page.getByRole('button', { name: 'Alışı Kaydet' }).click();
  await expect(page).toHaveURL(new RegExp(`/suppliers/${f.supplier.id}`));

  const purchases = await (await page.request.get('/api/purchases')).json();
  const purchase = (purchases.items ?? purchases).find((p: any) => p.supplierId === f.supplier.id);
  expect(purchase.total).toBe(20);
  const mat = await (await page.request.get(`/api/materials/${f.material.id}`)).json();
  expect(mat.stock).toBe(10);

  await page.goto(`/purchases/${purchase.id}`);
  await page.getByRole('link', { name: 'Düzenle' }).click();
  await expectSameLayout(page);
  await addFromSearch(page, `BT${RUN}`, '2');
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();
  await expect(page).toHaveURL(new RegExp(`/purchases/${purchase.id}$`));
  const after = await (await page.request.get(`/api/purchases/${purchase.id}`)).json();
  expect(after.total).toBe(30); // 10 kg × 2 + 2 × 5
  expect(after.purchaseMaterials).toHaveLength(2);
});
