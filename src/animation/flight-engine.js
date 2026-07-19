import {
  approximateBezierLength,
  cubicBezierPoint,
  cubicBezierTangent,
  generateFlybyPath,
} from '../core/bezier.js';
import { OBJECT_IDS, getObjectProfile } from '../core/flight-profiles.js';

const FILES = Object.freeze({
  rocket: 'rocket.png',
  meteorite: 'meteorite.png',
  astronaut: 'jpdaustronaut.png',
  satellite: 'satellite.png',
});

const RAINBOW = Object.freeze([
  [255, 0, 64],
  [255, 128, 0],
  [255, 245, 0],
  [40, 255, 84],
  [0, 235, 255],
  [84, 82, 255],
  [255, 44, 236],
]);

export function createFlightEngine({
  layer,
  theme = 'base',
  assetBase,
  reducedMotion = false,
  rng = Math.random,
  maxParticles = theme === 'rgb' ? 224 : 160,
  initialDelay = 5,
} = {}) {
  const particles = Array.from({ length: maxParticles }, () => ({ active: false }));
  let particleCursor = 0;
  let active = null;
  let untilNext = initialDelay;
  let disposed = false;

  function acquireParticle() {
    const particle = particles[particleCursor];
    particleCursor = (particleCursor + 1) % particles.length;
    return particle;
  }

  function emitParticle(point, tangent, profile) {
    const particle = acquireParticle();
    const spread = profile.trail === 'rainbow' ? 5 : 2.5;
    particle.active = true;
    particle.x = point.x - tangent.x * profile.width * 0.42 + (rng() - 0.5) * spread;
    particle.y = point.y - tangent.y * profile.width * 0.42 + (rng() - 0.5) * spread;
    particle.vx = -tangent.x * (8 + rng() * 11) + (rng() - 0.5) * 4;
    particle.vy = -tangent.y * (8 + rng() * 11) + (rng() - 0.5) * 4;
    particle.nx = -tangent.y;
    particle.ny = tangent.x;
    particle.age = 0;
    particle.life = profile.trail === 'rainbow' ? 0.95 + rng() * 0.45 : 0.65 + rng() * 0.55;
    particle.size = profile.trail === 'pixel' ? 2 + Math.floor(rng() * 3) : 1.3 + rng() * 2.1;
    particle.trail = profile.trail;
    particle.colorOffset = Math.floor(rng() * RAINBOW.length);
  }

  function spawn(requestedType) {
    if (disposed || reducedMotion || active) return false;
    const type = OBJECT_IDS.includes(requestedType)
      ? requestedType
      : OBJECT_IDS[Math.floor(rng() * OBJECT_IDS.length) % OBJECT_IDS.length];
    const profile = getObjectProfile(type, theme);
    const buffer = profile.width * 3 + 64;
    const path = generateFlybyPath({
      width: window.innerWidth,
      height: window.innerHeight,
      buffer,
      rng,
    });
    const pathLength = approximateBezierLength(path, 48);
    const duration = Math.max(4, pathLength / profile.speed);
    const element = document.createElement('img');
    element.className = 'flight-object';
    element.alt = '';
    element.setAttribute('aria-hidden', 'true');
    element.src = new URL(FILES[type], assetBase).href;
    element.width = profile.width;
    element.style.width = `${profile.width}px`;
    element.dataset.object = type;
    layer.append(element);
    active = {
      type,
      profile,
      path,
      pathLength,
      duration,
      elapsed: 0,
      emitElapsed: 0,
      startRotation: rng() * Math.PI * 2,
      element,
      point: path.start,
      tangent: cubicBezierTangent(path, 0),
    };
    return true;
  }

  function finishFlight() {
    active?.element.remove();
    active = null;
    untilNext = 2 + rng() * 8;
  }

  function updateParticles(delta) {
    for (const particle of particles) {
      if (!particle.active) continue;
      particle.age += delta;
      if (particle.age >= particle.life) {
        particle.active = false;
        continue;
      }
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.max(0, 1 - delta * 1.6);
      particle.vy *= Math.max(0, 1 - delta * 1.6);
    }
  }

  function update(delta, elapsedTime = 0) {
    if (disposed || reducedMotion) return;
    const safeDelta = Math.min(Math.max(delta, 0), 0.1);
    updateParticles(safeDelta);

    if (!active) {
      untilNext -= safeDelta;
      if (untilNext <= 0) spawn();
      return;
    }

    active.elapsed += safeDelta;
    const progress = Math.min(1, active.elapsed / active.duration);
    const rawPoint = cubicBezierPoint(active.path, progress);
    const tangent = cubicBezierTangent(active.path, progress);
    const profile = active.profile;
    let x = rawPoint.x;
    let y = rawPoint.y;
    let rotation = active.startRotation + profile.tumbleRate * active.elapsed;

    if (active.type === 'rocket') {
      const thrustWobble = Math.sin(elapsedTime * 8.5) * profile.wobble;
      x += -tangent.y * thrustWobble * 24;
      y += tangent.x * thrustWobble * 24;
      rotation = tangent.angle + Math.PI / 2 + thrustWobble * 0.32;
    } else if (active.type === 'astronaut') {
      x += Math.sin(active.elapsed * 1.1) * 7;
      y += Math.cos(active.elapsed * 0.8) * 5;
    } else if (active.type === 'satellite') {
      rotation = active.startRotation + Math.sin(active.elapsed * 0.5) * 0.06;
    }

    if (profile.quantized) {
      x = Math.round(x / 4) * 4;
      y = Math.round(y / 4) * 4;
      rotation = Math.round(rotation / (Math.PI / 12)) * (Math.PI / 12);
    }

    active.point = { x, y };
    active.tangent = tangent;
    active.rotation = rotation;
    active.element.dataset.tangentAngle = String(tangent.angle);
    active.element.style.transform = `translate3d(${(x - profile.width / 2).toFixed(2)}px, ${(y - profile.width / 2).toFixed(2)}px, 0) rotate(${rotation.toFixed(4)}rad)`;

    active.emitElapsed += safeDelta;
    const emitInterval = profile.trail === 'rainbow' ? 0.045 : 0.065;
    while (active.emitElapsed >= emitInterval) {
      active.emitElapsed -= emitInterval;
      emitParticle(active.point, tangent, profile);
    }

    if (progress >= 1) finishFlight();
  }

  function drawParticles(context) {
    context.save();
    for (const particle of particles) {
      if (!particle.active) continue;
      const life = 1 - particle.age / particle.life;
      if (particle.trail === 'rainbow') {
        context.globalCompositeOperation = 'lighter';
        const width = 11 + (1 - life) * 14;
        const stripe = width / RAINBOW.length;
        RAINBOW.forEach((color, index) => {
          const colorIndex = (index + particle.colorOffset) % RAINBOW.length;
          const offset = -width / 2 + stripe * (index + 0.5);
          context.strokeStyle = `rgba(${RAINBOW[colorIndex].join(',')},${life * 0.4})`;
          context.lineWidth = Math.max(1, stripe);
          context.beginPath();
          context.moveTo(particle.x + particle.nx * offset, particle.y + particle.ny * offset);
          context.lineTo(
            particle.x + particle.nx * offset + particle.vx * 0.08,
            particle.y + particle.ny * offset + particle.vy * 0.08,
          );
          context.stroke();
        });
      } else if (particle.trail === 'pixel') {
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = `rgba(208,218,245,${life * 0.48})`;
        const size = Math.max(1, Math.round(particle.size * life));
        context.fillRect(Math.round(particle.x / 2) * 2, Math.round(particle.y / 2) * 2, size, size);
      } else {
        context.globalCompositeOperation = 'lighter';
        context.fillStyle = `rgba(202,214,238,${life * 0.34})`;
        context.beginPath();
        context.arc(particle.x, particle.y, Math.max(0.3, particle.size * life), 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  return {
    update,
    drawParticles,
    spawn,
    getDiagnostics() {
      return {
        active: active
          ? {
              type: active.type,
              duration: active.duration,
              pathLength: active.pathLength,
              path: active.path,
              point: active.point,
              tangentAngle: active.tangent.angle,
              rotation: active.rotation,
            }
          : null,
        particleCount: particles.filter((particle) => particle.active).length,
        maxParticles,
      };
    },
    dispose() {
      disposed = true;
      active?.element.remove();
      active = null;
      particles.forEach((particle) => { particle.active = false; });
      layer.replaceChildren();
    },
  };
}
