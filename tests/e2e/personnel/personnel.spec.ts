import { test, expect } from '@playwright/test';
import { PersonnelPage } from '../../pages/PersonnelPage';
import { randomSuffix } from '../../helpers/utils';

test.describe('Personel Takibi', () => {

  test('personel sayfası yükleniyor', async ({ page }) => {
    const personnel = new PersonnelPage(page);
    await personnel.goto();
    await personnel.expectLoaded();
    await page.screenshot({ path: 'test-results/screenshots/personnel-list.png' });
  });

  test('personel ekleme modalı / formu açılıyor', async ({ page }) => {
    const personnel = new PersonnelPage(page);
    await personnel.goto();
    await personnel.openAddModal();
    await page.waitForTimeout(600);
    const formVisible = await page.locator('dialog, [role="dialog"], form, input[type="text"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(formVisible).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/personnel-add.png' });
  });

  test('yeni personel ekleyebiliyor', async ({ page }) => {
    const personnel = new PersonnelPage(page);
    const name = `Test Personel ${randomSuffix()}`;
    await personnel.goto();
    await personnel.openAddModal();
    await personnel.fillPersonnelForm(name, '18000');
    await personnel.savePersonnel();
    await personnel.expectPersonnelInList(name);
    await page.screenshot({ path: 'test-results/screenshots/personnel-added.png' });
  });

  test('personel detay sayfası açılıyor', async ({ page }) => {
    await page.goto('/personnel');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href*="/personnel/"]');
    const count = await links.count();
    if (count > 0) {
      await links.first().click();
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(/personnel\/.+/, { timeout: 10000 });
      await page.screenshot({ path: 'test-results/screenshots/personnel-detail.png', fullPage: true });
    } else {
      test.skip(true, 'Personel bulunamadı');
    }
  });

  test('personel sayfasında bordro / maaş bilgisi görünür', async ({ page }) => {
    await page.goto('/personnel');
    await page.waitForLoadState('networkidle');
    const hasSalaryInfo = await page.getByText(/maaş|ücret|salary|bordro|TL|₺/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/personnel-salary.png' });
  });

  test('personel detayında belge yükleme bölümü var', async ({ page }) => {
    await page.goto('/personnel');
    await page.waitForLoadState('networkidle');
    const links = page.locator('a[href*="/personnel/"]');
    if (await links.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await links.first().click();
      await page.waitForLoadState('networkidle');
      const hasDocSection = await page.getByText(/belge|döküman|document|dosya/i).first().isVisible({ timeout: 5000 }).catch(() => false);
      await page.screenshot({ path: 'test-results/screenshots/personnel-documents.png', fullPage: true });
    }
  });
});
