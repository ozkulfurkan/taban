import { Page, expect } from '@playwright/test';

export class ProductsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/products');
    await this.page.waitForLoadState('networkidle');
  }

  async gotoNew() {
    await this.page.goto('/products/new');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/products/, { timeout: 10000 });
  }

  async fillProductForm(name: string, code: string) {
    const nameInput = this.page.getByPlaceholder(/ürün adı|ad|name/i).first();
    await nameInput.waitFor({ state: 'visible', timeout: 8000 });
    await nameInput.fill(name);

    const codeInput = this.page.getByPlaceholder(/kod|code/i).first();
    if (await codeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await codeInput.fill(code);
    }
  }

  async saveProduct() {
    const saveBtn = this.page.getByRole('button', { name: /kaydet|save/i }).first();
    await saveBtn.click();
    await this.page.waitForTimeout(1500);
  }

  async expectProductInList(name: string) {
    await expect(this.page.getByText(name, { exact: false })).toBeVisible({ timeout: 10000 });
  }

  async countProducts() {
    return await this.page.locator('table tbody tr, [data-testid="product-row"], .product-card').count();
  }

  async clickFirstProduct() {
    const link = this.page.locator('a[href*="/products/"]').first();
    await link.waitFor({ state: 'visible', timeout: 8000 });
    await link.click();
    await this.page.waitForLoadState('domcontentloaded');
  }
}
