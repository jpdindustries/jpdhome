import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approximateBezierLength,
  cubicBezierPoint,
  cubicBezierTangent,
  generateFlybyPath,
  isOffscreen,
} from '../../src/core/bezier.js';
import {
  createRendererState,
  transitionRendererState,
} from '../../src/core/fallback-machine.js';
import { getObjectProfile } from '../../src/core/flight-profiles.js';
import { buildModeUrl, parseRequestedMode } from '../../src/core/modes.js';
import { createMotionConfig, getQualityTier } from '../../src/core/quality.js';
import {
  calculateBlackHoleEntry,
  calculateBlackHoleLayout,
} from '../../src/renderers/black-hole.js';
import {
  STAR_MAX,
  STAR_MIN,
  STAR_STEP,
  changeStarCount,
  clampStarCount,
  distributeStarCount,
} from '../../src/core/stars.js';

test('mode parsing preserves the public URL contract', () => {
  assert.equal(parseRequestedMode(''), 'auto');
  assert.equal(parseRequestedMode('?v=webgl'), 'webgl');
  assert.equal(parseRequestedMode('?v=base'), 'base');
  assert.equal(parseRequestedMode('?v=retro'), 'retro');
  assert.equal(parseRequestedMode('?v=rgb'), 'rgb');
  assert.equal(parseRequestedMode('?v=WEBGL'), 'auto');
  assert.equal(parseRequestedMode('?v=unknown'), 'auto');
  assert.equal(parseRequestedMode('?other=value'), 'auto');

  const forced = buildModeUrl({ href: 'https://example.test/jpdhome/?keep=yes#logo' }, 'rgb');
  assert.equal(forced, 'https://example.test/jpdhome/?keep=yes&v=rgb#logo');
  const automatic = buildModeUrl({ href: forced }, 'auto');
  assert.equal(automatic, 'https://example.test/jpdhome/?keep=yes#logo');
});

test('cubic Bézier helpers produce a curved, measured offscreen flyby', () => {
  const values = [0.01, 0.4, 0.25, 0.75, 0.8, 0.2];
  let index = 0;
  const path = generateFlybyPath({
    width: 1200,
    height: 700,
    buffer: 100,
    rng: () => values[index++ % values.length],
  });
  assert.equal(isOffscreen(path.start, 1200, 700), true);
  assert.equal(isOffscreen(path.end, 1200, 700), true);
  assert.deepEqual(cubicBezierPoint(path, 0), path.start);
  assert.deepEqual(cubicBezierPoint(path, 1), path.end);
  const visibleSamples = Array.from({ length: 31 }, (_, sample) => (
    cubicBezierPoint(path, sample / 30)
  )).filter((point) => !isOffscreen(point, 1200, 700));
  assert.ok(visibleSamples.length >= 10);
  const directDistance = Math.hypot(path.end.x - path.start.x, path.end.y - path.start.y);
  assert.ok(approximateBezierLength(path, 64) > directDistance);
  const tangent = cubicBezierTangent(path, 0.5);
  assert.ok(Math.abs(Math.hypot(tangent.x, tangent.y) - 1) < 1e-9);
  assert.equal(Number.isFinite(tangent.angle), true);
});

test('object profiles encode distinct flight behavior', () => {
  const rocket = getObjectProfile('rocket');
  const meteorite = getObjectProfile('meteorite');
  const astronaut = getObjectProfile('astronaut');
  const satellite = getObjectProfile('satellite');
  assert.ok(rocket.speed > astronaut.speed);
  assert.ok(meteorite.tumbleRate > astronaut.tumbleRate);
  assert.ok(astronaut.tumbleRate > satellite.tumbleRate);
  assert.ok(satellite.stability > rocket.stability);
  assert.equal(getObjectProfile('rocket', 'retro').quantized, true);
  assert.equal(getObjectProfile('rocket', 'rgb').trail, 'rainbow');
  assert.equal(getObjectProfile('rocket', 'base').trail, 'neutral');
});

