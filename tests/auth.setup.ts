import { test as setup, expect } from '@playwright/test';
import { TEST_CONFIG } from './helpers/config';

const authFile = 'tests/.auth/user.json';
const WHATS_NEW_KEY = process.env.WHATS_NEW_KEY || 'whats_new_v20260510';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.getByPlaceholder('email@example.com').fill(TEST_CONFIG.credentials.email);
  await page.getByPlaceholder('••••••••').fill(TEST_CONFIG.credentials.password);
  await page.getByRole('button', { name: /giriş|login/i }).click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 20000 });

  // "Yenilikler" penceresi tüm sayfaların önüne geçtiği için testlerde kapalı başlat
  await page.evaluate((key) => localStorage.setItem(key, '1'), WHATS_NEW_KEY);
  await page.context().storageState({ path: authFile });
});
