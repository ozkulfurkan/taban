import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    // Önceden kurulu bir Chromium kullanmak için (örn. CI imajı): PW_CHROMIUM_PATH=/yol/chromium
    ...(process.env.PW_CHROMIUM_PATH ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } } : {}),
  },
  projects: [
    { name: 'setup', testMatch: '**/auth.setup.ts' },
    // Tarayıcısız API güvenlik testleri (firma ayrımı, roller, oturum)
    { name: 'security', testMatch: '**/security/*.spec.ts' },
    // Tarayıcısız API testleri (para hesapları, belge numaraları, doğrulama)
    { name: 'api', testMatch: '**/api/*.spec.ts' },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: ['**/auth.setup.ts', '**/security/**', '**/api/**', '**/unit/**'],
    },
  ],
  outputDir: 'test-results',
});
