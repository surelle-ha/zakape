import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '../../test-results/studio',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  fullyParallel: false,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 25_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { outputFolder: '../../playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3300',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev',
      url: 'http://127.0.0.1:3300',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --dir ../site dev',
      url: 'http://127.0.0.1:3301',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
