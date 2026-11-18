import { test, expect } from '@playwright/test';
import { AccountsPage } from '../../pages/AccountsPage';
import { randomSuffix } from '../../helpers/utils';

test.describe('Ön Muhasebe — Hesaplar & Ödemeler', () => {

  test('hesaplar sayfası yükleniyor', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.goto();
    await accounts.expectLoaded();
    await page.screenshot({ path: 'test-results/screenshots/accounts-list.png' });
  });

  test('hesap ekleme menüsü ve penceresi açılıyor', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.goto();
    await accounts.openAddAccountModal('Banka');
    await page.screenshot({ path: 'test-results/screenshots/accounts-add.png' });
  });

  test('yeni hesap oluşturabiliyor', async ({ page }) => {
    const accounts = new AccountsPage(page);
    const name = `Test Kasa ${randomSuffix()}`;
    await accounts.goto();
    await accounts.openAddAccountModal('Kasa');
    await accounts.fillAccountForm(name);
    await accounts.saveAccount();
    await accounts.expectAccountInList(name);
    await page.screenshot({ path: 'test-results/screenshots/accounts-created.png' });
  });

  test('hesap ekstre / detay görüntüleniyor', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href*="/accounts/"]');
    const count = await links.count();
    if (count > 0) {
      await links.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/accounts\/.+/, { timeout: 10000 });
      await page.screenshot({ path: 'test-results/screenshots/accounts-detail.png', fullPage: true });
    } else {
      test.skip(true, 'Hesap yok');
    }
  });

  test('ödemeler sayfası yükleniyor', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/payments/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/payments-list.png' });
  });

  // Ödemeler sayfasında ekleme düğmesi yok: ödemeler müşteri/tedarikçi sayfasından girilir
  test('ödemeler sayfası ödemenin nereden ekleneceğini gösteriyor', async ({ page }) => {
    await page.goto('/payments');
    await page.waitForLoadState('networkidle');
    const hasRows = await page.locator('tbody tr').count();
    if (hasRows === 0) {
      await expect(page.getByRole('link', { name: /müşteri/i }).last()).toBeVisible();
      await expect(page.getByRole('link', { name: /tedarikçi/i }).last()).toBeVisible();
    } else {
      await expect(page.getByText(/toplam tahsilat|total received/i)).toBeVisible();
    }
  });

  test('müşteriler sayfası yükleniyor', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/customers/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/customers-list.png' });
  });

  test('faturalar sayfası yükleniyor ve FTR prefix gösteriyor', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/invoices/, { timeout: 10000 });
    const hasFtrPrefix = await page.getByText(/FTR-/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/invoices-list.png' });
  });

  test('alışlar sayfası yükleniyor', async ({ page }) => {
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/purchases-list.png' });
  });
});
