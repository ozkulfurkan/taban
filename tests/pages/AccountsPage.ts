import { Page, expect } from '@playwright/test';

export class AccountsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/accounts');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/accounts/, { timeout: 10000 });
  }

  // "Yeni Hesap" bir açılır menü: önce hesap türü seçilir, sonra pencere açılır
  async openAddAccountModal(type = 'Kasa') {
    await this.page.getByRole('button', { name: /yeni hesap|new account/i }).click();
    await this.page.getByRole('button', { name: new RegExp(`^\\s*${type}\\b`, 'i') }).click();
    await expect(this.page.getByPlaceholder(/TL Kasa/i)).toBeVisible();
  }

  async fillAccountForm(name: string) {
    await this.page.getByPlaceholder(/TL Kasa/i).fill(name);
  }

  async saveAccount() {
    const saveBtn = this.page.getByRole('button', { name: /kaydet|save|ekle/i }).last();
    await saveBtn.click();
    await this.page.waitForTimeout(1000);
  }

  async expectAccountInList(name: string) {
    await expect(this.page.getByText(name, { exact: false })).toBeVisible({ timeout: 10000 });
  }

  async getTotalBalance() {
    const balanceEl = this.page.locator('[class*="total"], [class*="balance"]').first();
    if (await balanceEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      return await balanceEl.textContent();
    }
    return null;
  }
}
