import { test, expect, Page } from '@playwright/test';

// Çek portföyü: vade renkleri, seçim ve ortalama vade, toplu tedarikçiye ödeme
// (kurla otomatik karşılık), bankaya verme ve tahsil.

const RUN = Date.now().toString(36);
// Tarayıcı Europe/Istanbul saatinde; vade günü de o saat dilimine göre (UTC gece yarısı kaymasın)
const day = (o: number) => new Date(Date.now() + o * 86400000).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });

async function post(page: Page, url: string, data: any) {
  const r = await page.request.post(url, { data });
  expect(r.ok(), `${url} ${await r.text()}`).toBeTruthy();
  return r.json();
}

test.beforeEach(async ({ page }) => {
  // Kur servisi dış kaynağa bağlı; test sabit kurla çalışır
  await page.route('**/api/exchange-rates', r => r.fulfill({ json: { usd: 34, eur: 37, date: '18.11.2026' } }));
});

test('vadesi geçmiş çek kırmızı; seçince ortalama vade; tedarikçiye USD karşılıkla ödeme', async ({ page }) => {
  const tag = `CekUI${RUN}`;
  await post(page, '/api/cek', { borclu: `${tag} Gecmis`, tutar: 500, currency: 'TRY', vadesi: day(-4), seriNo: `${tag}-0` });
  const c1 = await post(page, '/api/cek', { borclu: `${tag} Bir`, tutar: 3400, currency: 'TRY', vadesi: day(10), seriNo: `${tag}-1` });
  const c2 = await post(page, '/api/cek', { borclu: `${tag} Iki`, tutar: 6800, currency: 'TRY', vadesi: day(40), seriNo: `${tag}-2` });
  const sup = await post(page, '/api/suppliers', { name: `${tag} Tedarik`, currency: 'USD' });

  await page.goto('/cek-portfolyo');
  await page.getByPlaceholder(/ara/i).first().fill(tag);
  const overdueRow = page.locator('tr[data-vade="overdue"]', { hasText: `${tag} Gecmis` });
  await expect(overdueRow).toBeVisible();
  await expect(overdueRow).toContainText('4 gün geçti');
  await expect(overdueRow.locator('td').nth(3)).toHaveClass(/text-red-600/);

  await page.getByRole('checkbox', { name: new RegExp(`${tag} Bir`) }).check();
  await page.getByRole('checkbox', { name: new RegExp(`${tag} Iki`) }).check();
  const bar = page.getByRole('region', { name: 'Seçili çekler' });
  await expect(bar).toContainText('2 çek seçildi');
  await expect(bar).toContainText('10.200,00 TRY');
  // 3400 × 10 gün + 6800 × 40 gün → ağırlıklı ortalama 30 gün
  await expect(bar).toContainText('(30 ');

  await bar.getByRole('button', { name: 'Tedarikçiye Ödeme Yap' }).click();
  const dlg = page.getByRole('dialog', { name: 'Tedarikçiye Ödeme Yap' });
  await dlg.getByPlaceholder('Tedarikçi ara...').fill(`${tag} Tedarik`);
  await dlg.getByRole('option').first().click();
  const a1 = dlg.getByRole('textbox', { name: `${tag}-1 USD karşılığı` });
  await expect(a1).toHaveValue('100');
  await expect(dlg.getByRole('textbox', { name: `${tag}-2 USD karşılığı` })).toHaveValue('200');
  await a1.fill('101,50'); // elle düzeltme
  await dlg.getByRole('button', { name: /301,50 USD Öde/ }).click();
  await expect(dlg).toHaveCount(0);

  const detail = await (await page.request.get(`/api/suppliers/${sup.id}`)).json();
  expect(detail.balance).toBe(-301.5);
  const saved = await (await page.request.get('/api/cek?durum=TEDARIKCI_VERILDI&all=true')).json();
  expect(saved.cekler.filter((c: any) => [c1.id, c2.id].includes(c.id)).every((c: any) => c.supplierId === sup.id)).toBe(true);
});

test('bankaya gönder, sonra tahsil et: banka hesabı varsayılan gelir ve bakiye artar', async ({ page }) => {
  const tag = `CekBank${RUN}`;
  await post(page, '/api/cek', { borclu: `${tag} Musteri`, tutar: 2500, currency: 'TRY', vadesi: day(15), seriNo: `${tag}-1` });
  const bank = await post(page, '/api/accounts', { name: `${tag} Banka`, type: 'Banka', currency: 'TRY', balance: 0 });
  await post(page, '/api/accounts', { name: `${tag} Kasa`, type: 'Kasa', currency: 'TRY', balance: 0 });

  await page.goto('/cek-portfolyo');
  await page.getByPlaceholder(/ara/i).first().fill(tag);
  await page.getByRole('checkbox', { name: new RegExp(`${tag} Musteri`) }).check();
  await page.getByRole('region', { name: 'Seçili çekler' }).getByRole('button', { name: 'Bankaya Gönder' }).click();
  const bdlg = page.getByRole('dialog', { name: 'Bankaya Ver' });
  await bdlg.getByLabel('Banka hesabı *').selectOption(bank.id);
  await bdlg.getByRole('button', { name: 'Bankaya Ver' }).click();
  await expect(bdlg).toHaveCount(0);

  await page.getByRole('button', { name: /Bankaya Verilen|Bankada|Sent to Bank/ }).first().click();
  await page.getByPlaceholder(/ara/i).first().fill(tag);
  await page.getByRole('checkbox', { name: new RegExp(`${tag} Musteri`) }).check();
  await page.getByRole('region', { name: 'Seçili çekler' }).getByRole('button', { name: 'Tahsil Et' }).click();
  const cdlg = page.getByRole('dialog', { name: 'Tahsil Et' });
  await expect(cdlg.getByLabel('Kasa / banka hesabı *')).toHaveValue(bank.id);
  await cdlg.getByRole('button', { name: 'Tahsil Et' }).click();
  await expect(cdlg).toHaveCount(0);

  const accs = await (await page.request.get('/api/accounts')).json();
  expect(accs.find((a: any) => a.id === bank.id).balance).toBe(2500);
});
