import { createFlightEngine } from '../animation/flight-engine.js';
import { getTheme } from '../themes.js';
import { createRgbAtmosphere } from './rgb-atmosphere.js';

function createCanvas(className) {
  const canvas = document.createElement('canvas');
  canvas.className = `scene-canvas ${className}`;
  canvas.setAttribute('aria-hidden', 'true');
  return canvas;
}

function randomStar(theme, width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    depth: 0.25 + Math.random() * 0.75,
    size: 0.6 + Math.random() * 2.2,
    opacity: 0.28 + Math.random() * 0.58,
    phase: Math.random() * Math.PI * 2,
    speed: 0.35 + Math.random() * 1.2,
    color: theme.starColors[Math.floor(Math.random() * theme.starColors.length)],
    flare: theme.id === 'rgb' && Math.random() < 0.032,
  };
}

export async function mountCanvasRenderer(context, themeId = 'base') {
  if (globalThis.__JPD_TEST_HOOKS__?.canvasInitFailure) {
    throw new Error('Forced Canvas initialization failure');
  }

  const theme = getTheme(themeId);
  const backgroundCanvas = createCanvas('scene-canvas-background');
  const foregroundCanvas = createCanvas('scene-canvas-foreground');
  const flightLayer = document.createElement('div');
  flightLayer.className = 'flight-layer';
  flightLayer.setAttribute('aria-hidden', 'true');
  context.container.append(backgroundCanvas, foregroundCanvas, flightLayer);

  const background = backgroundCanvas.getContext('2d');
  const foreground = foregroundCanvas.getContext('2d');
  if (!background || !foreground) throw new Error('Canvas 2D is unavailable');

  const abortController = new AbortController();
  const { signal } = abortController;
  const reducedMotion = context.motion.reducedMotion;
  const rgbAtmosphere = theme.id === 'rgb' ? createRgbAtmosphere(reducedMotion) : null;
  const flightEngine = createFlightEngine({
    layer: flightLayer,
    theme: theme.id,
    assetBase: context.assetBase,
    reducedMotion,
    initialDelay: globalThis.__JPD_TEST_HOOKS__?.immediateFlight ? 0 : undefined,
  });

  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let logoWidth = 1;
  let stars = [];
  let shootingStars = [];
  let rafId = 0;
  let lastTime = performance.now();
  let elapsed = 0;
  let nebulaElapsed = Infinity;
  let shootingElapsed = 0;
  let shootingCooldown = theme.id === 'rgb' ? 0.45 : 1.2;
  let disposed = false;
  let firstFrameResolve;
  let firstFrameReject;
  const firstFrame = new Promise((resolve, reject) => {
    firstFrameResolve = resolve;
    firstFrameReject = reject;
  });

  const pointer = {
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  };
  const mouseTarget = { x: 0, y: 0 };

  function configureCanvas(canvas, renderingContext) {
    canvas.width = Math.max(1, Math.round(width * pixelRatio));
    canvas.height = Math.max(1, Math.round(height * pixelRatio));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    renderingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    logoWidth = context.logo.offsetWidth;
    pixelRatio = theme.starShape === 'pixel'
      ? 1
      : Math.min(window.devicePixelRatio || 1, context.quality.dprLimit);
    configureCanvas(backgroundCanvas, background);
    configureCanvas(foregroundCanvas, foreground);
    const portraitCompact = height > width && width < 1200;
    const scale = width <= 480 || portraitCompact ? 0.3 : width <= 1200 ? 0.4 : 1;
    const count = Math.max(160, Math.round(theme.starCount * scale));
    stars = Array.from({ length: count }, () => randomStar(theme, width, height));
    nebulaElapsed = Infinity;
  }

  function drawNebula() {
    background.save();
    background.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    background.clearRect(0, 0, width, height);
    background.fillStyle = theme.background;
    background.fillRect(0, 0, width, height);
    const radius = Math.max(width, height) * (theme.id === 'rgb' ? 0.64 : 0.72);
    const xAnchors = [0.18, 0.78, 0.48, 0.9];
    const yAnchors = [0.24, 0.68, 0.48, 0.2];
    theme.nebula.forEach((color, index) => {
      const phase = index * 2.39 + elapsed * (reducedMotion ? 0 : 0.018);
      let x = width * xAnchors[index % xAnchors.length] + Math.sin(phase) * width * 0.07;
      let y = height * yAnchors[index % yAnchors.length] + Math.cos(phase * 0.77) * height * 0.07;
      if (theme.starShape === 'pixel') {
        x = Math.round(x / 8) * 8;
        y = Math.round(y / 8) * 8;
      }
      const gradient = background.createRadialGradient(x, y, 0, x, y, radius);
      const alpha = theme.id === 'rgb' ? 0.18 : 0.085;
      gradient.addColorStop(0, `rgba(${color},${alpha})`);
      gradient.addColorStop(0.42, `rgba(${color},${alpha * 0.38})`);
      gradient.addColorStop(1, `rgba(${color},0)`);
      background.fillStyle = gradient;
      background.fillRect(0, 0, width, height);
    });
    background.restore();
  }

  function spawnShootingStar() {
    if (shootingStars.length >= (theme.id === 'rgb' ? 5 : 3)) return;
    const angle = Math.PI * (0.16 + Math.random() * 0.18);
    const rightward = Math.random() > 0.5;
    const speed = 480 + Math.random() * 260;
    shootingStars.push({
      x: rightward ? -100 : width + 100,
      y: -40 + Math.random() * height * 0.42,
      vx: Math.cos(angle) * speed * (rightward ? 1 : -1),
      vy: Math.sin(angle) * speed,
      age: 0,
      life: 0.8 + Math.random() * (theme.id === 'rgb' ? 0.8 : 0.65),
      length: (theme.id === 'rgb' ? 88 : 65) + Math.random() * 110,
      color: theme.starColors[Math.floor(Math.random() * theme.starColors.length)],
    });
  }

  function updateAndDrawShootingStars(delta) {
    if (reducedMotion) return;
    shootingElapsed += delta;
    if (shootingElapsed >= shootingCooldown) {
      shootingElapsed = 0;
      spawnShootingStar();
      shootingCooldown = theme.id === 'rgb'
        ? 0.5 + Math.random() * 1.25
        : 1.1 + Math.random() * 2.4;
    }
    foreground.save();
    foreground.globalCompositeOperation = 'lighter';
    shootingStars = shootingStars.filter((star) => {
      star.age += delta;
      star.x += star.vx * delta;
      star.y += star.vy * delta;
      if (star.age >= star.life) return false;
      const alpha = Math.sin((star.age / star.life) * Math.PI) * 0.58;
      const speed = Math.hypot(star.vx, star.vy);
      const dx = (star.vx / speed) * star.length;
      const dy = (star.vy / speed) * star.length;
      const gradient = foreground.createLinearGradient(star.x, star.y, star.x - dx, star.y - dy);
      if (theme.id === 'rgb') {
        gradient.addColorStop(0, `rgba(${star.color},${Math.min(0.92, alpha * 1.5)})`);
        gradient.addColorStop(0.16, `rgba(255,255,255,${alpha * 0.68})`);
        gradient.addColorStop(1, `rgba(${star.color},0)`);
        foreground.shadowColor = `rgba(${star.color},${alpha * 0.8})`;
        foreground.shadowBlur = 9;
      } else {
        gradient.addColorStop(0, `rgba(225,232,255,${alpha})`);
        gradient.addColorStop(1, 'rgba(130,150,190,0)');
      }
      foreground.strokeStyle = gradient;
      foreground.lineWidth = theme.id === 'rgb' ? 2.4 : theme.starShape === 'pixel' ? 2 : 1.5;
      foreground.beginPath();
      foreground.moveTo(star.x, star.y);
      foreground.lineTo(star.x - dx, star.y - dy);
      foreground.stroke();
      foreground.shadowBlur = 0;
      return true;
    });
    foreground.restore();
  }

  function drawStars(delta) {
    foreground.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    foreground.clearRect(0, 0, width, height);
    const automaticX = reducedMotion ? 0 : Math.sin(elapsed * 0.105) * 42;
    const automaticY = reducedMotion ? 0 : Math.sin(elapsed * 0.14) * 32;
    const tilt = context.deviceTilt.getInput();
    pointer.targetX = tilt.active ? tilt.x : mouseTarget.x;
    pointer.targetY = tilt.active ? tilt.y : mouseTarget.y;
    pointer.x += (pointer.targetX - pointer.x) * Math.min(1, delta * 4.8);
    pointer.y += (pointer.targetY - pointer.y) * Math.min(1, delta * 4.8);
    const px = pointer.x + automaticX;
    const py = pointer.y + automaticY;
    rgbAtmosphere?.draw(foreground, { width, height, elapsed, delta, pointer, logoWidth });
    for (const star of stars) {
      let x = star.x - px * star.depth * 0.055;
      let y = star.y - py * star.depth * 0.055;
      let opacity = Math.max(0.12, star.opacity + Math.sin(elapsed * star.speed + star.phase) * 0.14);
      let size = star.size * (0.62 + star.depth * 0.55);
      let visibility = 1;
      if (rgbAtmosphere && !reducedMotion) {
        const depth = (star.depth + rgbAtmosphere.travel * 0.055) % 1;
        const projection = 0.25 + 0.55 / (1.2 - depth);
        x = width / 2 + (star.x - width / 2) * projection - px * depth * 0.055;
        y = height / 2 + (star.y - height / 2) * projection - py * depth * 0.055;
        visibility = Math.min(1, depth / 0.06, (1 - depth) / 0.09);
        opacity *= visibility;
        size *= Math.min(1.5, projection);
        if (star.flare && depth > 0.65) {
          foreground.strokeStyle = `rgba(${star.color},${opacity * 0.32})`;
          foreground.lineWidth = 1;
          foreground.beginPath();
          foreground.moveTo(x, y);
          foreground.lineTo(x - (x - width / 2) * depth * 0.045, y - (y - height / 2) * depth * 0.045);
          foreground.stroke();
        }
      }
      foreground.fillStyle = `rgba(${star.color},${opacity})`;
      if (theme.starShape === 'pixel') {
        x = Math.round(x / 2) * 2;
        y = Math.round(y / 2) * 2;
        const pixelSize = Math.max(1, Math.round(size));
        foreground.fillRect(x, y, pixelSize, pixelSize);
        if (star.flare) {
          const flare = Math.max(0, (Math.sin(elapsed * star.speed * 1.7 + star.phase) - 0.68) / 0.32) * visibility;
          if (flare > 0) {
            const reach = Math.max(2, Math.round(pixelSize * (2 + flare * 2)));
            foreground.fillStyle = `rgba(255,44,236,${flare * 0.2})`;
            foreground.fillRect(x - reach - 1, y, reach * 2 + pixelSize, 1);
            foreground.fillStyle = `rgba(0,235,255,${flare * 0.2})`;
            foreground.fillRect(x - reach + 1, y, reach * 2 + pixelSize, 1);
            foreground.fillStyle = `rgba(${star.color},${flare * 0.48})`;
            foreground.fillRect(x - reach, y, reach * 2 + pixelSize, 1);
            foreground.fillRect(x, y - reach, 1, reach * 2 + pixelSize);
          }
        }
      } else {
        foreground.beginPath();
        foreground.arc(x, y, Math.max(0.35, size * 0.5), 0, Math.PI * 2);
        foreground.fill();
      }
    }
    updateAndDrawShootingStars(delta);
  }

  function updateLogo() {
    if (context.coarsePointer || !context.motion.pointerParallax) {
      context.logo.style.transform = 'translate(-50%, -50%)';
      return;
    }
    const ratio = width <= 820 ? 0.02 : width <= 1200 ? 0.04 : 0.065;
    const x = -pointer.x * ratio;
    const y = -pointer.y * ratio;
    context.logo.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px))`;
  }

  function renderFrame(now) {
    if (disposed || document.hidden) return;
    try {
      const delta = globalThis.__JPD_TEST_HOOKS__?.freezeScene
        ? 0
        : Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      elapsed += delta;
      nebulaElapsed += delta;
      if (nebulaElapsed >= (reducedMotion ? 4 : 0.1)) {
        drawNebula();
        nebulaElapsed = 0;
      }
      drawStars(delta);
      flightEngine.update(delta, elapsed);
      flightEngine.drawParticles(foreground);
      updateLogo();
      firstFrameResolve?.();
      firstFrameResolve = null;
      firstFrameReject = null;
      rafId = requestAnimationFrame(renderFrame);
    } catch (error) {
      firstFrameReject?.(error);
      firstFrameResolve = null;
      firstFrameReject = null;
      context.onFatal?.('init-failed', error);
    }
  }

  function onPointerMove(event) {
    if (!context.motion.pointerParallax || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')) return;
    mouseTarget.x = event.clientX - width / 2;
    mouseTarget.y = event.clientY - height / 2;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!disposed && !rafId) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(renderFrame);
    }
  }

  resize();
  drawNebula();
  window.addEventListener('resize', resize, { signal });
  document.addEventListener('pointermove', onPointerMove, { signal });
  document.addEventListener('pointerleave', () => {
    mouseTarget.x = 0;
    mouseTarget.y = 0;
  }, { signal });
  document.addEventListener('visibilitychange', onVisibilityChange, { signal });
  if (rgbAtmosphere) context.logo.addEventListener('click', rgbAtmosphere.pulse, { signal });
  rafId = requestAnimationFrame(renderFrame);
  await firstFrame;

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafId);
      abortController.abort();
      flightEngine.dispose();
      backgroundCanvas.remove();
      foregroundCanvas.remove();
      flightLayer.remove();
      context.logo.style.transform = 'translate(-50%, -50%)';
    },
    getDiagnostics() {
      return {
        theme: theme.id,
        reducedMotion,
        starCount: stars.length,
        shootingStarCount: shootingStars.length,
        parallaxTarget: { x: pointer.targetX, y: pointer.targetY },
        ...(rgbAtmosphere ? { atmosphere: rgbAtmosphere.getDiagnostics() } : {}),
        flight: flightEngine.getDiagnostics(),
      };
    },
    spawnFlyby(type) {
      return flightEngine.spawn(type);
    },
  };
}
