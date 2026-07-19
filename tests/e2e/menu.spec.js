import { test, expect } from '@playwright/test';
import { isChromiumDesktop, waitForScene } from './helpers.js';

test('fine-pointer controls are hidden at rest and support hover, focus, Escape, and outside click', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=base');
  await waitForScene(page);
  const root = page.locator('.mode-control');
  const trigger = page.locator('.mode-menu-trigger');
  await expect(trigger).toHaveAttribute('aria-label', 'Open display controls');
  const panel = page.locator('.mode-menu-panel');
  await expect(root).toHaveAttribute('data-open', 'false');
  await expect(panel).toHaveAttribute('aria-hidden', 'true');

  await trigger.focus();
  await expect(root).toHaveAttribute('data-open', 'true');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Use Canvas 2D renderer' })).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Escape');
  await expect(root).toHaveAttribute('data-open', 'false');
  await expect(trigger).toBeFocused();

  await page.evaluate(() => document.activeElement.blur());
  const triggerBox = await trigger.boundingBox();
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
  await expect(root).toHaveAttribute('data-open', 'true');
  await page.mouse.move(20, 20);
  await expect(root).toHaveAttribute('data-open', 'false');

  await trigger.focus();
  await expect(root).toHaveAttribute('data-open', 'true');
  await page.mouse.click(20, 20);
  await expect(root).toHaveAttribute('data-open', 'false');
});

test('the coarse-pointer hotspot is a 44px tap target with a visible dot', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-touch');
  await page.goto('/?v=base');
  await waitForScene(page);
  const trigger = page.locator('.mode-menu-trigger');
  const box = await trigger.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('.mode-menu-dot')).not.toHaveCSS('opacity', '0');
  await trigger.tap();
  await expect(page.locator('.mode-control')).toHaveAttribute('data-open', 'true');
  await page.locator('#logo-trigger').tap();
  await expect(page.locator('.mode-control')).toHaveAttribute('data-open', 'false');
});

test('star controls appear only for active WebGL and increment by 10,000', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=webgl');
  await waitForScene(page);
  const trigger = page.locator('.mode-menu-trigger');
  const triggerBox = await trigger.boundingBox();
  await page.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height / 2);
  const output = page.getByLabel('Current star count');
  await expect(output).toBeVisible();
  const before = await output.evaluate((element) => Number(element.value));
  await page.getByRole('button', { name: 'Add 10,000 stars' }).click();
  await expect.poll(() => output.evaluate((element) => Number(element.value))).toBe(before + 10_000);

  await page.goto('/?v=rgb');
  await waitForScene(page);
  await expect(page.locator('.star-controls')).toBeHidden();
});

test('a mode choice reloads with the requested query for clean isolation', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=base');
  await waitForScene(page);
  await page.locator('.mode-menu-trigger').focus();
  await Promise.all([
    page.waitForURL('**/?v=rgb'),
    page.getByRole('button', { name: 'Use RGB Canvas renderer' }).click(),
  ]);
  await waitForScene(page);
  await expect(page.locator('html')).toHaveAttribute('data-requested-mode', 'rgb');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'rgb');
});
