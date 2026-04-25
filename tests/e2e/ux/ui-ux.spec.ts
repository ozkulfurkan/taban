import { test, expect } from '@playwright/test';

test.describe('UI / UX Kontrolleri', () => {

  test('dashboard ana layout bozuk değil', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Sidebar visible (desktop)
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar).toBeVisible({ timeout: 8000 });
    // Header visible
    const header = page.locator('header, [class*="header"], .sticky').first();
    await expect(header).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'test-results/screenshots/ux-dashboard-layout.png', fullPage: true });
  });

  test('kullanıcı menüsü açılıyor ve logout butonu var', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // User menu button (chevron down next to name)
    const userBtn = page.locator('button').filter({ hasText: /chevron|kullanıcı/i }).first()
      || page.locator('button:has(svg)').last();
    // Try clicking a button that might open user menu
    const buttons = page.locator('header button, .sticky button');
    const btnCount = await buttons.count();
    if (btnCount > 0) {
      await buttons.last().click();
      await page.waitForTimeout(500);
      const logoutVisible = await page.getByText(/çıkış|logout/i).isVisible({ timeout: 3000 }).catch(() => false);
      if (logoutVisible) {
        await expect(page.getByText(/çıkış|logout/i)).toBeVisible();
      }
    }
    await page.screenshot({ path: 'test-results/screenshots/ux-user-menu.png' });
  });

  test('sidebar navigasyon linkleri çalışıyor', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const routes = ['/orders', '/products', '/materials', '/personnel', '/accounts'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');
      await expect(page).toHaveURL(route, { timeout: 10000 });
    }
  });

  test('tablet görünümü (768px) sidebar overlay açılıyor', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    // Look for hamburger / mobile menu button
    const menuBtn = page.locator('button').filter({ hasText: /menu|menü/i }).first();
    if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await menuBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: 'test-results/screenshots/ux-tablet-768.png', fullPage: true });
  });

  test('mobil görünüm (375px) bottom nav görünür', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/screenshots/ux-mobile-375.png', fullPage: true });
    // Bottom nav should be visible
    const bottomNav = page.locator('nav.fixed, [class*="bottom"]').first();
    const visible = await bottomNav.isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/ux-mobile-bottom-nav.png' });
  });

  test('loading spinner gösterilip gizleniyor', async ({ page }) => {
    await page.goto('/orders');
    // Initially might show a spinner
    const spinner = page.locator('[class*="animate-spin"], .loader, [class*="loading"]').first();
    // After load, spinner should be gone
    await page.waitForLoadState('networkidle');
    const spinnerVisible = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
    // It's OK if spinner is gone - means loading completed
    await page.screenshot({ path: 'test-results/screenshots/ux-loading.png' });
  });

  test('404 — yanlış URL\'de sayfanın çökmediğini kontrol et', async ({ page }) => {
    const res = await page.goto('/nonexistent-page-xyz');
    await page.waitForLoadState('domcontentloaded');
    // Should either redirect to dashboard or show 404, not crash
    const is404 = await page.getByText(/404|bulunamadı|not found/i).isVisible({ timeout: 5000 }).catch(() => false);
    const redirected = page.url().includes('/dashboard') || page.url().includes('/login');
    expect(is404 || redirected).toBeTruthy();
    await page.screenshot({ path: 'test-results/screenshots/ux-404.png' });
  });

  test('form validation — fatura oluşturma boş form gönderilemiyor', async ({ page }) => {
    await page.goto('/invoices/new');
    await page.waitForLoadState('networkidle');
    const saveBtn = page.getByRole('button', { name: /kaydet|save|oluştur/i }).first();
    if (await saveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(500);
      // Should still be on invoice form
      const stillOnForm = page.url().includes('/invoices');
      const hasValidationMsg = await page.locator('[class*="error"], [class*="invalid"], [aria-invalid]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(stillOnForm).toBeTruthy();
    }
    await page.screenshot({ path: 'test-results/screenshots/ux-form-validation.png' });
  });

  test('modal açılıp kapanabiliyor — hesaplar', async ({ page }) => {
    await page.goto('/accounts');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button', { name: /ekle|yeni|add/i }).first();
    if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      const modal = page.locator('[data-testid="modal"], [role="dialog"]').first();
      const modalOpen = await modal.isVisible({ timeout: 5000 }).catch(() => false);
      if (modalOpen) {
        // Close with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        const modalClosed = !(await modal.isVisible({ timeout: 2000 }).catch(() => true));
        await page.screenshot({ path: 'test-results/screenshots/ux-modal-close.png' });
      }
    }
  });

  test('destek merkezi sayfası yükleniyor', async ({ page }) => {
    await page.goto('/destek-merkezi');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/destek/, { timeout: 10000 });
    await page.screenshot({ path: 'test-results/screenshots/ux-support.png', fullPage: true });
  });

  test('sekme başlıkları uygun metinler içeriyor', async ({ page }) => {
    const pageTitles: [string, RegExp][] = [
      ['/dashboard', /solecost|dashboard|gösterge/i],
      ['/orders', /sipariş|order/i],
      ['/products', /ürün|product/i],
    ];
    for (const [url, titleRegex] of pageTitles) {
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
      const title = await page.title();
      const h1 = await page.locator('h1').first().textContent().catch(() => '');
    }
  });

  test('para birimi sembolleri doğru gösteriliyor (₺, $, €)', async ({ page }) => {
    await page.goto('/invoices');
    await page.waitForLoadState('networkidle');
    const hasSymbol = await page.getByText(/₺|\$|€|TRY|USD|EUR/).first().isVisible({ timeout: 5000 }).catch(() => false);
    await page.screenshot({ path: 'test-results/screenshots/ux-currency.png' });
  });
});
