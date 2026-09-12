import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração oficial do Playwright para testes End-to-End (E2E) no Quinzena App (CARD-055).
 * Testes isolados com foco em performance e custo ZERO em nuvem Firebase.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  timeout: 45000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000
  }
});
