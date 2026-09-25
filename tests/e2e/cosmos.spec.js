import { test, expect } from '@playwright/test';
import { waitForScene } from './helpers.js';

test('RGB orbits advance, pause with the tab, and keep logo pulses bounded', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'reduced-motion');
  test.setTimeout(60_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/?v=rgb');
  await waitForScene(page);
  await page.clock.pauseAt(new Date('2026-01-01T00:01:00Z'));
  const atmosphere = () => page.evaluate(() => (
    window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().atmosphere
  ));
  const initial = await atmosphere();
  await page.clock.runFor(100);
  expect((await atmosphere()).travel).toBeGreaterThan(initial.travel);

  await page.evaluate(() => {
    for (let click = 0; click < 12; click += 1) document.getElementById('logo-trigger').click();
  });
  expect((await atmosphere()).pulseCount).toBe(3);
  const paused = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().atmosphere;
  });
  await page.clock.runFor(150);
  expect(await atmosphere()).toEqual(paused);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.runFor(3_200);
  expect((await atmosphere()).travel).toBeGreaterThan(paused.travel);
  expect((await atmosphere()).pulseCount).toBe(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.scene-canvas-foreground')).toHaveJSProperty('width', 390);
  await expect(page.locator('html')).toHaveAttribute('data-scene-status', 'ready');
  expect(errors).toEqual([]);
});

test('reduced-motion RGB keeps its orbits, floor, and pulses still', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?v=rgb');
  await waitForScene(page);
  await page.locator('#logo-trigger').click();
  await page.mouse.move(1100, 180);
  await page.waitForTimeout(250);
  const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
  expect(diagnostics.atmosphere).toEqual({ time: 0, travel: 0, pulseCount: 0 });
  expect(diagnostics.flight.active).toBeNull();
  expect(diagnostics.shootingStarCount).toBe(0);
  await expect(page.locator('#logo')).toHaveCSS('animation-name', 'none');
});

test('the black-hole shaders render and resize on a compact touch viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-touch');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.addInitScript(() => {
    window.__JPD_TEST_HOOKS__ = { blackHoleGrowthDuration: 0 };
  });
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.activateBlackHole());
  await expect.poll(() => page.evaluate(() => (
    window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().blackHoleProgress
  ))).toBe(1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.evaluate(() => (
    window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().drawingBufferSize.width
  ))).toBeGreaterThan(800);
  const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
  expect(diagnostics.blackHoleSceneTargetSize).toEqual(diagnostics.drawingBufferSize);
  expect(diagnostics.blackHoleDistortionTargetSize).toEqual(diagnostics.drawingBufferSize);
  expect(diagnostics.blackHoleCenter.x).toBe(diagnostics.drawingBufferSize.width / 2);
  expect(diagnostics.blackHoleCenter.y).toBe(diagnostics.drawingBufferSize.height / 2);
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'webgl');
  expect(errors).toEqual([]);
});
