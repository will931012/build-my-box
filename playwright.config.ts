import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas e2e del flujo principal. Requieren una base de datos con el seed cargado
 * (ver README). Levantan API y web automáticamente si no están corriendo.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    locale: 'es-ES',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'npm run start -w @bmb/server', url: 'http://localhost:4000/api/health', reuseExistingServer: true, timeout: 60_000 },
    { command: 'npm run dev -w @bmb/web', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60_000 },
  ],
});
