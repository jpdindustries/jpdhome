import * as THREE from 'three';
import { distributeStarCount, clampStarCount } from '../core/stars.js';

const STAR_LAYER_SHAPES = Object.freeze([
  { size: 1.15, farZ: -3800, nearZ: 560, spread: 3000, parallax: 0.04, speed: 0.62 },
  { size: 1.65, farZ: -3050, nearZ: 660, spread: 2700, parallax: 0.09, speed: 0.9 },
  { size: 2.25, farZ: -2150, nearZ: 780, spread: 2350, parallax: 0.16, speed: 1.22 },
]);

const IDLE_FLIGHT_INTENSITY = 0.82;
const POINTER_FLIGHT_INTENSITY = 0.26;
const POINTER_ACTIVITY_HOLD_MS = 1100;

function webglError(reason, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.fallbackReason = reason;
  return error;
}

function damp(current, target, lambda, delta) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

export async function mount(context) {
  const hooks = globalThis.__JPD_TEST_HOOKS__ || {};
  if (hooks.webglUnavailable) {
    throw webglError('webgl-unavailable', 'Forced WebGL2 unavailability');
  }

  const canvas = document.createElement('canvas');
  canvas.id = 'webgl-canvas';
  canvas.className = 'scene-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  context.container.append(canvas);

  let gl;
  try {
    gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: context.quality.antialias,
      depth: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
    });
  } catch (error) {
    canvas.remove();
    throw webglError('webgl-unavailable', 'WebGL2 context creation threw an error', error);
  }
  if (!gl) {
    canvas.remove();
    throw webglError('webgl-unavailable', 'WebGL2 is unavailable');
  }

  const abortController = new AbortController();
  const { signal } = abortController;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 1, 5000);
  camera.position.z = 980;
  const clock = new THREE.Clock();
  const starLayers = [];
  const nebulaSprites = [];
  const celestialEvents = [];
  const pointerTarget = new THREE.Vector2();
  const pointerCurrent = new THREE.Vector2();
  const blackHole = createBlackHolePass(context.motion.reducedMotion);
  const baseWeights = [...context.quality.starCounts];
  let currentStarCount = baseWeights.reduce((sum, count) => sum + count, 0);
  let renderer;
  let celestialCanvas;
  let celestialContext;
  let rafId = 0;
  let disposed = false;
  let recovering = false;
  let fatalReported = false;
  let restoreTimeout = 0;
  let simulatedRestoreTimeout = 0;
  let lastContextLossAt = null;
  let pointerActiveUntil = 0;
  let interactionBlend = 0;
  let flightIntensity = context.motion.automaticFlight ? IDLE_FLIGHT_INTENSITY : 0;
  let flightDistance = 0;
  let elapsed = 0;
  let nextCelestialAt = 2 + Math.random() * 2;
  let framesForQuality = 0;
  let qualityWindowStarted = performance.now();
  let qualityReduced = false;

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      alpha: true,
      antialias: context.quality.antialias,
      powerPreference: 'high-performance',
    });
    renderer.debug.checkShaderErrors = true;
    renderer.setPixelRatio(context.quality.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setClearColor(0x03020a, 0);

    createStars(currentStarCount);
    createNebula();
    createCelestialOverlay();
    resizeBlackHole();

    if (hooks.webglInitFailure) {
      throw new Error('Forced WebGL initialization failure');
    }

    renderer.compile(scene, camera);
    renderer.compile(blackHole.scene, blackHole.camera);
    await renderFirstFrame();
  } catch (error) {
    cleanup();
    if (error?.fallbackReason) throw error;
    throw webglError('init-failed', 'WebGL initialization or first frame failed', error);
  }

  window.addEventListener('resize', onResize, { signal });
  document.addEventListener('pointermove', onPointerMove, { signal });
  document.addEventListener('pointerleave', resetPointer, { signal });
  document.addEventListener('visibilitychange', onVisibilityChange, { signal });
  context.logo.addEventListener('click', onLogoClick, { signal });
  canvas.addEventListener('webglcontextlost', onContextLost, { signal });
  canvas.addEventListener('webglcontextrestored', onContextRestored, { signal });
  clock.start();
  clock.getDelta();
  rafId = requestAnimationFrame(animate);

  function createStarLayer(layerShape, count, index) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const randoms = new Float32Array(count);
    const color = new THREE.Color();

    for (let star = 0; star < count; star += 1) {
      const offset = star * 3;
      positions[offset] = THREE.MathUtils.randFloatSpread(layerShape.spread);
      positions[offset + 1] = THREE.MathUtils.randFloatSpread(layerShape.spread);
      positions[offset + 2] = THREE.MathUtils.randFloat(layerShape.farZ, layerShape.nearZ);
      const colorChoice = Math.random();
      if (colorChoice < 0.62) color.setRGB(0.72, 0.8, 0.96);
      else if (colorChoice < 0.86) color.setRGB(0.96, 0.82, 0.55);
      else color.setRGB(0.9, 0.38, 0.28);
      const depthTint = 1 - index * 0.045;
      colors[offset] = color.r * depthTint;
      colors[offset + 1] = color.g * depthTint;
      colors[offset + 2] = color.b * depthTint;
      sizes[star] = THREE.MathUtils.randFloat(layerShape.size * 0.45, layerShape.size * 1.25);
      randoms[star] = Math.random();
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uFlightDistance: { value: 0 },
        uFlightIntensity: { value: 0 },
        uNearZ: { value: layerShape.nearZ },
        uFarZ: { value: layerShape.farZ },
        uDepthSpan: { value: layerShape.nearZ - layerShape.farZ },
        uLayerSpeed: { value: layerShape.speed },
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        attribute float random;
        uniform float uFlightDistance;
        uniform float uFlightIntensity;
        uniform float uFarZ;
        uniform float uDepthSpan;
        uniform float uLayerSpeed;
        varying vec3 vColor;
        varying float vRandom;
        varying float vFlight;
        varying float vAngle;
        varying float vPointSize;
        varying float vNearness;

        void main() {
          float moved = position.z - uFarZ + uFlightDistance * uLayerSpeed;
          float wrappedZ = uFarZ + mod(moved, uDepthSpan);
          vec4 mvPosition = modelViewMatrix * vec4(position.xy, wrappedZ, 1.0);
          float perspective = 720.0 / max(180.0, -mvPosition.z);
          float nearness = smoothstep(0.18, 1.0, perspective);
          float pointSize = clamp(
            size * perspective * mix(1.0, 2.25, uFlightIntensity * nearness),
            0.65,
            24.0
          );
          gl_PointSize = pointSize;
          gl_Position = projectionMatrix * mvPosition;
          vColor = color;
          vRandom = random;
          vFlight = uFlightIntensity;
          vAngle = atan(mvPosition.y, mvPosition.x);
          vPointSize = pointSize;
          vNearness = nearness;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        varying vec3 vColor;
        varying float vRandom;
        varying float vFlight;
        varying float vAngle;
        varying float vPointSize;
        varying float vNearness;

        mat2 rotate2d(float angle) {
          float sine = sin(angle);
          float cosine = cos(angle);
          return mat2(cosine, sine, -sine, cosine);
        }

        void main() {
          vec2 centered = gl_PointCoord - 0.5;
          vec2 radial = rotate2d(-vAngle) * centered;
          float pixel = 1.0 / max(vPointSize, 1.0);
          float motion = clamp(vFlight * mix(0.2, 1.0, vNearness), 0.0, 1.0);

          // Keep the luminous head compact while the point footprint grows to hold its trail.
          float headOffset = 0.1 * motion;
          vec2 head = radial - vec2(headOffset, 0.0);
          float headDistance = abs(head.x) * 0.9 + abs(head.y) * 1.1;
          float headRadius = clamp(pixel * mix(0.78, 1.04, vRandom), 0.032, 0.4);
          float headEdge = max(pixel * 0.4, 0.012);
          float core = 1.0 - smoothstep(headRadius, headRadius + headEdge, headDistance);

          // Forward motion is radial, so the thin negative-x wake always points inward.
          float trailWidth = max(pixel * 0.48, 0.012);
          float trailFeather = max(pixel * 0.5, 0.014);
          float trailLine = 1.0 - smoothstep(
            trailWidth,
            trailWidth + trailFeather,
            abs(radial.y)
          );
          float trailFade = smoothstep(-0.48, headOffset - 0.03, radial.x);
          float trailCutoff = 1.0 - smoothstep(
            headOffset - 0.02,
            headOffset + max(pixel, 0.03),
            radial.x
          );
          float streak = trailLine * trailFade * trailCutoff * motion;
          float twinkle = 0.78
            + 0.15 * sin(uTime * (1.3 + vRandom * 2.2) + vRandom * 19.7)
            + 0.06 * sin(uTime * (3.4 + vRandom) + vRandom * 7.1);
          float alpha = max(core * twinkle, streak * 0.55);
          if (alpha < 0.005) discard;
          gl_FragColor = vec4(vColor, clamp(alpha, 0.0, 1.0));
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });

    const points = new THREE.Points(geometry, material);
    points.userData.parallax = layerShape.parallax;
    points.userData.baseRotation = (index - 1) * 0.015;
    return points;
  }

  function createStars(total) {
    clearStars();
    const counts = distributeStarCount(total, baseWeights);
    STAR_LAYER_SHAPES.forEach((shape, index) => {
      const layer = createStarLayer(shape, counts[index], index);
      starLayers.push(layer);
      scene.add(layer);
    });
  }

  function clearStars() {
    while (starLayers.length) {
      const layer = starLayers.pop();
      scene.remove(layer);
      layer.geometry.dispose();
      layer.material.dispose();
    }
  }

  function createNebulaTexture(color) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 256;
    textureCanvas.height = 256;
    const textureContext = textureCanvas.getContext('2d');
    const gradient = textureContext.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, `rgba(${color},0.1)`);
    gradient.addColorStop(0.48, `rgba(${color},0.035)`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    textureContext.fillStyle = gradient;
    textureContext.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(textureCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createNebula() {
    const colors = ['184,28,88', '22,122,148', '88,44,178', '184,76,28'];
    for (let index = 0; index < context.quality.nebulaCount; index += 1) {
      const texture = createNebulaTexture(colors[index % colors.length]);
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: 0xffffff,
        opacity: context.quality.name === 'compact' ? 0.25 : 0.32,
        blending: THREE.NormalBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      });
      material.toneMapped = false;
      const sprite = new THREE.Sprite(material);
      sprite.position.set(
        THREE.MathUtils.randFloatSpread(1700),
        THREE.MathUtils.randFloatSpread(1200),
        -900 - index * 210,
      );
      const scale = THREE.MathUtils.randFloat(900, 1600);
      sprite.scale.set(scale, scale, 1);
      sprite.userData.base = sprite.position.clone();
      sprite.userData.phase = Math.random() * Math.PI * 2;
      sprite.userData.parallax = 0.015 + index * 0.004;
      nebulaSprites.push(sprite);
      scene.add(sprite);
    }
  }

  function createCelestialOverlay() {
    celestialCanvas = document.createElement('canvas');
    celestialCanvas.className = 'scene-canvas';
    celestialCanvas.style.zIndex = '3';
    celestialCanvas.style.pointerEvents = 'none';
    celestialCanvas.setAttribute('aria-hidden', 'true');
    celestialContext = celestialCanvas.getContext('2d');
    context.container.append(celestialCanvas);
    resizeCelestialOverlay();
  }

  function resizeCelestialOverlay() {
    if (!celestialCanvas || !celestialContext) return;
    const dpr = Math.min(renderer?.getPixelRatio?.() || 1, 1.5);
    celestialCanvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
    celestialCanvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
    celestialCanvas.style.width = `${window.innerWidth}px`;
    celestialCanvas.style.height = `${window.innerHeight}px`;
    celestialContext.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnCelestialEvent() {
    if (!context.motion.celestialEvents || celestialEvents.length >= 3) return;
    const rightward = Math.random() > 0.5;
    const angle = 0.58 + Math.random() * 0.4;
    const speed = 430 + Math.random() * 300;
    const directionX = Math.cos(rightward ? angle : Math.PI - angle);
    const directionY = Math.sin(angle);
    celestialEvents.push({
      x: rightward ? -100 + Math.random() * window.innerWidth * 0.6 : window.innerWidth + 100,
      y: -100 + Math.random() * window.innerHeight * 0.34,
      vx: directionX * speed,
      vy: directionY * speed,
      directionX,
      directionY,
      age: 0,
      life: 0.8 + Math.random() * 0.75,
      length: 80 + Math.random() * 110,
    });
  }

  function updateCelestialEvents(delta) {
    if (!celestialContext) return;
    celestialContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (!context.motion.celestialEvents || blackHole.active) return;
    if (elapsed >= nextCelestialAt) {
      spawnCelestialEvent();
      nextCelestialAt = elapsed + 4 + Math.random() * 7;
    }
    celestialContext.save();
    celestialContext.globalCompositeOperation = 'lighter';
    for (let index = celestialEvents.length - 1; index >= 0; index -= 1) {
      const event = celestialEvents[index];
      event.age += delta;
      event.x += event.vx * delta;
      event.y += event.vy * delta;
      const progress = event.age / event.life;
      if (progress >= 1) {
        celestialEvents.splice(index, 1);
        continue;
      }
      const alpha = Math.sin(progress * Math.PI) * 0.4;
      const endX = event.x - event.directionX * event.length;
      const endY = event.y - event.directionY * event.length;
      const gradient = celestialContext.createLinearGradient(event.x, event.y, endX, endY);
      gradient.addColorStop(0, `rgba(226,232,248,${alpha})`);
      gradient.addColorStop(1, 'rgba(100,124,164,0)');
      celestialContext.strokeStyle = gradient;
      celestialContext.lineWidth = 1.4;
      celestialContext.beginPath();
      celestialContext.moveTo(event.x, event.y);
      celestialContext.lineTo(endX, endY);
      celestialContext.stroke();
    }
    celestialContext.restore();
  }

  function createBlackHolePass(reducedMotion) {
    const passScene = new THREE.Scene();
    const passCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uCenter: { value: new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2) },
        uReducedMotion: { value: reducedMotion ? 1 : 0 },
      },
      vertexShader: `
        void main() {
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTime;
        uniform float uProgress;
        uniform vec2 uResolution;
        uniform vec2 uCenter;
        uniform float uReducedMotion;

        void main() {
          vec2 point = (gl_FragCoord.xy - uCenter) / max(uResolution.y, 1.0);
          float distanceToCenter = length(point);
          float progress = uProgress * uProgress * (3.0 - 2.0 * uProgress);
          float radius = mix(0.002, 0.275, progress);
          float coreRadius = radius * 0.44;
          float angle = atan(point.y, point.x);
          float motion = mix(uTime * 0.7, 0.0, uReducedMotion);
          float noise = sin(angle * 12.0 - motion * 2.2) * 0.5 + sin(angle * 27.0 + motion) * 0.25;
          float core = 1.0 - smoothstep(coreRadius - 0.008, coreRadius + 0.008, distanceToCenter);
          float ringCenter = coreRadius * 1.26 + noise * radius * 0.012;
          float ring = 1.0 - smoothstep(0.0, radius * 0.075, abs(distanceToCenter - ringCenter));
          float diskY = abs(point.y + point.x * 0.12) * 2.9;
          float diskRadius = length(vec2(point.x, diskY));
          float disk = smoothstep(coreRadius * 0.96, coreRadius * 1.08, diskRadius)
            * (1.0 - smoothstep(radius * 0.98, radius * 1.16, diskRadius));
          float halo = (1.0 - smoothstep(radius * 0.7, radius * 1.38, distanceToCenter)) * 0.14;
          vec3 ringColor = mix(vec3(1.0, 0.3, 0.08), vec3(1.0, 0.82, 0.45), ring);
          vec3 color = ringColor * (ring * 1.35 + disk * 0.34) + vec3(0.4, 0.18, 0.55) * halo;
          color *= 1.0 - core;
          float alpha = clamp(core * 0.98 + ring * 0.9 + disk * 0.46 + halo, 0.0, 0.98) * progress;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    material.toneMapped = false;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    passScene.add(mesh);
    return {
      scene: passScene,
      camera: passCamera,
      material,
      mesh,
      active: false,
      startTime: 0,
      clickTimes: [],
      progress: 0,
    };
  }

  function resizeBlackHole() {
    const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    blackHole.material.uniforms.uResolution.value.copy(drawingBufferSize);
    blackHole.material.uniforms.uCenter.value.copy(drawingBufferSize).multiplyScalar(0.5);
  }

  function activateBlackHole() {
    if (blackHole.active) return;
    blackHole.active = true;
    blackHole.startTime = performance.now();
    blackHole.progress = context.motion.reducedMotion ? 1 : 0;
    document.documentElement.dataset.blackHole = 'active';
    pointerTarget.set(0, 0);
    pointerCurrent.set(0, 0);
    pointerActiveUntil = 0;
    interactionBlend = 0;
    context.logo.style.transform = 'translate(-50%, -50%)';
    blackHole.material.uniforms.uProgress.value = blackHole.progress;
    resizeBlackHole();
  }

  function onLogoClick() {
    const now = performance.now();
    blackHole.clickTimes = blackHole.clickTimes.filter((time) => now - time <= 3000);
    blackHole.clickTimes.push(now);
    if (blackHole.clickTimes.length >= 3) activateBlackHole();
  }

  function updateBlackHole(now) {
    if (!blackHole.active) return;
    const duration = context.motion.blackHoleGrowthDuration;
    blackHole.progress = duration === 0
      ? 1
      : Math.min(1, (now - blackHole.startTime) / duration);
    blackHole.material.uniforms.uProgress.value = blackHole.progress;
    blackHole.material.uniforms.uTime.value = elapsed;
  }

  function updateScene(delta, now) {
    elapsed += delta;
    pointerCurrent.x = damp(pointerCurrent.x, pointerTarget.x, 5.5, delta);
    pointerCurrent.y = damp(pointerCurrent.y, pointerTarget.y, 5.5, delta);

    const interactionTarget = context.motion.pointerParallax
      && !blackHole.active
      && now < pointerActiveUntil
      ? 1
      : 0;
    interactionBlend = damp(
      interactionBlend,
      interactionTarget,
      interactionTarget > interactionBlend ? 3.2 : 0.9,
      delta,
    );
    const targetFlight = context.motion.automaticFlight && !blackHole.active
      ? THREE.MathUtils.lerp(IDLE_FLIGHT_INTENSITY, POINTER_FLIGHT_INTENSITY, interactionBlend)
      : 0;
    flightIntensity = damp(flightIntensity, targetFlight, 1.8, delta);
    flightDistance += delta * context.quality.flightSpeed * flightIntensity;

    const idleBlend = context.motion.automaticFlight && !blackHole.active ? 1 - interactionBlend : 0;
    const idleX = Math.sin(elapsed * 0.17) * 18 * idleBlend;
    const idleY = Math.sin(elapsed * 0.13) * 12 * idleBlend;
    const pointerX = pointerCurrent.x * interactionBlend + idleX;
    const pointerY = pointerCurrent.y * interactionBlend + idleY;
    camera.position.x = damp(camera.position.x, -pointerX * 0.035, 3.2, delta);
    camera.position.y = damp(camera.position.y, pointerY * 0.028, 3.2, delta);
    camera.rotation.x = damp(camera.rotation.x, -pointerY * 0.000035, 3.5, delta);
    camera.rotation.y = damp(camera.rotation.y, -pointerX * 0.00004, 3.5, delta);

    starLayers.forEach((layer) => {
      layer.material.uniforms.uTime.value = elapsed;
      layer.material.uniforms.uFlightDistance.value = flightDistance;
      layer.material.uniforms.uFlightIntensity.value = flightIntensity;
      layer.position.x = -pointerX * layer.userData.parallax;
      layer.position.y = pointerY * layer.userData.parallax;
      layer.rotation.z = layer.userData.baseRotation;
    });
    nebulaSprites.forEach((sprite) => {
      const phase = sprite.userData.phase;
      sprite.position.x = sprite.userData.base.x - pointerX * sprite.userData.parallax
        + (context.motion.reducedMotion ? 0 : Math.sin(elapsed * 0.04 + phase) * 16);
      sprite.position.y = sprite.userData.base.y + pointerY * sprite.userData.parallax
        + (context.motion.reducedMotion ? 0 : Math.cos(elapsed * 0.035 + phase) * 12);
    });
    if (!blackHole.active) {
      const x = -pointerX * (context.quality.name === 'compact' ? 0.026 : 0.048);
      const y = -pointerY * (context.quality.name === 'compact' ? 0.026 : 0.048);
      context.logo.style.transform = `translate(calc(-50% + ${x.toFixed(2)}px), calc(-50% + ${y.toFixed(2)}px))`;
    }
    updateCelestialEvents(delta);
    updateBlackHole(now);
  }

  function render() {
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (blackHole.active) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(blackHole.scene, blackHole.camera);
      renderer.autoClear = true;
    }
  }

  function renderFirstFrame() {
    return new Promise((resolve, reject) => {
      requestAnimationFrame((now) => {
        try {
          updateScene(0, now);
          render();
          if (hooks.webglFirstFrameFailure) throw new Error('Forced first-frame failure');
          const errorCode = gl.getError();
          if (errorCode !== gl.NO_ERROR) throw new Error(`WebGL error after first frame: ${errorCode}`);
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  function animate(now) {
    if (disposed || recovering || document.hidden) {
      rafId = 0;
      return;
    }
    const delta = Math.min(clock.getDelta(), 0.05);
    try {
      updateScene(delta, now);
      render();
      monitorFrameRate(now);
      rafId = requestAnimationFrame(animate);
    } catch (error) {
      reportFatal('init-failed', error);
    }
  }

  function monitorFrameRate(now) {
    if (qualityReduced || recovering) return;
    framesForQuality += 1;
    const windowDuration = now - qualityWindowStarted;
    if (windowDuration < 3000) return;
    const fps = framesForQuality / (windowDuration / 1000);
    if (fps < 30 && renderer.getPixelRatio() > 1) {
      qualityReduced = true;
      renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() * 0.75));
      onResize();
    } else {
      framesForQuality = 0;
      qualityWindowStarted = now;
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    resizeCelestialOverlay();
    resizeBlackHole();
  }

  function onPointerMove(event) {
    if (
      blackHole.active
      || !context.motion.pointerParallax
      || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')
    ) return;
    pointerTarget.set(event.clientX - window.innerWidth / 2, event.clientY - window.innerHeight / 2);
    pointerActiveUntil = performance.now() + POINTER_ACTIVITY_HOLD_MS;
  }

  function resetPointer() {
    pointerTarget.set(0, 0);
    pointerActiveUntil = 0;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!disposed && !recovering && !rafId) {
      clock.getDelta();
      rafId = requestAnimationFrame(animate);
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    if (disposed || fatalReported) return;
    const now = performance.now();
    const repeated = lastContextLossAt !== null && now - lastContextLossAt <= 30_000;
    lastContextLossAt = now;
    cancelAnimationFrame(rafId);
    rafId = 0;
    if (repeated) {
      reportFatal('context-lost', new Error('WebGL context was lost twice within 30 seconds'));
      return;
    }
    recovering = true;
    context.onRecovering?.(now);
    restoreTimeout = window.setTimeout(() => {
      if (recovering) reportFatal('context-lost', new Error('WebGL context restoration timed out'));
    }, Number.isFinite(hooks.contextRestoreTimeout) ? hooks.contextRestoreTimeout : 5000);
  }

  function onContextRestored() {
    if (!recovering || disposed || fatalReported) return;
    requestAnimationFrame(() => {
      try {
        renderer.resetState();
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        resizeBlackHole();
        render();
        window.clearTimeout(restoreTimeout);
        restoreTimeout = 0;
        recovering = false;
        context.onRecovered?.();
        clock.getDelta();
        if (!document.hidden) rafId = requestAnimationFrame(animate);
      } catch (error) {
        reportFatal('context-lost', error);
      }
    });
  }

  function reportFatal(reason, error) {
    if (fatalReported || disposed) return;
    fatalReported = true;
    recovering = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
    window.clearTimeout(restoreTimeout);
    context.onFatal?.(reason, error);
  }

  function setStarCount(nextCount) {
    const next = clampStarCount(nextCount);
    if (next === currentStarCount || disposed) return currentStarCount;
    const previous = currentStarCount;
    try {
      currentStarCount = next;
      createStars(currentStarCount);
      renderer.compile(scene, camera);
      render();
    } catch (error) {
      currentStarCount = previous;
      try { createStars(previous); } catch { /* The fatal fallback will dispose the scene. */ }
      reportFatal('init-failed', error);
    }
    return currentStarCount;
  }

  function simulateContextLoss({ restoreAfter } = {}) {
    const lostEvent = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lostEvent);
    window.clearTimeout(simulatedRestoreTimeout);
    if (Number.isFinite(restoreAfter)) {
      simulatedRestoreTimeout = window.setTimeout(() => {
        canvas.dispatchEvent(new Event('webglcontextrestored'));
      }, Math.max(0, restoreAfter));
    }
  }

  function cleanup() {
    disposed = true;
    cancelAnimationFrame(rafId);
    window.clearTimeout(restoreTimeout);
    window.clearTimeout(simulatedRestoreTimeout);
    abortController.abort();
    clearStars();
    while (nebulaSprites.length) {
      const sprite = nebulaSprites.pop();
      scene.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
    }
    blackHole.mesh.geometry.dispose();
    blackHole.material.dispose();
    renderer?.dispose();
    celestialCanvas?.remove();
    canvas.remove();
    delete document.documentElement.dataset.blackHole;
    context.logo.style.transform = 'translate(-50%, -50%)';
  }

  return {
    dispose: cleanup,
    getStarCount: () => currentStarCount,
    setStarCount,
    activateBlackHole,
    simulateContextLoss,
    getDiagnostics() {
      const drawingBufferSize = renderer.getDrawingBufferSize(new THREE.Vector2());
      const blackHoleCenter = blackHole.material.uniforms.uCenter.value;
      return {
        quality: context.quality.name,
        reducedMotion: context.motion.reducedMotion,
        pixelRatio: renderer.getPixelRatio(),
        qualityReduced,
        recovering,
        flightIntensity,
        flightDistance,
        interactionBlend,
        blackHoleActive: blackHole.active,
        blackHoleProgress: blackHole.progress,
        blackHoleCenter: { x: blackHoleCenter.x, y: blackHoleCenter.y },
        drawingBufferSize: { width: drawingBufferSize.x, height: drawingBufferSize.y },
        nebulaMaxOpacity: Math.max(0, ...nebulaSprites.map((sprite) => sprite.material.opacity)),
        nebulaUsesNormalBlending: nebulaSprites.every(
          (sprite) => sprite.material.blending === THREE.NormalBlending,
        ),
        starCount: currentStarCount,
        celestialEventCount: celestialEvents.length,
      };
    },
  };
}
