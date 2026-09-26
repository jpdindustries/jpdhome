import { test, expect } from '@playwright/test';
import { waitForScene } from './helpers.js';

for (const renderer of ['base', 'webgl']) {
  test(`${renderer} responds to mobile tilt while the logo stays centered`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'pixel-touch');
    await page.goto(`/?v=${renderer}`);
    await waitForScene(page);

    const sendOrientation = (beta, gamma) => page.evaluate(({ beta, gamma }) => {
      window.dispatchEvent(Object.assign(new Event('deviceorientation'), { beta, gamma }));
    }, { beta, gamma });

    await sendOrientation(25, 0);
    await sendOrientation(25, 12);
    await expect.poll(async () => {
      const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
      return diagnostics.parallaxTarget.x;
    }).toBeGreaterThan(50);

    const logo = await page.locator('#logo-trigger').boundingBox();
    const viewport = page.viewportSize();
    expect(Math.abs(logo.x + logo.width / 2 - viewport.width / 2)).toBeLessThan(1);
    expect(Math.abs(logo.y + logo.height / 2 - viewport.height / 2)).toBeLessThan(1);

    await page.locator('.mode-menu-trigger').tap();
    await page.getByRole('button', { name: 'Disable tilt motion' }).tap();
    await expect.poll(async () => {
      const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
      return diagnostics.parallaxTarget.x;
    }).toBe(0);
  });
}

test('the mobile control requests motion permission before enabling tilt', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-touch');
  await page.addInitScript(() => {
    let grants = 0;
    Object.defineProperty(DeviceOrientationEvent, 'requestPermission', {
      configurable: true,
      value: () => Promise.resolve(++grants === 1 ? 'denied' : 'granted'),
    });
  });
  await page.goto('/?v=base');
  await waitForScene(page);
  await page.locator('.mode-menu-trigger').tap();
  await page.getByRole('button', { name: 'Enable tilt motion' }).tap();
  await expect(page.getByRole('button', { name: 'Retry tilt motion permission' })).toHaveText('Tilt blocked');
  await page.getByRole('button', { name: 'Retry tilt motion permission' }).tap();
  await expect(page.getByRole('button', { name: 'Disable tilt motion' })).toHaveAttribute('aria-pressed', 'true');
});
