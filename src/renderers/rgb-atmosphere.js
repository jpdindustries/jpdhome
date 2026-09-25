const TAU = Math.PI * 2;
const ORBIT_SIZE = 512;
const ORBIT_RADIUS = 224;

function createOrbitTexture(orbit) {
  const canvas = document.createElement('canvas');
  canvas.width = ORBIT_SIZE;
  canvas.height = ORBIT_SIZE;
  const context = canvas.getContext('2d');
  context.translate(ORBIT_SIZE / 2, ORBIT_SIZE / 2);
  for (let segment = 0; segment < 144; segment += 1) {
    const angle = segment / 144 * TAU;
    const direction = orbit ? -1 : 1;
    const distance = (-angle * direction % TAU + TAU) % TAU;
    const tail = Math.exp(-distance * 1.65);
    context.strokeStyle = `hsla(${angle * 180 / Math.PI + orbit * 100},100%,70%,${0.065 + tail * 0.5})`;
    context.lineWidth = 0.8 + tail * 1.5;
    context.beginPath();
    context.arc(0, 0, ORBIT_RADIUS, angle, angle + TAU / 144 + 0.003);
    context.stroke();
  }
  const glow = context.createRadialGradient(ORBIT_RADIUS, 0, 0, ORBIT_RADIUS, 0, 16);
  glow.addColorStop(0, `hsla(${orbit * 120 + 180},100%,85%,0.65)`);
  glow.addColorStop(1, `hsla(${orbit * 120 + 180},100%,60%,0)`);
  context.fillStyle = glow;
  context.fillRect(ORBIT_RADIUS - 16, -16, 32, 32);
  return canvas;
}

export function createRgbAtmosphere(reducedMotion) {
  const pulses = [];
  const orbitTextures = [createOrbitTexture(0), createOrbitTexture(1)];
  let time = 0;
  let travel = 0;

  function pulse() {
    if (reducedMotion) return false;
    if (pulses.length === 3) pulses.shift();
    pulses.push(time);
    return true;
  }

  function draw(context, { width, height, elapsed, delta, pointer, logoWidth }) {
    time = reducedMotion ? 0 : elapsed;
    while (pulses.length && time - pulses[0] > 2.8) pulses.shift();
    const energy = pulses.reduce((sum, started) => (
      sum + Math.sin(Math.min(1, (time - started) / 2.8) * Math.PI)
    ), 0) / 3;
    travel += reducedMotion ? 0 : delta * (1 + energy * 2);
    const centerX = width / 2 - pointer.x * 0.025;
    const centerY = height / 2 - pointer.y * 0.025;
    const radius = Math.max(logoWidth * 0.84, Math.min(width, height) * 0.32);
    const hue = time * 12;
    context.save();
    context.globalCompositeOperation = 'lighter';

    // Long, translucent curtains move as a continuous surface across the sky.
    for (let band = 0; band < 3; band += 1) {
      context.beginPath();
      for (let step = 0; step <= 48; step += 1) {
        const x = width * step / 48;
        const wave = Math.sin(step / 48 * 7 + time * 0.13 + band * 1.3)
          + Math.sin(step / 48 * 13 - time * 0.09) * 0.3;
        const y = height * (0.24 + band * 0.05 + wave * 0.07);
        if (step === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.lineTo(width, height * 0.68);
      context.lineTo(0, height * 0.68);
      context.closePath();
      const glow = context.createLinearGradient(0, height * 0.12, 0, height * 0.62);
      glow.addColorStop(0, `hsla(${hue + band * 85 + 170},100%,60%,0)`);
      glow.addColorStop(0.3, `hsla(${hue + band * 85 + 170},100%,60%,0.045)`);
      glow.addColorStop(1, `hsla(${hue + band * 85 + 230},100%,60%,0)`);
      context.fillStyle = glow;
      context.fill();
    }

    const horizon = height * 0.64;
    const floorHeight = height - horizon;
    const vanishingX = centerX + Math.sin(time * 0.22) * width * 0.018;
    const horizonGlow = context.createLinearGradient(0, horizon, width, horizon);
    horizonGlow.addColorStop(0, 'rgba(255,44,236,0)');
    horizonGlow.addColorStop(0.5, 'rgba(0,235,255,0.38)');
    horizonGlow.addColorStop(1, 'rgba(255,44,236,0)');
    context.strokeStyle = horizonGlow;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, horizon);
    context.lineTo(width, horizon);
    context.stroke();
    for (let row = 0; row <= 15; row += 1) {
      const progress = (row + (travel * 0.38) % 1) / 15;
      if (progress > 1) continue;
      const depth = progress ** 2.05;
      const y = horizon + floorHeight * depth;
      const edgeFade = Math.min(1, (1 - progress) * 12);
      context.strokeStyle = `hsla(${hue + progress * 160 + 180},100%,65%,${(0.04 + depth * 0.22 + energy * 0.1) * edgeFade})`;
      context.lineWidth = 0.6 + depth * 1.15;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    for (let column = -10; column <= 10; column += 1) {
      context.strokeStyle = `hsla(${hue + column * 14 + 240},100%,65%,0.15)`;
      context.lineWidth = Math.abs(column) % 5 === 0 ? 1.2 : 0.7;
      context.beginPath();
      context.moveTo(vanishingX, horizon);
      context.lineTo(vanishingX + column * width * 0.13, height);
      context.stroke();
    }

    // Rotate cached circular wakes before flattening them into tilted orbits.
    // This avoids rebuilding hundreds of stroked arcs on every animation frame.
    context.translate(centerX, centerY);
    context.rotate(-0.26);
    for (let orbit = 0; orbit < 2; orbit += 1) {
      const orbitRadius = radius * (1 + orbit * 0.2);
      const flatten = 0.48 + orbit * 0.12;
      const head = time * (orbit ? -0.32 : 0.42) + orbit * Math.PI;
      const scale = orbitRadius / ORBIT_RADIUS;
      context.save();
      context.scale(scale, scale * flatten);
      context.rotate(head);
      context.drawImage(orbitTextures[orbit], -ORBIT_SIZE / 2, -ORBIT_SIZE / 2);
      context.restore();
      const headX = Math.cos(head) * orbitRadius;
      const headY = Math.sin(head) * orbitRadius * flatten;
      context.fillStyle = 'rgba(235,255,255,0.85)';
      context.fillRect(Math.round(headX) - 1, Math.round(headY) - 1, 3, 3);
    }
    for (const started of pulses) {
      const progress = (time - started) / 2.8;
      const ringRadius = radius * (0.6 + progress * 2.8);
      context.strokeStyle = `hsla(${hue + progress * 240},100%,72%,${Math.sin(progress * Math.PI) * 0.38})`;
      context.lineWidth = 1.5;
      context.beginPath();
      context.ellipse(0, 0, ringRadius, ringRadius * 0.6, 0, 0, TAU);
      context.stroke();
    }
    context.restore();
  }

  return {
    draw,
    pulse,
    get travel() { return travel; },
    getDiagnostics: () => ({ time, travel, pulseCount: pulses.length }),
  };
}