test('reduced motion is ambient-only and quality tiers keep DPR limits', () => {
  const reduced = createMotionConfig(true);
  assert.equal(reduced.pointerParallax, false);
  assert.equal(reduced.automaticFlight, false);
  assert.equal(reduced.flybys, false);
  assert.equal(reduced.celestialEvents, false);
  assert.equal(reduced.gentleTwinkle, true);
  assert.equal(reduced.blackHoleGrowthDuration, 0);

  assert.equal(getQualityTier({ width: 500, devicePixelRatio: 3 }).name, 'compact');
  assert.equal(getQualityTier({ width: 1000, devicePixelRatio: 3 }).name, 'mid');
  assert.equal(getQualityTier({ width: 1600, devicePixelRatio: 3 }).name, 'desktop');
  assert.equal(getQualityTier({ width: 1600, devicePixelRatio: 3 }).pixelRatio, 2);
  assert.equal(getQualityTier({ width: 1600, coarsePointer: true }).name, 'compact');
});

test('black-hole layout wraps the unchanged logo with a broad outer lens', () => {
  const desktop = calculateBlackHoleLayout({
    viewportWidth: 1280,
    viewportHeight: 720,
    logoWidth: 307.2,
    logoHeight: 307.2,
  });
  assert.ok(desktop.coreDiameterCss >= desktop.logoDiameterCss + 47);
  assert.ok(desktop.startCoreDiameterCss > desktop.logoDiameterCss);
  assert.ok(desktop.startCoreDiameterCss < desktop.coreDiameterCss);
  assert.ok(desktop.targetDiameterCss >= 460);
  assert.ok(desktop.lensDiameterCss >= 720);
  assert.ok(desktop.coreRadius <= desktop.targetRadius * 0.82);

  const phone = calculateBlackHoleLayout({
    viewportWidth: 390,
    viewportHeight: 844,
    logoWidth: 203,
    logoHeight: 203,
  });
  assert.ok(phone.coreDiameterCss > phone.logoDiameterCss);
  assert.ok(phone.targetRadius > desktop.targetRadius);
  assert.ok(phone.coreRadius <= phone.targetRadius * 0.82);

  const phoneLandscape = calculateBlackHoleLayout({
    viewportWidth: 844,
    viewportHeight: 390,
    logoWidth: 280,
    logoHeight: 280,
  });
  assert.ok(phoneLandscape.coreDiameterCss >= 318.9);
  assert.ok(phoneLandscape.startCoreDiameterCss > phoneLandscape.logoDiameterCss);
  assert.ok(phoneLandscape.startCoreDiameterCss < phoneLandscape.coreDiameterCss);
  assert.ok(phoneLandscape.targetRadius > 0.49);
  assert.ok(phoneLandscape.coreRadius <= phoneLandscape.targetRadius * 0.82);
});

