import { test, expect } from '@playwright/test';
import { isChromiumDesktop, waitForScene } from './helpers.js';

function angleDifference(first, second) {
  return Math.atan2(Math.sin(first - second), Math.cos(first - second));
}

for (const theme of ['base', 'retro', 'rgb']) {
  test(`${theme} uses curved offscreen flybys with bounded trails`, async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name));
    await page.goto(`/?v=${theme}`);
    await waitForScene(page);
    const spawned = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.spawnFlyby('rocket'));
    expect(spawned).toBe(true);
    await page.waitForTimeout(180);
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
    const flight = diagnostics.flight;
    expect(flight.active).not.toBeNull();
    const { start, end, control1, control2 } = flight.active.path;
    const width = await page.evaluate(() => innerWidth);
    const height = await page.evaluate(() => innerHeight);
    const offscreen = (point) => point.x < 0 || point.x > width || point.y < 0 || point.y > height;
    expect(offscreen(start)).toBe(true);
    expect(offscreen(end)).toBe(true);
    expect(control1).not.toEqual(start);
    expect(control2).not.toEqual(end);
    expect(Math.abs(angleDifference(
      flight.active.rotation,
      flight.active.tangentAngle + Math.PI / 2,
    ))).toBeLessThan(0.2);
    expect(flight.particleCount).toBeLessThanOrEqual(flight.maxParticles);
    if (theme === 'retro') {
      expect(Math.abs(flight.active.point.x % 4)).toBeLessThan(0.001);
      expect(Math.abs(flight.active.point.y % 4)).toBeLessThan(0.001);
    }
  });
}

for (const [theme, trail] of [['base', 'neutral'], ['rgb', 'rainbow']]) {
  test(`${theme} automatically shows an onscreen object with its ${trail} trail`, async ({ page }, testInfo) => {
    test.skip(!isChromiumDesktop(testInfo.project.name));
    await page.goto(`/?v=${theme}`);
    await waitForScene(page);

    await expect.poll(async () => {
      const diagnostics = await page.evaluate(
        () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
      );
      return diagnostics.flight.active?.visible || false;
    }, { timeout: 7_000 }).toBe(true);

    const diagnostics = await page.evaluate(
      () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
    );
    expect(diagnostics.flight.active.trail).toBe(trail);
    expect(diagnostics.flight.particleCounts[trail]).toBeGreaterThan(0);
    await expect(page.locator('.flight-object')).toHaveCount(1);
  });
}

test('Canvas resize and visibility handlers pause and resume one flight loop', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=base');
  await waitForScene(page);
  await page.evaluate(() => window.__JPD_DIAGNOSTICS__.spawnFlyby('rocket'));
  await page.waitForTimeout(150);
  const pausedAt = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    return window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().flight.active.point;
  });
  await page.waitForTimeout(220);
  const whilePaused = await page.evaluate(() => (
    window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().flight.active.point
  ));
  expect(whilePaused).toEqual(pausedAt);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(180);
  const afterResume = await page.evaluate(() => (
    window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().flight.active.point
  ));
  expect(afterResume).not.toEqual(whilePaused);

  await page.setViewportSize({ width: 900, height: 600 });
  await expect.poll(() => page.locator('.scene-canvas').first().evaluate((canvas) => [canvas.width, canvas.height]))
    .toEqual([900, 600]);
  await expect(page.locator('.scene-canvas')).toHaveCount(2);
});

test('WebGL starts idle flight immediately and eases into pointer parallax', async ({ page }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  await page.goto('/?v=webgl');
  await waitForScene(page);

  const initial = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
  expect(initial.flightIntensity).toBeGreaterThan(0.75);
  expect(initial.interactionBlend).toBe(0);
  expect(initial.nebulaMaxOpacity).toBeLessThanOrEqual(0.32);
  expect(initial.nebulaUsesNormalBlending).toBe(true);

  await expect.poll(async () => {
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
    return diagnostics.flightDistance;
  }).toBeGreaterThan(initial.flightDistance + 5);

  await page.mouse.move(1120, 120);
  await page.waitForTimeout(80);
  const entering = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
  expect(entering.interactionBlend).toBeGreaterThan(0);
  expect(entering.interactionBlend).toBeLessThan(0.65);
  expect(Math.abs(entering.flightIntensity - initial.flightIntensity)).toBeLessThan(0.16);

  let pointerSample = 0;
  await expect.poll(async () => {
    // Keep the pointer active while measuring its response, including on a
    // software GPU where the short idle timeout can span only a few frames.
    await page.mouse.move(1120 + (pointerSample++ % 2), 120);
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
    return diagnostics.interactionBlend;
  }).toBeGreaterThan(0.55);
  const activeBlend = await page.evaluate(() => (
    window.__JPD_DIAGNOSTICS__.getRendererDiagnostics().interactionBlend
  ));
  await expect.poll(async () => {
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
    return diagnostics.flightIntensity;
  }).toBeLessThan(0.7);

  await expect.poll(async () => {
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
    return diagnostics.interactionBlend;
  }, { timeout: 5_000 }).toBeLessThan(activeBlend);
});

