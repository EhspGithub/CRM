// End-to-end checks of the built app (dist/) in Chromium, on a desktop and a phone-sized screen.
import { test, expect } from '@playwright/test';

const TABS = ['dashboard', 'add-patient', 'patients-list', 'follow-ups', 'dispense', 'opium', 'reports-analytics', 'settings'];

// Fails the test on any JS error, console error, failed request or request leaving localhost.
function watchProblems(page) {
    const problems = [];
    page.on('pageerror', e => problems.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
    page.on('requestfailed', r => problems.push(`requestfailed: ${r.url()}`));
    page.on('request', r => {
        const url = new URL(r.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname) && !['data:', 'blob:'].includes(url.protocol)) problems.push(`remote request: ${r.url()}`);
    });
    return problems;
}

async function openApp(page) {
    await page.goto('/');
    await expect(page.locator('#nr-splash')).toHaveCount(0, { timeout: 30_000 });
}

async function switchTab(page, tab, isMobile) {
    const selector = `[onclick="switchTab('${tab}')"]`;
    if (!isMobile) {
        await page.locator(`aside ${selector}`).click();
    } else if (await page.locator(`#mobile-bottom-nav ${selector}`).count()) {
        await page.locator(`#mobile-bottom-nav ${selector}`).click();
    } else {
        await page.locator('#mobile-bottom-nav [onclick="openMobileMenu()"]').click();
        await page.locator(`#mobile-nav-sheet ${selector}`).click();
    }
    await expect(page.locator(`#tab-${tab}`)).toBeVisible();
}

test('starts with the local database, without errors or internet access', async ({ page }) => {
    const problems = watchProblems(page);
    await openApp(page);
    await expect(page.locator('#tab-dashboard')).toBeVisible();
    await expect(page.getByText('ورژن ۹۳').first()).toBeAttached();
    const fontsReady = await page.evaluate(async () => {
        await document.fonts.ready;
        return document.fonts.check('16px Vazirmatn') && document.fonts.check('900 16px "Font Awesome 6 Free"');
    });
    expect(fontsReady).toBe(true);
    expect(await page.evaluate(() => typeof window.Chart === 'function' && typeof window.jalaliDatepicker === 'object')).toBe(true);
    expect(problems).toEqual([]);
});

test('every section of the app opens', async ({ page, isMobile }) => {
    const problems = watchProblems(page);
    await openApp(page);
    for (const tab of TABS) await switchTab(page, tab, isMobile);
    for (const sub of ['clinic', 'staff', 'data', 'about']) {
        await page.locator(`#btn-settings-sub-${sub}`).click();
        await expect(page.locator(`#settings-sub-tab-${sub}`)).toBeVisible();
    }
    expect(problems).toEqual([]);
});

test('saved settings survive a reload (IndexedDB)', async ({ page, isMobile }) => {
    const problems = watchProblems(page);
    await openApp(page);
    await switchTab(page, 'settings', isMobile);
    const name = `کلینیک آزمایشی ${Date.now()}`;
    await page.locator('#setting-clinicName').fill(name);
    await page.locator('#clinicSettingsForm [type="submit"]').click();
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('#nr-splash')).toHaveCount(0, { timeout: 30_000 });
    await switchTab(page, 'settings', isMobile);
    await expect(page.locator('#setting-clinicName')).toHaveValue(name);
    expect(problems).toEqual([]);
});

test('Excel (CSV) export downloads a file', async ({ page, isMobile }) => {
    const problems = watchProblems(page);
    await openApp(page);
    await switchTab(page, 'settings', isMobile);
    await page.locator('#btn-settings-sub-data').click();
    await page.locator('[onclick="openExcelExportModal()"]').click();
    await expect(page.locator('#excel-export-modal')).toBeVisible();
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('#excel-export-modal [onclick="generateExcelExport()"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^nasim_rahayi_export_.*\.csv$/);
    expect(problems).toEqual([]);
});
