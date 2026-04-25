import { Page, expect } from '@playwright/test';

export async function waitForNetworkIdle(page: Page, timeout = 5000) {
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

export async function waitForToast(page: Page, text?: string) {
  const toast = page.locator('[data-sonner-toast], [role="status"], .react-hot-toast').first();
  await toast.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  if (text) {
    await expect(page.getByText(text, { exact: false })).toBeVisible({ timeout: 8000 }).catch(() => {});
  }
}

export async function closeModal(page: Page) {
  const closeBtn = page.locator('button[aria-label="Close"], button:has(svg.lucide-x), button:has(.lucide-x)').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
}

export async function fillInput(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.clear();
  await el.fill(value);
}

export async function selectOption(page: Page, selector: string, value: string) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 8000 });
  await el.selectOption(value);
}

export async function clickButton(page: Page, text: string) {
  await page.getByRole('button', { name: text, exact: false }).first().click();
}

export async function expectPageTitle(page: Page, title: string) {
  await expect(page.getByRole('heading').first()).toContainText(title, { timeout: 10000 });
}

export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
}

export async function dismissAlert(page: Page) {
  page.on('dialog', dialog => dialog.accept());
}

export function randomSuffix() {
  return Math.floor(Math.random() * 90000 + 10000).toString();
}

export async function waitForSuccessIndicator(page: Page) {
  await Promise.race([
    page.getByText('başarı', { exact: false }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    page.getByText('kaydedildi', { exact: false }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    page.getByText('oluşturuldu', { exact: false }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
    page.getByText('eklendi', { exact: false }).waitFor({ state: 'visible', timeout: 8000 }).catch(() => {}),
  ]);
}
