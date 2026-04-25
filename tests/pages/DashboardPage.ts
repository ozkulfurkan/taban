import { Page, expect } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/dashboard/, { timeout: 15000 });
    await expect(this.page.locator('nav, aside, [data-testid="sidebar"]').first()).toBeVisible({ timeout: 10000 });
  }

  async logout() {
    const userMenuBtn = this.page.locator('button').filter({ hasText: /kullanıcı|furkan|test/i }).first();
    if (await userMenuBtn.isVisible()) {
      await userMenuBtn.click();
    } else {
      // Try clicking the avatar/user area
      await this.page.locator('button:has(svg.lucide-user), button:has(.lucide-user)').first().click();
    }
    await this.page.getByText(/çıkış|logout/i).click();
    await expect(this.page).toHaveURL(/login/, { timeout: 10000 });
  }

  async navigateTo(route: string) {
    await this.page.goto(route);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async expectSidebarLink(name: string) {
    await expect(this.page.locator('nav, aside').getByText(name, { exact: false }).first()).toBeVisible({ timeout: 8000 });
  }
}
