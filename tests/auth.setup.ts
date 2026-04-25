import { test as setup, expect } from '@playwright/test';
import { TEST_CONFIG } from './helpers/config';

const authFile = 'tests/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  await page.getByPlaceholder('email@example.com').fill(TEST_CONFIG.credentials.email);
  await page.getByPlaceholder('••••••••').fill(TEST_CONFIG.credentials.password);
  await page.getByRole('button', { name: /giriş|login/i }).click();

  await expect(page).toHaveURL(/dashboard/, { timeout: 20000 });

  await page.context().storageState({ path: authFile });
});
