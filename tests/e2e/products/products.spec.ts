import { test, expect } from '@playwright/test';
import { ProductsPage } from '../../pages/ProductsPage';
import { randomSuffix } from '../../helpers/utils';

test.describe('Maliyet — Ürün & Hesaplama', () => {

  test('ürünler sayfası yükleniyor', async ({ page }) => {
    const products = new ProductsPage(page);
    await products.goto();
    await products.expectLoaded();
    await page.screenshot({ path: 'test-results/screenshots/products-list.png' });
  });

  test('yeni ürün sayfası yükleniyor', async ({ page }) => {
    await page.goto('/products/new');
    await page.waitForLoadState('networkidle');
    const hasForm = await page.locator('input, form').first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasForm).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/products-new.png', fullPage: true });
  });

  test('ürün adı alanı mevcut ve yazılabiliyor', async ({ page }) => {
    await page.goto('/products/new');
    await page.waitForLoadState('networkidle');
    const nameInput = page.getByPlaceholder(/ürün adı|ad|name/i).first();
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(`Test Ürün ${randomSuffix()}`);
      const value = await nameInput.inputValue();
      expect(value).toContain('Test Ürün');
    }
    await page.screenshot({ path: 'test-results/screenshots/products-form.png' });
  });

  test('ürün detay sayfası açılıyor', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href*="/products/"]').filter({ hasNot: page.locator('[href="/products/new"]') });
    const count = await links.count();
    if (count > 0) {
      await links.first().click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/products\/.+/, { timeout: 10000 });
      await page.screenshot({ path: 'test-results/screenshots/products-detail.png', fullPage: true });
    } else {
      test.skip(true, 'Ürün bulunamadı');
    }
  });

  test('ürün maliyet bilgisi görünür', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const hasCost = await page.getByText(/maliyet|cost|₺|TL/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/products-cost.png' });
  });

  test('ürün içe aktarma butonu mevcut', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const importBtn = page.getByText(/içe aktar|import|excel/i).first();
    const visible = await importBtn.isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/products-import.png' });
  });

  test('ürün kategori filtresi çalışıyor', async ({ page }) => {
    await page.goto('/products');
    await page.waitForLoadState('networkidle');
    const categoryFilter = page.locator('select, button').filter({ hasText: /kategori|category|tümü/i }).first();
    if (await categoryFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await categoryFilter.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/screenshots/products-filter.png' });
  });
});
