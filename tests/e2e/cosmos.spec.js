import { test, expect } from '@playwright/test';
import { isChromiumDesktop, seedScene, waitForScene } from './helpers.js';

test('RGB keeps the logo colors throughout its animation', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=rgb');
  await waitForScene(page);
  const filters = await page.locator('#logo').evaluate((logo) => {
    const animations = logo.getAnimations();
    animations.forEach((animation) => animation.pause());
    return Array.from({ length: 13 }, (_, second) => {
      animations.forEach((animation) => { animation.currentTime = second * 1000; });
      return getComputedStyle(logo).filter;
    });
  });
  // Colored shadows may animate around the image; its pixels must not be recolored.
  for (const filter of filters) {
    expect(filter).not.toMatch(/hue-rotate|saturate|grayscale|sepia|invert|brightness|contrast/);
  }
});

test('WebGL nebula reaches the outer sky on large screens and after resizing', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  test.setTimeout(60_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seedScene(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/?v=webgl');
  await waitForScene(page);

  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 3440, height: 1440 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await expect.poll(() => page.evaluate(() => (
      window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().drawingBufferSize
    ))).toEqual(viewport);
    const { nebulaClouds: clouds } = await page.evaluate(() => (
      window.__JPD_DIAGNOSTICS__.getRendererDiagnostics()
    ));
    // Cloud centers should occupy all four outer regions, with broad coverage.
    for (const left of [true, false]) {
      for (const top of [true, false]) {
        expect(clouds.some((cloud) => (
          (left ? cloud.x < 0.3 : cloud.x > 0.7)
          && (top ? cloud.y < 0.3 : cloud.y > 0.7)
          && cloud.width > 0.45 && cloud.height > 0.65
        ))).toBe(true);
      }
    }
    await expect(page.locator('html')).toHaveAttribute('data-renderer', 'webgl');
  }
  expect(errors).toEqual([]);
});

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
  // Exercise expiry at 20 fps without queuing hundreds of software GPU frames.
  for (let frame = 0; frame < 64; frame += 1) await page.clock.fastForward(50);
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
