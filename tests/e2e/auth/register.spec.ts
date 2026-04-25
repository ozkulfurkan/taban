import { test, expect } from '@playwright/test';
import { RegisterPage } from '../../pages/RegisterPage';
import { randomSuffix } from '../../helpers/utils';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth — Kayıt Akışı', () => {

  test('register sayfası yükleniyor', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /kayıt|register|hesap/i })).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'test-results/screenshots/register-page.png' });
  });

  test('şifre kuralları görünür — harf zorunlu', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    const passInput = page.getByPlaceholder(/şifre|parola|password/i);
    await passInput.fill('123456');
    // Should show letter requirement indicator
    const hasRule = await page.getByText(/harf|letter/i).isVisible({ timeout: 3000 }).catch(() => false);
    // Submit should be disabled since no letters
    const btn = page.getByRole('button', { name: /kayıt|register|oluştur/i });
    const isDisabled = await btn.isDisabled().catch(() => false);
    expect(hasRule || isDisabled).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/register-password-rules.png' });
  });

  test('şifre kuralları — harf + rakam geçerli', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await page.getByPlaceholder(/şifre|parola|password/i).fill('Test123456');
    const btn = page.getByRole('button', { name: /kayıt|register|oluştur/i });
    const isDisabled = await btn.isDisabled().catch(() => false);
    expect(isDisabled).toBeFalsy();
  });

  test('yeni kullanıcı kaydı → başarı modal gösterir', async ({ page }) => {
    const register = new RegisterPage(page);
    const suffix = randomSuffix();
    await register.goto();
    await register.register(
      `Test Kullanıcı ${suffix}`,
      `Test Firma ${suffix}`,
      `testuser${suffix}@example.com`,
      'Test123456'
    );
    // Success modal or redirect
    const successShown = await Promise.race([
      page.getByText(/başarı|doğrulama|e-posta gönderildi/i).waitFor({ timeout: 10000 }).then(() => true),
      page.waitForURL(/login/, { timeout: 10000 }).then(() => true),
    ]).catch(() => false);
    expect(successShown).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/register-success.png' });
  });

  test('zaten kayıtlı email → hata mesajı', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register('Var Olan', 'Firma', 'test@solecost.com', 'Test123456');
    await expect(page.getByText(/kayıtlı|exists|zaten|already/i)).toBeVisible({ timeout: 8000 });
  });

  test('eksik alan → form gönderilmez', async ({ page }) => {
    await page.goto('/register');
    // Only fill email, skip rest
    await page.getByPlaceholder(/e-posta|email/i).fill('partial@test.com');
    await page.getByRole('button', { name: /kayıt|register|oluştur/i }).click();
    await expect(page).toHaveURL(/register/, { timeout: 5000 });
  });
});
