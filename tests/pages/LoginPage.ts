import { Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async login(email: string, password: string) {
    await this.page.getByPlaceholder('email@example.com').fill(email);
    await this.page.getByPlaceholder('••••••••').fill(password);
    await this.page.getByRole('button', { name: /giriş|login/i }).click();
  }

  async expectDashboard() {
    await expect(this.page).toHaveURL(/dashboard/, { timeout: 15000 });
  }

  async expectError(text: string | RegExp) {
    const locator = typeof text === 'string'
      ? this.page.getByText(text, { exact: false })
      : this.page.getByText(text);
    await expect(locator).toBeVisible({ timeout: 12000 });
  }

  async expectVerificationBanner() {
    await expect(this.page.getByText(/doğrulanmamış|doğrulama/i)).toBeVisible({ timeout: 8000 });
  }

  async clickResendVerification() {
    await this.page.getByRole('button', { name: /tekrar gönder|resend/i }).first().click();
  }

  async clickForgotPassword() {
    await this.page.getByText(/şifre.+unut|forgot/i).click();
  }
}
