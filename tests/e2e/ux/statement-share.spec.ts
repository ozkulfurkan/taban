import { test, expect } from '@playwright/test';

// Ekstre → Link Gönder → link oturumsuz açılır; Yeni Link Oluştur eski linki geçersiz kılar.

const RUN = Date.now().toString(36);

test('ekstre linki oturumsuz açılır, yenilenince eski link geçersiz olur', async ({ page, browser }) => {
  const cus = await (await page.request.post('/api/customers', { data: { name: `Link Müşteri ${RUN}`, currency: 'USD' } })).json();
  const inv = await page.request.post('/api/invoices', {
    data: { customerId: cus.id, items: [{ description: 'Paylaşım Tabanı', quantity: 2, unitPrice: 15 }] },
  });
  expect(inv.ok(), await inv.text()).toBeTruthy();

  await page.goto(`/customers/${cus.id}/ekstre`);
  await page.getByRole('button', { name: 'Link Gönder' }).click();
  const modal = page.getByTestId('statement-share');
  const urlInput = modal.getByLabel('Ekstre linki');
  await expect(urlInput).toHaveValue(/\/ekstre\/[A-Za-z0-9_-]{43}$/);
  const oldUrl = await urlInput.inputValue();
  await expect(modal.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/.*text=/);
  await expect(modal.getByTestId('statement-share-info')).toContainText('0 kez görüntülendi');

  // Oturumsuz tarayıcı
  const guest = await browser.newContext({ locale: 'tr-TR', timezoneId: 'Europe/Istanbul' });
  const g = await guest.newPage();
  await g.goto(new URL(oldUrl).pathname);
  await expect(g.getByTestId('statement-party')).toHaveText(cus.name);
  await expect(g.getByTestId('statement-company')).not.toBeEmpty();
  await expect(g.getByTestId('statement-balance')).toHaveText('30,00 USD');
  await g.getByText('1 kalem · detay için tıklayın').click();
  await expect(g.locator('[data-testid=statement-items]:visible')).toContainText('Paylaşım Tabanı');
  await expect(g.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const download = g.waitForEvent('download');
  await g.getByRole('button', { name: 'PDF İndir' }).click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

  // Yenile → eski link geçersiz, yeni link açılır
  await modal.getByRole('button', { name: 'Yeni Link Oluştur' }).click();
  await modal.getByRole('button', { name: 'Evet, yeni link oluştur' }).click();
  await expect(urlInput).not.toHaveValue(oldUrl);
  const newUrl = await urlInput.inputValue();

  await g.goto(new URL(oldUrl).pathname);
  await expect(g.getByTestId('statement-invalid')).toContainText('geçersiz veya yenilenmiş');
  await g.goto(new URL(newUrl).pathname);
  await expect(g.getByTestId('statement-party')).toHaveText(cus.name);

  // Kapat
  await modal.getByRole('button', { name: 'Linki Kapat' }).click();
  await modal.getByRole('button', { name: 'Evet, linki kapat' }).click();
  await expect(modal).toContainText('Link kapatıldı');
  await g.goto(new URL(newUrl).pathname);
  await expect(g.getByTestId('statement-invalid')).toBeVisible();
  await guest.close();
});

test('tedarikçi ekstresinde de Link Gönder var', async ({ page }) => {
  const sup = await (await page.request.post('/api/suppliers', { data: { name: `Link Ted ${RUN}`, currency: 'USD' } })).json();
  await page.goto(`/suppliers/${sup.id}/ekstre`);
  await page.getByRole('button', { name: 'Link Gönder' }).click();
  await expect(page.getByTestId('statement-share').getByLabel('Ekstre linki')).toHaveValue(/\/ekstre\//);
});
