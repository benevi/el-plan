// Pruebas e2e de humo con Playwright (npm run e2e). Sirve la raíz del repo con un servidor estático propio.
// En local puedes usar un Chromium ya instalado: PW_CHROMIUM=/ruta/al/chromium npm run e2e
import { defineConfig, devices } from '@playwright/test';

const PUERTO = +process.env.PUERTO_E2E || 8781;

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.mjs',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'movil-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined },
      },
    },
  ],
  webServer: {
    command: `node tests/e2e/servidor.mjs ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}/index.html`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
