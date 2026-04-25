import { Page, expect } from '@playwright/test';

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
    await this.page.waitForLoadState('domcontentloaded');
  }

  async register(name: string, companyName: string, email: string, password: string) {
    // Inputs don't have placeholders; use nth() ordering: name, company, email, password
    const inputs = this.page.locator('input[type="text"], input[type="email"], input[type="password"]');
    await inputs.nth(0).fill(name);       // Ad Soyad
    await inputs.nth(1).fill(companyName); // Firma Adı
    await inputs.nth(2).fill(email);      // E-posta
    await inputs.nth(3).fill(password);   // Şifre
    await this.page.getByRole('button', { name: /kayıt|register|oluştur/i }).click();
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
    const btn = this.page.getByRole('button', { name: /kayıt|register|oluştur/i });
    await expect(btn).toBeDisabled({ timeout: 5000 });
  }
}
