import { Page, expect } from '@playwright/test';
import { randomSuffix } from '../helpers/utils';

export class MaterialsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/materials');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/materials/, { timeout: 10000 });
  }

  async openAddModal() {
    const btn = this.page.getByRole('button', { name: /ekle|yeni|add|new/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await btn.click();
    await this.page.waitForTimeout(500);
  }

  async fillMaterialForm(name: string, price = '10') {
    await this.page.locator('#mat-name').fill(name);
    await this.page.locator('#mat-price').fill(price);
  }

  async saveForm() {
    const saveBtn = this.page.getByRole('button', { name: /kaydet|save|ekle|add/i }).last();
    await saveBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async expectMaterialInList(name: string) {
    await expect(this.page.getByText(name, { exact: false })).toBeVisible({ timeout: 10000 });
  }

  async countMaterials() {
    return await this.page.locator('table tbody tr, [data-testid="material-row"]').count();
  }
}
