import { test, expect } from '@playwright/test';
import { isChromiumDesktop, seedScene, waitForScene } from './helpers.js';

test.describe.configure({ mode: 'serial' });
test.setTimeout(60_000);

test('mode menu visual snapshot', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await seedScene(page, { freezeScene: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?v=base');
  await waitForScene(page);
  const trigger = page.getByRole('button', { name: 'Open display controls' });
  const triggerBox = await trigger.boundingBox();
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.mode-menu-panel')).toHaveScreenshot('mode-menu.png', {
    maxDiffPixels: 100,
    maxDiffPixelRatio: 0.02,
    timeout: 30_000,
  });
});

for (const theme of ['base', 'retro', 'rgb']) {
  test(`${theme} deterministic fallback visual`, async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name));
    await seedScene(page, { freezeScene: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`/?v=${theme}`);
    await waitForScene(page);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`${theme}-scene.png`, { timeout: 30_000 });
  });
}