test('the black hole stays centered without shrinking the logo at DPR 2', async ({ browser }, testInfo) => {
  test.skip(!isChromiumDesktop(testInfo.project.name));
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      window.__JPD_TEST_HOOKS__ = { blackHoleProgressOverride: 0 };
    });
    await page.goto('/?v=webgl');
    await waitForScene(page);
    const before = await page.locator('#logo-trigger').boundingBox();
    await page.evaluate(() => window.__JPD_DIAGNOSTICS__.activateBlackHole());
    await expect(page.locator('html')).toHaveAttribute('data-black-hole', 'active');
    const opening = await page.evaluate(
      () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
    );
    expect(opening.blackHoleProgress).toBe(0);
    expect(opening.blackHoleEntry).toEqual({
      core: 0,
      radius: 0,
      lens: 0,
      rim: 0,
      disk: 0,
      dim: 0,
      gather: 0,
    });
    expect(opening.blackHoleStartCoreDiameterCss).toBeGreaterThan(before.width + 13);
    expect(opening.blackHoleStartCoreDiameterCss).toBeLessThan(opening.blackHoleCoreDiameterCss);
    expect(opening.blackHoleCurrentCoreDiameterCss).toBeCloseTo(
      opening.blackHoleStartCoreDiameterCss,
      5,
    );

    await page.evaluate(() => {
      window.__JPD_TEST_HOOKS__.blackHoleProgressOverride = 0.2;
    });
    await expect.poll(async () => {
      const current = await page.evaluate(
        () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
      );
      return current.blackHoleProgress;
    }).toBe(0.2);
    const forming = await page.evaluate(
      () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
    );
    expect(forming.blackHoleEntry.core).toBeGreaterThan(0.95);
    expect(forming.blackHoleEntry.radius).toBeGreaterThan(0.45);
    expect(forming.blackHoleEntry.radius).toBeLessThan(0.46);
    expect(forming.blackHoleEntry.lens).toBeLessThan(0.1);
    expect(forming.blackHoleEntry.rim).toBeGreaterThan(0.35);
    expect(forming.blackHoleEntry.rim).toBeLessThan(0.36);
    expect(forming.blackHoleEntry.disk).toBeLessThan(0.06);
    expect(forming.blackHoleCurrentCoreDiameterCss).toBeGreaterThan(
      opening.blackHoleCurrentCoreDiameterCss,
    );
    expect(forming.blackHoleCurrentCoreDiameterCss).toBeLessThan(
      opening.blackHoleCoreDiameterCss,
    );

    await page.evaluate(() => {
      window.__JPD_TEST_HOOKS__.blackHoleProgressOverride = 1;
    });
    await expect.poll(async () => {
      const current = await page.evaluate(
        () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
      );
      return current.blackHoleProgress;
    }).toBe(1);
    const after = await page.locator('#logo-trigger').boundingBox();
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());

    expect(await page.evaluate(() => devicePixelRatio)).toBe(2);
    expect(Math.abs(after.width - before.width)).toBeLessThan(0.5);
    expect(Math.abs(after.height - before.height)).toBeLessThan(0.5);
    expect(Math.abs(after.x + after.width / 2 - 640)).toBeLessThan(0.5);
    expect(Math.abs(after.y + after.height / 2 - 360)).toBeLessThan(0.5);
    expect(Math.abs(
      diagnostics.blackHoleCenter.x - diagnostics.drawingBufferSize.width / 2,
    )).toBeLessThan(0.5);
    expect(Math.abs(
      diagnostics.blackHoleCenter.y - diagnostics.drawingBufferSize.height / 2,
    )).toBeLessThan(0.5);
    expect(diagnostics.blackHoleCoreDiameterCss).toBeGreaterThan(before.width + 40);
    expect(diagnostics.blackHoleCurrentCoreDiameterCss).toBeCloseTo(
      diagnostics.blackHoleCoreDiameterCss,
      5,
    );
    expect(diagnostics.blackHoleEntry).toEqual({
      core: 1,
      radius: 1,
      lens: 1,
      rim: 1,
      disk: 1,
      dim: 1,
      gather: 1,
    });
    expect(diagnostics.blackHoleTargetDiameterCss).toBeGreaterThanOrEqual(460);
    expect(diagnostics.blackHoleLensDiameterCss).toBeGreaterThanOrEqual(720);
    expect(diagnostics.blackHoleSceneTargetSize).toEqual(diagnostics.drawingBufferSize);
    expect(diagnostics.blackHoleDistortionTargetSize).toEqual(diagnostics.drawingBufferSize);

    await expect.poll(async () => {
      const moving = await page.evaluate(
        () => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics(),
      );
      return moving.blackHoleFlowTime;
    }, { timeout: 10_000 }).toBeGreaterThan(diagnostics.blackHoleFlowTime);
  } finally {
    await context.close();
  }
});

test('reduced motion stays ambient-only', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?v=base');
  await waitForScene(page);
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.mouse.move(1000, 500);
  await page.waitForTimeout(150);
  const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
  expect(diagnostics.shootingStarCount).toBe(0);
  expect(diagnostics.flight.active).toBeNull();
  expect(await page.evaluate(() => window.__JPD_DIAGNOSTICS__.spawnFlyby('rocket'))).toBe(false);
  await expect(page.locator('#logo-trigger')).toHaveCSS('transform', /matrix\(1, 0, 0, 1, -/);
});

test('reduced motion reveals the black-hole final state without growth', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'reduced-motion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?v=webgl');
  await waitForScene(page);
  await page.locator('#logo-trigger').click({ clickCount: 3 });
  await expect(page.locator('html')).toHaveAttribute('data-black-hole', 'active');
  await expect.poll(async () => {
    const diagnostics = await page.evaluate(() => window.__JPD_DIAGNOSTICS__.getRendererDiagnostics());
    return diagnostics.blackHoleProgress;
  }).toBe(1);
});
