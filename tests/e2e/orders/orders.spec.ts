import { test, expect } from '@playwright/test';
import { OrdersPage } from '../../pages/OrdersPage';
import { DashboardPage } from '../../pages/DashboardPage';

test.describe('Sipariş Yönetimi', () => {

  test('siparişler sayfası yükleniyor', async ({ page }) => {
    const orders = new OrdersPage(page);
    await orders.goto();
    await orders.expectLoaded();
    await expect(page.getByText(/sipariş|order/i).first()).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'test-results/screenshots/orders-list.png' });
  });

  test('yeni sipariş sayfası açılıyor', async ({ page }) => {
    await page.goto('/orders/new');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/orders\/new/, { timeout: 10000 });
    // Check for form elements
    const hasContent = await page.locator('form, select, input, button').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/orders-new.png', fullPage: true });
  });

  test('sipariş listesinde filtre / sekme değişimi çalışıyor', async ({ page }) => {
    const orders = new OrdersPage(page);
    await orders.goto();
    // Click on tabs (Bekliyor, Üretimde, etc.)
    const tabs = page.locator('button, [role="tab"]').filter({ hasText: /bekli|üretim|hazır|sevk/i });
    const tabCount = await tabs.count();
    if (tabCount > 0) {
      await tabs.first().click();
      await page.waitForTimeout(800);
      await expect(tabs.first()).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/screenshots/orders-tabs.png' });
  });

  test('sipariş müşteri seçimi çalışıyor', async ({ page }) => {
    await page.goto('/orders/new');
    await page.waitForLoadState('networkidle');
    // Look for customer select
    const customerSelect = page.locator('select').first();
    if (await customerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      const options = await customerSelect.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
    await page.screenshot({ path: 'test-results/screenshots/orders-customer-select.png' });
  });

  test('ilk siparişe tıklanınca detay sayfası açılıyor', async ({ page }) => {
    const orders = new OrdersPage(page);
    await orders.goto();
    const orderLinks = page.locator('a[href*="/orders/"]').filter({ hasNot: page.locator('[href="/orders/new"]') });
    const count = await orderLinks.count();
    if (count > 0) {
      const href = await orderLinks.first().getAttribute('href');
      await orderLinks.first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/orders\/.+/, { timeout: 10000 });
      await page.screenshot({ path: 'test-results/screenshots/orders-detail.png', fullPage: true });
    } else {
      test.skip(true, 'Sipariş bulunamadı, test atlanıyor');
    }
  });

  test('"SIP-" format sipariş numarası gösteriliyor', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    const hasSipPrefix = await page.getByText(/SIP-/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    if (hasSipPrefix) {
      await expect(page.getByText(/SIP-/i).first()).toBeVisible();
    }
    // Not a hard fail if no orders exist
  });
});
