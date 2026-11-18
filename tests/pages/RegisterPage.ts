import { Page, expect } from '@playwright/test';

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
    await this.page.waitForLoadState('domcontentloaded');
  }

  // Form alanları etiketleriyle bulunur (id/htmlFor bağlı)
  name() { return this.page.locator('#reg-name'); }
  company() { return this.page.locator('#reg-company'); }
  email() { return this.page.locator('#reg-email'); }
  password() { return this.page.locator('#reg-password'); }
  submit() { return this.page.locator('form button[type="submit"]'); }

  async register(name: string, companyName: string, email: string, password: string) {
    await this.name().fill(name);
    await this.company().fill(companyName);
    await this.email().fill(email);
    await this.password().fill(password);
    await this.submit().click();
  }

  async expectSuccessModal() {
    await expect(this.page.getByText(/doğrulama|başarı|kayıt/i)).toBeVisible({ timeout: 10000 });
  }

  async expectPasswordRule(rule: 'letter' | 'number' | 'length') {
    const texts: Record<string, RegExp> = {
      letter: /harf|letter/i,
      number: /rakam|number|sayı/i,
      length: /karakter|character/i,
    };
    await expect(this.page.getByText(texts[rule])).toBeVisible({ timeout: 5000 });
  }

  async expectSubmitDisabled() {
    await expect(this.submit()).toBeDisabled({ timeout: 5000 });
  }
}
