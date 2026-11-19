import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
    testDir: 'tests/e2e',
    timeout: 60_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? 'github' : 'list',
    use: {
        baseURL: `http://localhost:${PORT}`,
        locale: 'fa-IR',
        timezoneId: 'Asia/Tehran',
        acceptDownloads: true,
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: {
        command: 'node scripts/dev.mjs',
        env: { PORT: String(PORT) },
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
    },
});
