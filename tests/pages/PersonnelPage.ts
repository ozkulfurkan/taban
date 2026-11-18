import { Page, expect } from '@playwright/test';

export class PersonnelPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/personnel');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/personnel/, { timeout: 10000 });
  }

  async openAddModal() {
    await this.page.getByRole('button', { name: /yeni personel|new employee/i }).click();
    await expect(this.page.getByText(/yeni personel ekle/i)).toBeVisible();
  }

  // Penceredeki alanlar örnek değerleriyle (placeholder) bulunur; sayfadaki arama kutusuyla karışmaz
  async fillPersonnelForm(name: string, salary = '15000') {
    await this.page.getByPlaceholder('Ahmet Yılmaz').fill(name);
    await this.page.getByPlaceholder('Üretim').fill('Üretim');
    await this.page.getByPlaceholder('Operatör').fill('İşçi');
    await this.page.locator('input[type="number"]').first().fill(salary);
  }

  async savePersonnel() {
    await this.page.getByRole('button', { name: /^kaydet$|^save$/i }).click();
  }

  async expectPersonnelInList(name: string) {
    await expect(this.page.getByText(name, { exact: true })).toBeVisible({ timeout: 10000 });
  }

  async clickFirstPersonnel() {
    const link = this.page.locator('a[href*="/personnel/"], tr').first();
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async countPersonnel() {
    return await this.page.locator('table tbody tr, [data-testid="personnel-row"]').count();
  }
}
