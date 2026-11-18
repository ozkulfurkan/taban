import { test, expect } from '@playwright/test';

// Kullanılabilirlik hızlı kazanımları: büyük tutarın karta sığması, silmenin
// "⋯" menüsünde olması, yapışkan kaydet çubuğu, çıkış uyarısı, ondalık giriş.

const RUN = Date.now();

test('büyük tutar müşteri kartına sığar, silme menünün içindedir', async ({ page }) => {
  const c = await (await page.request.post('/api/customers', { data: { name: `Büyük Bakiye ${RUN}`, currency: 'TRY' } })).json();
  const inv = await page.request.post('/api/invoices', {
    data: { customerId: c.id, vatRate: 0, items: [{ description: 'Taban', quantity: 100000, unitPrice: 99999999 }] },
  });
  expect(inv.ok()).toBeTruthy();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/customers/${c.id}`);
  const amount = page.getByTitle('9.999.999.900.000,00').first();
  await expect(amount).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => amount.evaluate(el => el.scrollWidth <= el.clientWidth + 1), { message: 'tutar kutudan taşmamalı' }).toBe(true);
  // Sayfa yatay kaymamalı
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await expect(page.getByRole('button', { name: 'Müşteriyi Sil' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Diğer işlemler' }).click();
  await expect(page.getByRole('menuitem', { name: 'Müşteriyi Sil' })).toBeVisible();
});

test('ürün listesinde satır menüsü tablonun içinde kesilmez', async ({ page }) => {
  await page.goto('/products');
  const menus = page.getByRole('button', { name: 'Ürün işlemleri' });
  await expect(menus.first()).toBeVisible();
  await menus.last().scrollIntoViewIfNeeded();
  await menus.last().click();
  const del = page.getByRole('menuitem', { name: 'Sil' });
  await expect(del).toBeVisible();
  const box = await del.boundingBox();
  const vp = page.viewportSize()!;
  expect(box && box.y >= 0 && box.y + box.height <= vp.height).toBeTruthy();
  await page.keyboard.press('Escape');
  await expect(del).toHaveCount(0);
});

test('satış formunda kaydet hep görünür, yarım form çıkışta uyarır', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/invoices/new');
  const save = page.getByRole('button', { name: /fatura(yı)? kaydet|save invoice/i });
  await expect(save).toBeInViewport();

  await page.locator('textarea').first().fill('yarım kalan satış');
  await page.getByRole('link', { name: /^(home|ana sayfa)$/i }).last().click();
  await expect(page.getByText('Kaydedilmemiş değişiklikler var')).toBeVisible();
  await page.getByRole('button', { name: 'Sayfada kal' }).click();
  await expect(page).toHaveURL(/\/invoices\/new/);
  await expect(page.locator('textarea').first()).toHaveValue('yarım kalan satış');

  await page.getByRole('link', { name: /^(home|ana sayfa)$/i }).last().click();
  await page.getByRole('button', { name: 'Çık' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('sayı alanı ondalık klavye açar ve virgülü kabul eder', async ({ page }) => {
  await page.goto('/products/new');
  const stock = page.locator('input[inputmode="decimal"][placeholder="0"]');
  await expect(stock).toHaveAttribute('type', 'text');
  await stock.fill('');
  await stock.pressSequentially('12,5');
  await expect(stock).toHaveValue('12.5');
  await stock.fill('');
  await stock.pressSequentially('1a2');
  await expect(stock).toHaveValue('12');
});
