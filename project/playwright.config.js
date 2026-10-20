import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  globalSetup: './e2e/global-setup.js',
  use: {
    baseURL: 'http://127.0.0.1:3100'
  },
  webServer: {
    command: 'FEEDBACK_DATA_FILE=./data/e2e-feedback.json PORT=3100 node src/server.js',
    url: 'http://127.0.0.1:3100',
    reuseExistingServer: false
  }
});
