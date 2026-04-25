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

  async openAddAccountModal() {
    const btn = this.page.getByRole('button', { name: /hesap ekle|ekle|yeni|add/i }).first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    await btn.click();
    await this.page.waitForTimeout(500);
  }

  async fillAccountForm(name: string, type = 'Kasa') {
    const nameInput = this.page.getByPlaceholder(/hesap adı|ad|name/i).last();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill(name);
    }

    const typeSelect = this.page.locator('select').filter({ hasText: /kasa|banka|pos/i }).first();
    if (await typeSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
      await typeSelect.selectOption(type);
    }
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
