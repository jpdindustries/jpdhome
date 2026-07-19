import { test, expect } from '@playwright/test';
import { isChromiumDesktop, waitForScene } from './helpers.js';

for (const mode of ['base', 'retro', 'rgb']) {
  test(`${mode} override mounts its Canvas theme`, async ({ page }) => {
    await page.goto(`/?v=${mode}`);
    await waitForScene(page);
    await expect(page.locator('html')).toHaveAttribute('data-requested-mode', mode);
    await expect(page.locator('html')).toHaveAttribute('data-renderer', mode);
    await expect(page.locator('.scene-canvas')).toHaveCount(2);
    await expect(page.locator('#logo')).toBeVisible();
  });
}

test('invalid mode normalizes to Auto without changing the URL contract', async ({ page }) => {
  await page.addInitScript(() => {
    window.__JPD_TEST_HOOKS__ = { webglUnavailable: true };
  });
  await page.goto('/?v=not-a-mode');
  await waitForScene(page, 'fallback');
  await expect(page.locator('html')).toHaveAttribute('data-requested-mode', 'auto');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'base');
});

test('Auto selects WebGL after a successful first frame', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/');
  await waitForScene(page);
  await expect(page.locator('html')).toHaveAttribute('data-requested-mode', 'auto');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'webgl');
  await expect(page.locator('#webgl-canvas')).toBeVisible();
});

test('the explicit WebGL override is ready in deterministic Chromium', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await expect(page.locator('html')).toHaveAttribute('data-requested-mode', 'webgl');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'webgl');
});

for (const failure of [
  ['webglUnavailable', 'webgl-unavailable'],
  ['webglImportFailure', 'import-failed'],
  ['webglInitFailure', 'init-failed'],
  ['webglFirstFrameFailure', 'init-failed'],
]) {
  test(`WebGL ${failure[0]} falls back safely`, async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name));
    await page.addInitScript(([hook]) => {
      window.__JPD_TEST_HOOKS__ = { [hook]: true };
    }, failure);
    await page.goto('/?v=webgl');
    await waitForScene(page, 'fallback');
    await expect(page.locator('html')).toHaveAttribute('data-renderer', 'base');
    await expect(page.locator('html')).toHaveAttribute('data-fallback-reason', failure[1]);
    await expect(page.locator('#logo')).toBeVisible();
  });
}

test('a restored WebGL context reports ready only after a restored frame', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.simulateContextLoss({ restoreAfter: 250 }));
  await waitForScene(page, 'recovering');
  await waitForScene(page, 'ready');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'webgl');
});

test('a failed restored frame falls back instead of reporting ready', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.addInitScript(() => {
    window.__JPD_TEST_HOOKS__ = { webglRestoreFrameFailure: true };
  });
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.simulateContextLoss({ restoreAfter: 80 }));
  await waitForScene(page, 'recovering');
  await waitForScene(page, 'fallback');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'base');
  await expect(page.locator('html')).toHaveAttribute('data-fallback-reason', 'context-lost');
});

test('a second context loss within 30 seconds falls back immediately', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.simulateContextLoss({ restoreAfter: 80 }));
  await waitForScene(page, 'recovering');
  await waitForScene(page, 'ready');
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.simulateContextLoss());
  await waitForScene(page, 'fallback');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'base');
  await expect(page.locator('html')).toHaveAttribute('data-fallback-reason', 'context-lost');
});

test('a context restoration timeout falls back to Base', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.addInitScript(() => {
    window.__JPD_TEST_HOOKS__ = { contextRestoreTimeout: 180 };
  });
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.simulateContextLoss());
  await waitForScene(page, 'recovering');
  await waitForScene(page, 'fallback');
  await expect(page.locator('html')).toHaveAttribute('data-fallback-reason', 'context-lost');
});

test('the production landing page has no uncaught errors or failed runtime assets', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  const errors = [];
  const failedAssets = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/?v=base');
  await waitForScene(page);
  await page.waitForTimeout(250);
  expect(errors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
