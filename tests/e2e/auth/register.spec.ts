import { test, expect } from '@playwright/test';
import { RegisterPage } from '../../pages/RegisterPage';
import { randomSuffix } from '../../helpers/utils';
import { TEST_CONFIG } from '../../helpers/config';

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
    await register.password().fill('123456');
    await expect(page.getByText(/harf|letter/i).first()).toBeVisible();
    await expect(register.submit()).toBeDisabled();
  });

  test('şifre kuralları — harf + rakam geçerli', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.password().fill('Test123456');
    await expect(register.submit()).toBeEnabled();
  });

  test('yeni kullanıcı kaydı → başarı penceresi gösterir', async ({ page }) => {
    const register = new RegisterPage(page);
    const suffix = randomSuffix();
    await register.goto();
    await register.register(`Test Kullanıcı ${suffix}`, `Test Firma ${suffix}`, `testuser${suffix}@example.com`, 'Test123456');
    await expect(page.getByRole('heading', { name: /hesabınız oluşturuldu|account created/i })).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/register-success.png' });
  });

  test('zaten kayıtlı email → anlaşılır hata mesajı', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register('Var Olan', 'Firma', TEST_CONFIG.credentials.email, 'Test123456');
    await expect(page.getByRole('alert').filter({ hasText: /kayıtlı bir hesap/i })).toBeVisible({ timeout: 8000 });
  });

  test('eksik alan → form gönderilmez', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.email().fill('partial@test.com');
    // Şifre kuralları karşılanmadan "Kayıt Ol" düğmesi devre dışıdır
    await expect(register.submit()).toBeDisabled();
    await expect(page).toHaveURL(/register/);
  });
});
