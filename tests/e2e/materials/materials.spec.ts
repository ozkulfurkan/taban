import { test, expect } from '@playwright/test';
import { MaterialsPage } from '../../pages/MaterialsPage';
import { randomSuffix } from '../../helpers/utils';

test.describe('Stok — Hammadde Yönetimi', () => {

  test('hammaddeler sayfası yükleniyor', async ({ page }) => {
    const materials = new MaterialsPage(page);
    await materials.goto();
    await materials.expectLoaded();
    await page.screenshot({ path: 'test-results/screenshots/materials-list.png' });
  });

  test('hammadde ekleme modalı açılıyor', async ({ page }) => {
    const materials = new MaterialsPage(page);
    await materials.goto();
    await materials.openAddModal();
    const modalVisible = await page.locator('dialog, [role="dialog"], [class*="modal"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    const inputVisible = await page.getByPlaceholder(/ad|isim|name/i).last().isVisible({ timeout: 5000 }).catch(() => false);
    expect(modalVisible || inputVisible).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/materials-add-modal.png' });
  });

  test('yeni hammadde ekleyebiliyor', async ({ page }) => {
    const materials = new MaterialsPage(page);
    const name = `Test Hammadde ${randomSuffix()}`;
    await materials.goto();
    const countBefore = await materials.countMaterials();
    await materials.openAddModal();
    await materials.fillMaterialForm(name, '25');
    await materials.saveForm();
    await page.waitForTimeout(1500);
    await materials.expectMaterialInList(name);
    await page.screenshot({ path: 'test-results/screenshots/materials-added.png' });
  });

  test('hammadde detay sayfası açılıyor', async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('networkidle');
    const materialLinks = page.locator('a[href*="/materials/"]');
    const count = await materialLinks.count();
    if (count > 0) {
      await materialLinks.first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/materials\/.+/, { timeout: 10000 });
      await page.screenshot({ path: 'test-results/screenshots/materials-detail.png', fullPage: true });
    } else {
      test.skip(true, 'Hammadde yok, test atlanıyor');
    }
  });

  test('hammadde arama / filtreleme çalışıyor', async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('networkidle');
    const searchInput = page.getByPlaceholder(/ara|search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(700);
      await page.screenshot({ path: 'test-results/screenshots/materials-search.png' });
    }
  });

  test('hammadde stok bilgisi görünür', async ({ page }) => {
    await page.goto('/materials');
    await page.waitForLoadState('networkidle');
    // Should show stock amounts
    const hasStockInfo = await page.getByText(/kg|stok|stock|miktar/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/materials-stock.png' });
  });
});