test('black-hole entry reveals core, lens, rim, and disk in deliberate stages', () => {
  assert.deepEqual(calculateBlackHoleEntry(0), {
    core: 0,
    radius: 0,
    lens: 0,
    rim: 0,
    disk: 0,
    dim: 0,
    gather: 0,
  });

  const opening = calculateBlackHoleEntry(0.05);
  assert.ok(opening.core > 0.05 && opening.core < 0.07);
  assert.ok(opening.radius > 0.01 && opening.radius < 0.02);
  assert.ok(opening.lens < 0.001);
  assert.ok(opening.rim < 0.001);
  assert.equal(opening.disk, 0);
  assert.equal(opening.dim, 0);
  assert.equal(opening.gather, 0);

  const forming = calculateBlackHoleEntry(0.2);
  assert.ok(forming.core > 0.95 && forming.core < 0.98);
  assert.ok(forming.radius > 0.45 && forming.radius < 0.46);
  assert.ok(forming.lens > 0.08 && forming.lens < 0.09);
  assert.ok(forming.rim > 0.35 && forming.rim < 0.36);
  assert.ok(forming.disk > 0.05 && forming.disk < 0.06);
  assert.ok(forming.dim > 0.06 && forming.dim < 0.08);
  assert.ok(forming.gather < 0.001);

  const established = calculateBlackHoleEntry(0.42);
  assert.equal(established.core, 1);
  assert.equal(established.radius, 1);
  assert.equal(established.rim, 1);
  assert.ok(established.lens > 0.52 && established.lens < 0.53);
  assert.ok(established.disk > 0.7 && established.disk < 0.72);
  assert.ok(established.dim > 0.58 && established.dim < 0.59);
  assert.ok(established.gather > 0.17 && established.gather < 0.19);

  assert.deepEqual(calculateBlackHoleEntry(0.95), {
    core: 1,
    radius: 1,
    lens: 1,
    rim: 1,
    disk: 1,
    dim: 1,
    gather: 1,
  });
  assert.deepEqual(calculateBlackHoleEntry(0, true), {
    core: 1,
    radius: 1,
    lens: 1,
    rim: 1,
    disk: 1,
    dim: 1,
    gather: 1,
  });

  const keys = ['core', 'radius', 'lens', 'rim', 'disk', 'dim', 'gather'];
  let previous = calculateBlackHoleEntry(0);
  for (let step = 1; step <= 1000; step += 1) {
    const current = calculateBlackHoleEntry(step / 1000);
    for (const key of keys) {
      assert.ok(current[key] >= previous[key]);
      assert.ok(current[key] >= 0 && current[key] <= 1);
    }
    previous = current;
  }
});

test('star-count logic keeps 10k controls and the intentional 2.4m ceiling', () => {
  assert.equal(clampStarCount(-1), STAR_MIN);
  assert.equal(clampStarCount(3_000_000), STAR_MAX);
  assert.equal(clampStarCount(Number.NaN), STAR_MIN);
  assert.equal(changeStarCount(64_000, 1), 64_000 + STAR_STEP);
  assert.equal(changeStarCount(STAR_MAX, 1), STAR_MAX);
  assert.equal(changeStarCount(STAR_MIN, -1), STAR_MIN);
  const distribution = distributeStarCount(STAR_MAX, [18_000, 31_000, 15_000]);
  assert.equal(distribution.reduce((sum, count) => sum + count, 0), STAR_MAX);
  distribution.forEach((count) => assert.ok(count > 0));
});

test('renderer state recovers once and falls back on repeated loss or timeout', () => {
  let state = createRendererState('auto');
  state = transitionRendererState(state, { type: 'READY', renderer: 'webgl' });
  assert.equal(state.status, 'ready');
  state = transitionRendererState(state, { type: 'CONTEXT_LOST', at: 1_000 });
  assert.equal(state.status, 'recovering');
  state = transitionRendererState(state, { type: 'CONTEXT_RESTORED' });
  assert.equal(state.status, 'ready');
  state = transitionRendererState(state, { type: 'CONTEXT_LOST', at: 20_000 });
  assert.equal(state.status, 'fallback');
  assert.equal(state.renderer, 'base');
  assert.equal(state.fallbackReason, 'context-lost');

  state = createRendererState('webgl');
  state = transitionRendererState(state, { type: 'READY', renderer: 'webgl' });
  state = transitionRendererState(state, { type: 'CONTEXT_LOST', at: 50_000 });
  state = transitionRendererState(state, { type: 'RESTORE_TIMEOUT' });
  assert.equal(state.status, 'fallback');
  assert.equal(state.fallbackReason, 'context-lost');

  state = transitionRendererState(createRendererState('auto'), {
    type: 'FAIL',
    reason: 'import-failed',
  });
  assert.equal(state.status, 'fallback');
  assert.equal(state.fallbackReason, 'import-failed');
});
