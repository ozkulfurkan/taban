import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { TEST_CONFIG } from '../../helpers/config';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth — Giriş Akışı', () => {

  test('başarılı giriş → dashboard\'a yönlendirir', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(TEST_CONFIG.credentials.email, TEST_CONFIG.credentials.password);
    await login.expectDashboard();
    await page.screenshot({ path: 'test-results/screenshots/login-success.png' });
  });

  test('yanlış şifre → hata mesajı gösterir', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(TEST_CONFIG.credentials.email, 'YanlisParola99');
    await login.expectError(/geçersiz|hatalı|yanlış|invalid/i);
    await page.screenshot({ path: 'test-results/screenshots/login-wrong-password.png' });
  });

  test('boş form → giriş butonu göndermez veya hata verir', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await page.getByRole('button', { name: /giriş|login/i }).click();
    // Either stays on login page or shows error
    const stillOnLogin = page.url().includes('/login');
    const hasError = await page.getByText(/gerekli|zorunlu|required|boş/i).isVisible().catch(() => false);
    expect(stillOnLogin || hasError).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/login-empty.png' });
  });

  test('var olmayan email → hata mesajı', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('yokolan@example.com', 'Test123456');
    await login.expectError(/geçersiz|hatalı|bulunamadı|invalid/i);
  });

  test('şifremi unuttum linki mevcut ve çalışıyor', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    const forgotLink = page.getByText(/şifre.+unut|forgot/i);
    await expect(forgotLink).toBeVisible({ timeout: 5000 });
    await forgotLink.click();
    await expect(page).toHaveURL(/forgot|reset/i, { timeout: 10000 });
  });

  test('login sayfasında register linki var', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    const registerLink = page.getByText(/kayıt|register|hesap oluştur/i);
    await expect(registerLink.first()).toBeVisible({ timeout: 5000 });
  });
});
