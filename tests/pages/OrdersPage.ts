import { Page, expect } from '@playwright/test';
import { randomSuffix } from '../helpers/utils';

export class OrdersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/orders');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/orders/, { timeout: 10000 });
  }

  async clickNewOrder() {
    await this.page.goto('/orders/new');
    await this.page.waitForLoadState('networkidle');
  }

  async selectFirstCustomer() {
    const selects = this.page.locator('select').filter({ hasText: /müşteri|customer/i });
    const firstSelect = selects.first();
    if (await firstSelect.isVisible()) {
      const options = await firstSelect.locator('option').all();
      if (options.length > 1) {
        await firstSelect.selectOption({ index: 1 });
        return true;
      }
    }
    // Try react-select or custom select
    const customSelect = this.page.locator('[class*="select"], [class*="Select"]').filter({ hasText: /müşteri|customer/i }).first();
    if (await customSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await customSelect.click();
      await this.page.locator('[class*="option"]').first().click();
      return true;
    }
    return false;
  }

  async expectOrderInList(orderNo: string) {
    await expect(this.page.getByText(orderNo, { exact: false })).toBeVisible({ timeout: 10000 });
  }

  async countOrders() {
    return await this.page.locator('table tbody tr, [data-testid="order-row"]').count();
  }

  async clickFirstOrder() {
    const link = this.page.locator('a[href*="/orders/"]').first();
    await link.waitFor({ state: 'visible', timeout: 8000 });
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async deleteFirstOrder() {
    const deleteBtn = this.page.getByRole('button', { name: /sil|delete/i }).first();
    await deleteBtn.click();
    const confirm = this.page.getByRole('button', { name: /evet|onayla|sil|confirm/i }).first();
    if (await confirm.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirm.click();
    }
  }
}
