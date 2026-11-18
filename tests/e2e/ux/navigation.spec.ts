import { test, expect, Page } from '@playwright/test';

// "Geri" bağlantıları tarayıcı geçmişine değil sabit üst sayfaya gider;
// kaydet sonrası düzenleme ekranı geçmişte kalmaz (eski döngü: detay ↔ düzenleme).

const RUN = Date.now().toString(36);

async function post(page: Page, url: string, data: any) {
  const r = await page.request.post(url, { data });
  expect(r.ok(), `${url} ${await r.text()}`).toBeTruthy();
  return r.json();
}

test('satış düzenlendikten sonra geri müşteri sayfasına gider, döngü yok', async ({ page }) => {
  const c = await post(page, '/api/customers', { name: `Geri Müşteri ${RUN}`, currency: 'USD' });
  const inv = await post(page, '/api/invoices', { customerId: c.id, items: [{ description: 'Taban', quantity: 2, unitPrice: 5 }] });

  await page.goto(`/customers/${c.id}`);
  await page.goto(`/invoices/${inv.id}`);
  await page.getByRole('link', { name: 'Düzenle' }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${inv.id}/edit`));
  // Cari adı, müşteri listesinin ilk sayfasında olmasa da düzenleme ekranında görünür
  await expect(page.getByRole('link', { name: `Müşteri: Geri Müşteri ${RUN} sayfasına dön` })).toBeVisible();
  await page.getByRole('button', { name: 'Değişiklikleri Kaydet' }).click();
  await expect(page).toHaveURL(new RegExp(`/invoices/${inv.id}$`));

  // Tarayıcı geri tuşu düzenleme ekranına dönmemeli
  await page.goBack();
  await expect(page).not.toHaveURL(/\/edit$/);
  await page.goto(`/invoices/${inv.id}`);

  const back = page.getByRole('link', { name: `Müşteri: Geri Müşteri ${RUN} sayfasına dön` });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`/customers/${c.id}$`));
  // Müşteri sayfasındaki geri bağlantısı listeye gider
  await page.getByRole('link', { name: 'Müşteriler sayfasına dön' }).click();
  await expect(page).toHaveURL(/\/customers$/);
});

test('alış detayı ve düzenleme ekranı tedarikçi sayfasına döner', async ({ page }) => {
  const s = await post(page, '/api/suppliers', { name: `Geri Tedarikçi ${RUN}`, currency: 'USD' });
  const m = await post(page, '/api/materials', { name: `Geri Kauçuk ${RUN}`, pricePerKg: 1, currency: 'USD' });
  const p = await post(page, '/api/purchases', { supplierId: s.id, items: [{ materialId: m.id, qty: 1, unitPrice: 1 }] });

  await page.goto(`/purchases/${p.id}/edit`);
  await page.getByRole('link', { name: `Tedarikçi: Geri Tedarikçi ${RUN} sayfasına dön` }).click();
  await expect(page).toHaveURL(new RegExp(`/suppliers/${s.id}$`));

  await page.goto(`/purchases/${p.id}`);
  await page.getByRole('link', { name: `Tedarikçi: Geri Tedarikçi ${RUN} sayfasına dön` }).click();
  await expect(page).toHaveURL(new RegExp(`/suppliers/${s.id}$`));
});

test('ekstre müşteri sayfasına döner; değişiklik varken çıkış uyarısı çıkar', async ({ page }) => {
  const c = await post(page, '/api/customers', { name: `Ekstre Müşteri ${RUN}`, currency: 'TRY' });
  await page.goto(`/customers/${c.id}/ekstre`);
  await page.getByRole('link', { name: new RegExp(`Müşteri: Ekstre Müşteri ${RUN}`) }).click();
  await expect(page).toHaveURL(new RegExp(`/customers/${c.id}$`));

  await page.goto(`/invoices/new?customerId=${c.id}`);
  await page.getByLabel('Notlar').fill('yarım');
  await page.getByRole('link', { name: new RegExp(`Müşteri: Ekstre Müşteri ${RUN}`) }).click();
  await expect(page.getByText('Kaydedilmemiş değişiklikler var')).toBeVisible();
  await page.getByRole('button', { name: 'Çık' }).click();
  await expect(page).toHaveURL(new RegExp(`/customers/${c.id}$`));
});
