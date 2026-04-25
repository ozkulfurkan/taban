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
    const btn = this.page.getByRole('button', { name: /personel ekle|ekle|yeni|add/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await btn.click();
    await this.page.waitForTimeout(500);
  }

  async fillPersonnelForm(name: string, salary = '15000') {
    const fields = [
      { placeholder: /ad soyad|isim|name/i, value: name },
      { placeholder: /departman|department/i, value: 'Üretim' },
      { placeholder: /görev|pozisyon|role|title/i, value: 'İşçi' },
    ];

    for (const field of fields) {
      const input = this.page.getByPlaceholder(field.placeholder).last();
      if (await input.isVisible({ timeout: 2000 }).catch(() => false)) {
        await input.fill(field.value);
      }
    }

    // Salary
    const salaryInput = this.page.locator('input[type="number"]').first();
    if (await salaryInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await salaryInput.fill(salary);
    }
  }

  async savePersonnel() {
    const saveBtn = this.page.getByRole('button', { name: /kaydet|save|ekle|add/i }).last();
    await saveBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async expectPersonnelInList(name: string) {
    await expect(this.page.getByText(name, { exact: false })).toBeVisible({ timeout: 10000 });
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
