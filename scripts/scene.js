import * as THREE from 'three';

let scene, camera, renderer, celestialEventCanvas, celestialEventCtx;
let logoContainer;
const clock = new THREE.Clock();

const pointerTarget = new THREE.Vector2();
const pointerCurrent = new THREE.Vector2();
const pointerParallax = new THREE.Vector2();
const logoOffset = new THREE.Vector2();
const logoTarget = new THREE.Vector2();
const windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

const starLayers = [];
const nebulaClouds = [];
const celestialEvents = [];
const reusableColor = new THREE.Color();

let lastPointerActivity = performance.now();
let flightIntensity = 0;
let flightVisualIntensity = 0;
let flightDistance = 0;
let parallaxLock = 0;
let celestialEventTimer = null;
let starControlContainer = null;
let starCountValue = null;

const quality = getQualitySettings();
const baseStarLayerCounts = quality.starLayers.map((layer) => layer.count);
const defaultStarTotal = baseStarLayerCounts.reduce((total, count) => total + count, 0);
let currentStarTotal = defaultStarTotal;

const blackHoleState = {
    clickTimestamps: [],
    active: false,
    startTime: 0,
    progress: 0,
    renderTarget: null,
    distortionTarget: null,
    scene: null,
    camera: null,
    material: null,
    mesh: null,
    distortionScene: null,
    distortionCamera: null,
    distortionMaterial: null,
    distortionMesh: null,
    targetRadius: 0.25,
    coreRadius: 0.105,
    logoScale: 1,
};

const config = {
    logoMovementRatio: quality.isCompact ? 0.026 : 0.048,
    pointerSmoothing: 0.055,
    logoSmoothing: 0.045,
    flight: {
        idleDelay: quality.prefersReducedMotion ? 9000 : 3200,
        fadeIn: quality.prefersReducedMotion ? 6500 : 4300,
        rise: quality.prefersReducedMotion ? 0.38 : 0.72,
        fall: quality.prefersReducedMotion ? 1.4 : 2.8,
        speed: quality.flightSpeed,
    },
    celestialEvents: {
        maxActive: quality.maxCelestialEvents,
        firstDelay: quality.isCompact ? [2600, 4200] : [2000, 3600],
        interval: quality.prefersReducedMotion ? [12000, 22000] : quality.isCompact ? [7000, 14000] : [5000, 11000],
        brightness: quality.prefersReducedMotion ? 0.44 : quality.isCompact ? 0.68 : 0.76,
    },
    blackHole: {
        clicksRequired: 3,
        clickWindowMs: 3000,
        growthDuration: 10000,
        parallaxUnlockDuration: quality.prefersReducedMotion ? 18000 : 12000,
        targetDiameterRatio: 0.55,
        coreDiameterRatio: 0.42,
        logoPadding: 32,
        minLogoScale: 0.38,
        reducedMotion: quality.prefersReducedMotion ? 1 : 0,
    },
    starControls: {
        step: 10000,
        min: 10000,
        max: 2400000,
    },
    starLayers: quality.starLayers,
    nebulaCount: quality.nebulaCount,
};

function getQualitySettings() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    const isCompact = window.innerWidth < 820 || isCoarse;
    const isMid = window.innerWidth < 1280;

    if (prefersReducedMotion) {
        return {
            prefersReducedMotion,
            isCompact,
            pixelRatio: 1,
            flightSpeed: 60,
            maxCelestialEvents: 1,
            nebulaCount: 4,
            starLayers: [
                { count: 5200, size: 1.2, farZ: -3000, nearZ: 540, spread: 2200, parallax: 0.028, speed: 0.56 },
                { count: 7600, size: 1.65, farZ: -2350, nearZ: 640, spread: 2000, parallax: 0.052, speed: 0.76 },
                { count: 4200, size: 2.1, farZ: -1650, nearZ: 720, spread: 1650, parallax: 0.088, speed: 1.02 },
            ],
        };
    }

    if (isCompact) {
        return {
            prefersReducedMotion,
            isCompact,
            pixelRatio: Math.min(window.devicePixelRatio, 1.35),
            flightSpeed: 185,
            maxCelestialEvents: 2,
            nebulaCount: 5,
            starLayers: [
                { count: 7800, size: 1.2, farZ: -3200, nearZ: 560, spread: 2150, parallax: 0.035, speed: 0.62 },
                { count: 13200, size: 1.65, farZ: -2550, nearZ: 650, spread: 2050, parallax: 0.074, speed: 0.88 },
                { count: 6800, size: 2.2, farZ: -1850, nearZ: 760, spread: 1800, parallax: 0.12, speed: 1.18 },
            ],
        };
    }

    if (isMid) {
        return {
            prefersReducedMotion,
            isCompact,
            pixelRatio: Math.min(window.devicePixelRatio, 1.7),
            flightSpeed: 260,
            maxCelestialEvents: 3,
            nebulaCount: 6,
            starLayers: [
                { count: 12800, size: 1.15, farZ: -3500, nearZ: 560, spread: 2550, parallax: 0.038, speed: 0.62 },
                { count: 21800, size: 1.65, farZ: -2750, nearZ: 650, spread: 2350, parallax: 0.082, speed: 0.88 },
                { count: 10500, size: 2.2, farZ: -1950, nearZ: 760, spread: 2050, parallax: 0.14, speed: 1.18 },
            ],
        };
    }

    return {
        prefersReducedMotion,
        isCompact,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        flightSpeed: 330,
        maxCelestialEvents: 3,
        nebulaCount: 7,
        starLayers: [
            { count: 18000, size: 1.15, farZ: -3800, nearZ: 560, spread: 3000, parallax: 0.04, speed: 0.62 },
            { count: 31000, size: 1.65, farZ: -3050, nearZ: 660, spread: 2700, parallax: 0.09, speed: 0.9 },
            { count: 15000, size: 2.25, farZ: -2150, nearZ: 780, spread: 2350, parallax: 0.16, speed: 1.22 },
        ],
    };
}

function init() {
    logoContainer = document.getElementById('logo-container');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(63, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.z = 980;

    renderer = new THREE.WebGLRenderer({
        antialias: !quality.isCompact,
        alpha: true,
        powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(quality.pixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.24;
    renderer.setClearColor(0x03020a, 0);
    renderer.domElement.id = 'webgl-canvas';
    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.zIndex = '0';
    renderer.domElement.style.pointerEvents = 'none';
    document.body.insertBefore(renderer.domElement, document.body.firstChild);

    createStars();
    createNebula();
    createCelestialEventOverlay();
    createStarControls();
    setupLogoInteraction();

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('pointermove', onPointerMove, false);
    document.addEventListener('mouseleave', markPointerIdle, false);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) clock.getDelta();
    });

    scheduleCelestialEvent(randRange(config.celestialEvents.firstDelay[0], config.celestialEvents.firstDelay[1]));
    animate();
}

function createStarLayer(layerConfig, index) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(layerConfig.count * 3);
    const colors = new Float32Array(layerConfig.count * 3);
    const sizes = new Float32Array(layerConfig.count);
    const randoms = new Float32Array(layerConfig.count);

    for (let i = 0; i < layerConfig.count; i++) {
        const i3 = i * 3;
        positions[i3] = THREE.MathUtils.randFloatSpread(layerConfig.spread);
        positions[i3 + 1] = THREE.MathUtils.randFloatSpread(layerConfig.spread);
        positions[i3 + 2] = THREE.MathUtils.randFloat(layerConfig.farZ, layerConfig.nearZ);

        setStarColor(reusableColor, Math.random(), index);
        colors[i3] = reusableColor.r;
        colors[i3 + 1] = reusableColor.g;
        colors[i3 + 2] = reusableColor.b;

        sizes[i] = THREE.MathUtils.randFloat(layerConfig.size * 0.45, layerConfig.size * 1.25);
        randoms[i] = Math.random();
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
            uNearZ: { value: layerConfig.nearZ },
            uFarZ: { value: layerConfig.farZ },
            uDepthSpan: { value: layerConfig.nearZ - layerConfig.farZ },
            uLayerSpeed: { value: layerConfig.speed },
        },
        vertexShader: `
            attribute float size;
            attribute vec3 color;
            attribute float random;
            uniform float uTime;
            uniform float uFlightDistance;
            uniform float uFlightIntensity;
            uniform float uNearZ;
            uniform float uFarZ;
            uniform float uDepthSpan;
            uniform float uLayerSpeed;
            varying vec3 vColor;
            varying float vRandom;
            varying float vFlight;
            varying float vAngle;
            varying float vDepthGlow;
            varying float vDepthFade;

            void main() {
                float moved = position.z - uFarZ + uFlightDistance * uLayerSpeed;
                float wrappedZ = uFarZ + mod(moved, uDepthSpan);
                float depthProgress = clamp((wrappedZ - uFarZ) / uDepthSpan, 0.0, 1.0);
                vec3 animatedPosition = vec3(position.xy, wrappedZ);

                vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
                float perspective = 720.0 / max(180.0, -mvPosition.z);
                float flightNearness = smoothstep(0.18, 1.0, perspective);
                float streakBoost = mix(1.0, 2.75, uFlightIntensity * flightNearness);
                float pointSizeCap = mix(16.0, 28.0, uFlightIntensity);

                gl_PointSize = clamp(size * perspective * streakBoost, 0.65, pointSizeCap);
                gl_Position = projectionMatrix * mvPosition;

                vColor = color;
                vRandom = random;
                vFlight = uFlightIntensity;
                vAngle = atan(mvPosition.y, mvPosition.x);
                vDepthGlow = smoothstep(0.0, 1.0, perspective);
                vDepthFade = smoothstep(0.035, 0.18, depthProgress)
                    * (1.0 - smoothstep(0.86, 0.99, depthProgress));
            }`,
        fragmentShader: `
            precision highp float;
            uniform float uTime;
            varying vec3 vColor;
            varying float vRandom;
            varying float vFlight;
            varying float vAngle;
            varying float vDepthGlow;
            varying float vDepthFade;

            mat2 rotate2d(float a) {
                float s = sin(a);
                float c = cos(a);
                return mat2(c, -s, s, c);
            }

            void main() {
                vec2 centered = gl_PointCoord - 0.5;
                float d = length(centered);
                float core = 1.0 - smoothstep(0.08, 0.5, d);
                if (core <= 0.001 && vFlight < 0.02) discard;

                float twinkle = 0.76
                    + 0.18 * sin(uTime * (1.4 + vRandom * 2.2) + vRandom * 19.7)
                    + 0.08 * sin(uTime * (3.5 + vRandom * 1.5) + vRandom * 7.1);

                vec2 radial = rotate2d(-vAngle) * centered;
                float streakCore = 1.0 - smoothstep(0.018, 0.17, abs(radial.y));
                float streakLength = 1.0 - smoothstep(0.05, 0.5, abs(radial.x));
                float streak = streakCore * streakLength * vFlight;

                float crossH = (1.0 - smoothstep(0.008, 0.045, abs(centered.y))) * (1.0 - smoothstep(0.05, 0.48, abs(centered.x)));
                float crossV = (1.0 - smoothstep(0.008, 0.045, abs(centered.x))) * (1.0 - smoothstep(0.05, 0.48, abs(centered.y)));
                float glintWave = pow(max(0.0, sin(uTime * 0.65 + vRandom * 80.0)), 28.0);
                float glint = (crossH + crossV) * glintWave * (0.35 + vDepthGlow * 0.75);

                float alpha = max(core * twinkle, streak * 0.72) + glint;
                alpha *= mix(1.0, vDepthFade, vFlight);
                vec3 rgbShift = 0.018 * vec3(
                    sin(uTime * 0.35 + vRandom * 17.0),
                    sin(uTime * 0.42 + vRandom * 19.0 + 2.1),
                    sin(uTime * 0.31 + vRandom * 23.0 + 4.2)
                );
                vec3 color = clamp(vColor + rgbShift + glint * vColor * 0.22, 0.0, 1.0);

                gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
            }`,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
    });

    const stars = new THREE.Points(geometry, material);
    stars.userData.parallaxFactor = layerConfig.parallax;
    stars.userData.baseRotation = (index - 1) * 0.015;
    return stars;
}

function setStarColor(color, randomValue, layerIndex) {
    const depthTint = 1 - layerIndex * 0.025;

    if (randomValue < 0.08) {
        setStarRGB(color, randRange(0.58, 0.7), randRange(0.68, 0.8), randRange(0.9, 0.98), depthTint);
    } else if (randomValue < 0.27) {
        setStarRGB(color, randRange(0.78, 0.9), randRange(0.82, 0.92), randRange(0.86, 0.96), depthTint);
    } else if (randomValue < 0.49) {
        setStarRGB(color, randRange(0.9, 0.98), randRange(0.76, 0.88), randRange(0.48, 0.64), depthTint);
    } else if (randomValue < 0.72) {
        setStarRGB(color, randRange(0.86, 0.96), randRange(0.5, 0.66), randRange(0.28, 0.42), depthTint);
    } else {
        setStarRGB(color, randRange(0.68, 0.84), randRange(0.24, 0.36), randRange(0.14, 0.24), depthTint * 0.9);
    }
}

function randRange(min, max) {
    return THREE.MathUtils.randFloat(min, max);
}

function setStarRGB(color, r, g, b, intensity) {
    color.setRGB(
        THREE.MathUtils.clamp(r * intensity, 0, 0.98),
        THREE.MathUtils.clamp(g * intensity, 0, 0.98),
        THREE.MathUtils.clamp(b * intensity, 0, 0.98),
    );
}

function createStars() {
    clearStarLayers();

    config.starLayers.forEach((layerConfig, index) => {
        const layer = createStarLayer(layerConfig, index);
        starLayers.push(layer);
        scene.add(layer);
    });
}

function clearStarLayers() {
    while (starLayers.length > 0) {
        const layer = starLayers.pop();
        scene.remove(layer);
        layer.geometry.dispose();
        layer.material.dispose();
    }
}

function createStarControls(attempt = 0) {
    let versionToggle = document.getElementById('version-toggle');

    if (!versionToggle) {
        if (attempt < 120) {
            requestAnimationFrame(() => createStarControls(attempt + 1));
            return;
        }

        versionToggle = createStandaloneVersionToggle();
    }

    starControlContainer = document.createElement('div');
    starControlContainer.className = 'star-controls';
    starControlContainer.setAttribute('role', 'group');
    starControlContainer.setAttribute('aria-label', 'Star count controls');

    const label = document.createElement('span');
    label.className = 'star-count-label';
    label.textContent = 'STARS';

    const minusButton = document.createElement('button');
    minusButton.type = 'button';
    minusButton.className = 'star-control-button';
    minusButton.textContent = '-';
    minusButton.setAttribute('aria-label', 'Remove 10,000 stars');
    minusButton.addEventListener('click', () => {
        setStarTotal(currentStarTotal - config.starControls.step);
    });

    starCountValue = document.createElement('output');
    starCountValue.className = 'star-count-value';
    starCountValue.setAttribute('aria-live', 'polite');

    const plusButton = document.createElement('button');
    plusButton.type = 'button';
    plusButton.className = 'star-control-button';
    plusButton.textContent = '+';
    plusButton.setAttribute('aria-label', 'Add 10,000 stars');
    plusButton.addEventListener('click', () => {
        setStarTotal(currentStarTotal + config.starControls.step);
    });

    starControlContainer.append(label, minusButton, starCountValue, plusButton);
    versionToggle.insertBefore(starControlContainer, versionToggle.lastElementChild);
    updateStarCountDisplay();
}

function createStandaloneVersionToggle() {
    const toggleContainer = document.createElement('div');
    toggleContainer.id = 'version-toggle';
    toggleContainer.className = 'version-toggle-standalone';

    const currentMode = document.createElement('span');
    currentMode.className = 'version-toggle-current';
    currentMode.textContent = 'WEBGL';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'version-toggle-close';
    closeButton.textContent = 'x';
    closeButton.setAttribute('aria-label', 'Close mode controls');

    const reopenButton = document.createElement('button');
    reopenButton.type = 'button';
    reopenButton.className = 'version-toggle-reopen';
    reopenButton.textContent = '.';
    reopenButton.hidden = true;
    reopenButton.setAttribute('aria-label', 'Open mode controls');

    closeButton.addEventListener('click', () => {
        toggleContainer.hidden = true;
        reopenButton.hidden = false;
    });

    reopenButton.addEventListener('click', () => {
        toggleContainer.hidden = false;
        reopenButton.hidden = true;
    });

    toggleContainer.append(currentMode, closeButton);
    document.body.append(toggleContainer, reopenButton);
    return toggleContainer;
}

function setStarTotal(nextTotal) {
    const clampedTotal = Math.round(THREE.MathUtils.clamp(
        nextTotal,
        config.starControls.min,
        config.starControls.max,
    ));

    if (clampedTotal === currentStarTotal) return;

    currentStarTotal = clampedTotal;
    distributeStarCounts(currentStarTotal);
    createStars();
    updateStarCountDisplay();
}

function distributeStarCounts(total) {
    let assigned = 0;

    config.starLayers.forEach((layerConfig, index) => {
        if (index === config.starLayers.length - 1) {
            layerConfig.count = Math.max(1, total - assigned);
            return;
        }

        const ratio = baseStarLayerCounts[index] / defaultStarTotal;
        layerConfig.count = Math.max(1, Math.round(total * ratio));
        assigned += layerConfig.count;
    });
}

function updateStarCountDisplay() {
    if (!starControlContainer || !starCountValue) return;

    starCountValue.value = String(currentStarTotal);
    starCountValue.textContent = currentStarTotal.toLocaleString();

    const buttons = starControlContainer.querySelectorAll('.star-control-button');
    buttons[0].disabled = currentStarTotal <= config.starControls.min;
    buttons[1].disabled = currentStarTotal >= config.starControls.max;
}

function createNebula() {
    const planeSize = quality.isCompact ? 5200 : 7200;
    const geometry = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);

    for (let i = 0; i < config.nebulaCount; i++) {
        const hue = (i / config.nebulaCount + Math.random() * 0.16) % 1;
        const colorA = new THREE.Color().setHSL(hue, 1.0, 0.46);
        const colorB = new THREE.Color().setHSL((hue + 0.18 + Math.random() * 0.15) % 1, 1.0, 0.55);
        const accent = new THREE.Color().setHSL((hue + 0.52) % 1, 1.0, 0.62);

        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColorA: { value: colorA },
                uColorB: { value: colorB },
                uAccent: { value: accent },
                uSeed: { value: new THREE.Vector2(Math.random() * 100, Math.random() * 100) },
                uAlpha: { value: quality.isCompact ? 0.13 : 0.18 },
                uPulse: { value: Math.random() * Math.PI * 2 },
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                precision highp float;
                uniform float uTime;
                uniform vec3 uColorA;
                uniform vec3 uColorB;
                uniform vec3 uAccent;
                uniform vec2 uSeed;
                uniform float uAlpha;
                uniform float uPulse;
                varying vec2 vUv;

                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
                }

                float noise(vec2 st) {
                    vec2 i = floor(st);
                    vec2 f = fract(st);
                    float a = random(i);
                    float b = random(i + vec2(1.0, 0.0));
                    float c = random(i + vec2(0.0, 1.0));
                    float d = random(i + vec2(1.0, 1.0));
                    vec2 u = f * f * (3.0 - 2.0 * f);
                    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
                }

                float fbm(vec2 st) {
                    float value = 0.0;
                    float amplitude = 0.52;
                    for (int i = 0; i < 6; i++) {
                        value += amplitude * noise(st);
                        st *= 2.08;
                        amplitude *= 0.48;
                    }
                    return value;
                }

                void main() {
                    vec2 uv = vUv - 0.5;
                    float radial = 1.0 - smoothstep(0.16, 0.72, length(uv));
                    float softEdge = smoothstep(0.0, 0.22, vUv.x)
                        * (1.0 - smoothstep(0.78, 1.0, vUv.x))
                        * smoothstep(0.0, 0.22, vUv.y)
                        * (1.0 - smoothstep(0.78, 1.0, vUv.y));

                    vec2 st = vUv * 3.4 + uSeed;
                    vec2 q = vec2(
                        fbm(st + vec2(0.0, uTime * 0.018)),
                        fbm(st + vec2(4.7, 1.3) - uTime * 0.014)
                    );
                    vec2 r = vec2(
                        fbm(st + q * 1.7 + vec2(1.7, 9.2) + uTime * 0.021),
                        fbm(st + q * 1.3 + vec2(8.3, 2.8) - uTime * 0.017)
                    );
                    float cloud = fbm(st + r * 1.45);
                    float veins = pow(smoothstep(0.42, 0.86, cloud), 1.45);
                    float bright = pow(smoothstep(0.68, 0.98, cloud), 2.2);
                    float pulse = 0.82 + 0.18 * sin(uTime * 0.45 + uPulse);

                    vec3 color = mix(uColorA, uColorB, cloud);
                    color = mix(color, uAccent, bright * 0.8);
                    color += veins * 0.08;

                    float alpha = (veins * 0.8 + bright * 0.9) * radial * softEdge * uAlpha * pulse;
                    gl_FragColor = vec4(color, alpha);
                }`,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
        });

        const cloud = new THREE.Mesh(geometry, material);
        const depth = THREE.MathUtils.randFloat(-1550, -780);
        cloud.position.set(
            THREE.MathUtils.randFloatSpread(950),
            THREE.MathUtils.randFloatSpread(760),
            depth,
        );
        cloud.rotation.z = Math.random() * Math.PI * 2;
        cloud.scale.setScalar(THREE.MathUtils.randFloat(0.72, 1.12));
        cloud.userData.base = cloud.position.clone();
        cloud.userData.phase = Math.random() * Math.PI * 2;
        cloud.userData.parallax = THREE.MathUtils.randFloat(0.012, 0.05);
        cloud.userData.rotationSpeed = THREE.MathUtils.randFloat(-0.014, 0.014);
        nebulaClouds.push(cloud);
        scene.add(cloud);
    }
}

function createCelestialEventOverlay() {
    celestialEventCanvas = document.createElement('canvas');
    celestialEventCanvas.id = 'celestial-event-canvas';
    celestialEventCanvas.style.position = 'fixed';
    celestialEventCanvas.style.inset = '0';
    celestialEventCanvas.style.zIndex = '3';
    celestialEventCanvas.style.pointerEvents = 'none';
    celestialEventCanvas.style.width = '100%';
    celestialEventCanvas.style.height = '100%';
    celestialEventCanvas.style.mixBlendMode = 'screen';
    document.body.insertBefore(celestialEventCanvas, logoContainer);

    celestialEventCtx = celestialEventCanvas.getContext('2d');
    resizeCelestialEventCanvas();
}

function resizeCelestialEventCanvas() {
    if (!celestialEventCanvas || !celestialEventCtx) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    celestialEventCanvas.width = Math.ceil(window.innerWidth * pixelRatio);
    celestialEventCanvas.height = Math.ceil(window.innerHeight * pixelRatio);
    celestialEventCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function smoothstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function smootherstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function setupLogoInteraction() {
    if (!logoContainer) return;

    logoContainer.setAttribute('role', 'button');
    logoContainer.setAttribute('tabindex', '0');
    logoContainer.setAttribute('aria-label', 'JPD logo');
    logoContainer.setAttribute('aria-pressed', 'false');
    logoContainer.addEventListener('click', registerLogoActivation, false);
    logoContainer.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        registerLogoActivation();
    }, false);
}

function registerLogoActivation() {
    if (blackHoleState.active) return;

    const now = performance.now();
    blackHoleState.clickTimestamps = blackHoleState.clickTimestamps
        .filter((timestamp) => now - timestamp <= config.blackHole.clickWindowMs);
    blackHoleState.clickTimestamps.push(now);

    if (blackHoleState.clickTimestamps.length >= config.blackHole.clicksRequired) {
        activateBlackHole(now);
    }
}

function activateBlackHole(startTime) {
    if (blackHoleState.active) return;

    createBlackHolePass();
    blackHoleState.active = true;
    blackHoleState.startTime = startTime;
    blackHoleState.progress = 0;
    blackHoleState.clickTimestamps.length = 0;
    lastPointerActivity = startTime;
    pointerTarget.set(0, 0);
    flightIntensity = 0;
    flightVisualIntensity = 0;

    document.body.classList.add('black-hole-active');

    if (logoContainer) {
        logoOffset.set(0, 0);
        logoTarget.set(0, 0);
        logoContainer.style.transform = 'translate(-50%, -50%)';
        logoContainer.classList.add('black-hole-triggered');
        logoContainer.setAttribute('aria-pressed', 'true');
        applyBlackHoleLogoFit();
    }

    if (celestialEventTimer) {
        clearTimeout(celestialEventTimer);
        celestialEventTimer = null;
    }
    celestialEvents.length = 0;
}

function createBlackHolePass() {
    if (blackHoleState.renderTarget) return;

    blackHoleState.renderTarget = new THREE.WebGLRenderTarget(1, 1, {
        depthBuffer: true,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
    });
    blackHoleState.renderTarget.texture.colorSpace = THREE.SRGBColorSpace;

    blackHoleState.distortionTarget = new THREE.WebGLRenderTarget(1, 1, {
        depthBuffer: false,
        stencilBuffer: false,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
    });

    blackHoleState.scene = new THREE.Scene();
    blackHoleState.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blackHoleState.distortionScene = new THREE.Scene();
    blackHoleState.distortionCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blackHoleState.distortionMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uProgress: { value: 0 },
            uTargetRadius: { value: blackHoleState.targetRadius },
            uCoreRadius: { value: blackHoleState.coreRadius },
            uReducedMotion: { value: config.blackHole.reducedMotion },
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }`,
        fragmentShader: `
            precision highp float;

            uniform vec2 uResolution;
            uniform float uProgress;
            uniform float uTargetRadius;
            uniform float uCoreRadius;
            uniform float uReducedMotion;
            varying vec2 vUv;

            float smoother(float value) {
                value = clamp(value, 0.0, 1.0);
                return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
            }

            float ring(float value, float center, float width, float feather) {
                return smoothstep(center - width - feather, center - width, value)
                    * (1.0 - smoothstep(center + width, center + width + feather, value));
            }

            void main() {
                float minDimension = min(uResolution.x, uResolution.y);
                float pixel = 1.0 / minDimension;
                vec2 centered = (vUv - 0.5) * uResolution / minDimension;
                float distanceFromCenter = length(centered);
                float progress = smoother(uProgress);
                float targetRadius = max(uTargetRadius, 0.02);
                float finalCoreRadius = min(max(uCoreRadius, targetRadius * 0.3), targetRadius * 0.82);
                float coreRadius = mix(max(pixel * 6.0, finalCoreRadius * 0.16), finalCoreRadius, progress);
                float activeRadius = mix(max(coreRadius * 1.2, targetRadius * 0.055), targetRadius, progress);
                float field = 1.0 - smoothstep(coreRadius * 0.2, activeRadius * 1.34, distanceFromCenter);
                float innerLens = 1.0 - smoothstep(coreRadius * 0.12, coreRadius * 1.0, distanceFromCenter);
                float photon = ring(distanceFromCenter, coreRadius * 1.015, max(pixel * 1.6, coreRadius * 0.009), max(pixel * 2.4, coreRadius * 0.014));
                float strength = clamp(field * (0.82 + progress * 0.18) + photon * 0.18, 0.0, 1.0);

                gl_FragColor = vec4(strength, innerLens, photon, 1.0);
            }`,
        transparent: false,
        depthWrite: false,
        depthTest: false,
    });

    blackHoleState.distortionMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blackHoleState.distortionMaterial);
    blackHoleState.distortionScene.add(blackHoleState.distortionMesh);

    blackHoleState.material = new THREE.ShaderMaterial({
        uniforms: {
            tScene: { value: blackHoleState.renderTarget.texture },
            tDistortion: { value: blackHoleState.distortionTarget.texture },
            uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
            uTime: { value: 0 },
            uProgress: { value: 0 },
            uTargetRadius: { value: blackHoleState.targetRadius },
            uCoreRadius: { value: blackHoleState.coreRadius },
            uReducedMotion: { value: config.blackHole.reducedMotion },
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }`,
        fragmentShader: `
            precision highp float;

            uniform sampler2D tScene;
            uniform sampler2D tDistortion;
            uniform vec2 uResolution;
            uniform float uTime;
            uniform float uProgress;
            uniform float uTargetRadius;
            uniform float uCoreRadius;
            uniform float uReducedMotion;
            varying vec2 vUv;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);

                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));

                return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
            }

            float fbm(vec2 p) {
                float value = 0.0;
                float amplitude = 0.5;

                for (int i = 0; i < 5; i++) {
                    value += amplitude * noise(p);
                    p *= 2.03;
                    amplitude *= 0.5;
                }

                return value;
            }

            mat2 rotate2d(float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return mat2(c, -s, s, c);
            }

            float sceneEdgeMask(vec2 uv) {
                vec2 fade = max(vec2(2.0) / uResolution, vec2(0.0015));
                vec2 lower = smoothstep(vec2(0.0), fade, uv);
                vec2 upper = 1.0 - smoothstep(vec2(1.0) - fade, vec2(1.0), uv);
                return lower.x * lower.y * upper.x * upper.y;
            }

            vec4 sampleScene(vec2 uv) {
                vec2 safeUv = clamp(uv, vec2(0.001), vec2(0.999));
                return texture2D(tScene, safeUv) * sceneEdgeMask(uv);
            }

            vec3 sampleRGBShift(vec2 uv, vec2 direction, float amount) {
                vec2 offset = direction * amount;
                vec2 offset120 = vec2(offset.x * -0.5 - offset.y * 0.8660254, offset.x * 0.8660254 + offset.y * -0.5);
                vec2 offset240 = vec2(offset.x * -0.5 + offset.y * 0.8660254, offset.x * -0.8660254 + offset.y * -0.5);
                vec3 color = vec3(0.0);
                color.r = sampleScene(uv + offset120).r;
                color.g = sampleScene(uv + offset240).g;
                color.b = sampleScene(uv + offset).b;
                return color;
            }

            float smoother(float value) {
                value = clamp(value, 0.0, 1.0);
                return value * value * value * (value * (value * 6.0 - 15.0) + 10.0);
            }

            float softBand(float distanceValue, float center, float halfWidth, float feather) {
                return smoothstep(center - halfWidth - feather, center - halfWidth, distanceValue)
                    * (1.0 - smoothstep(center + halfWidth, center + halfWidth + feather, distanceValue));
            }

            void main() {
                float progress = smoother(uProgress);
                float minDimension = min(uResolution.x, uResolution.y);
                float pixel = 1.0 / minDimension;
                vec2 centered = (vUv - 0.5) * uResolution / minDimension;
                float distanceFromCenter = length(centered);
                vec2 radial = distanceFromCenter > 0.0001 ? centered / distanceFromCenter : vec2(1.0, 0.0);
                vec2 tangent = vec2(-radial.y, radial.x);

                float targetRadius = max(uTargetRadius, 0.02);
                float finalCoreRadius = min(max(uCoreRadius, targetRadius * 0.3), targetRadius * 0.82);
                float coreRadius = mix(max(pixel * 6.0, finalCoreRadius * 0.16), finalCoreRadius, progress);
                float activeRadius = mix(max(coreRadius * 1.2, targetRadius * 0.055), targetRadius, progress);
                float edge = max(pixel * 1.7, coreRadius * 0.0075);
                float motionScale = 1.0 - uReducedMotion * 0.82;
                float flowTime = uTime * mix(0.46, 0.09, uReducedMotion);

                vec4 distortionSample = texture2D(tDistortion, vUv);
                float distortion = distortionSample.r;
                float innerLensFromPass = distortionSample.g;
                float photonFromPass = distortionSample.b;
                float interiorMask = 1.0 - smoothstep(coreRadius * 0.84, coreRadius * 1.0, distanceFromCenter);
                float broadLensDistortion = max(distortion, interiorMask * 0.78);

                float lensNoise = fbm(centered * 5.8 + vec2(flowTime * 0.16, -flowTime * 0.09));
                float shimmer = (lensNoise - 0.5) * motionScale;
                float pull = broadLensDistortion * activeRadius * (0.42 + innerLensFromPass * 0.22 + interiorMask * 0.18)
                    / (0.92 + distanceFromCenter / max(activeRadius, 0.02));
                float edgeShimmer = broadLensDistortion
                    * activeRadius
                    * 0.008
                    * shimmer
                    * smoothstep(coreRadius * 0.9, coreRadius * 1.04, distanceFromCenter);
                vec2 warped = centered - radial * (pull + edgeShimmer);
                vec2 warpedUv = 0.5 + warped * minDimension / uResolution;

                float photonRing = softBand(
                    distanceFromCenter,
                    coreRadius * 1.012,
                    max(pixel * 1.45, coreRadius * 0.0065),
                    max(pixel * 2.8, coreRadius * 0.012)
                );
                float photonGlow = softBand(
                    distanceFromCenter,
                    coreRadius * 1.035,
                    max(pixel * 5.0, coreRadius * 0.038),
                    max(pixel * 8.0, coreRadius * 0.038)
                );
                float lensHalo = smoothstep(coreRadius * 0.82, coreRadius * 1.02, distanceFromCenter)
                    * (1.0 - smoothstep(activeRadius * 1.02, activeRadius * 1.34, distanceFromCenter))
                    * mix(0.25, 1.0, progress);
                float chromaAmount = (photonRing * 0.0038 + photonGlow * 0.0012) * motionScale;
                vec2 chromaUv = radial * chromaAmount * minDimension / uResolution;
                vec4 sceneMid = sampleScene(warpedUv);
                vec3 sceneRgb = mix(sceneMid.rgb, sampleRGBShift(warpedUv, chromaUv, 1.0), clamp(photonRing * 0.92 + photonGlow * 0.24, 0.0, 1.0));

                float coreWindow = 1.0 - smoothstep(coreRadius * 0.12, coreRadius * 1.02, distanceFromCenter);
                vec2 coreWarp = centered * (0.34 + 0.01 * shimmer)
                    - radial * activeRadius * (0.2 + broadLensDistortion * 0.12);
                vec2 coreUv = 0.5 + coreWarp * minDimension / uResolution;
                vec3 coreColor = vec3(0.0);
                float coreGlints = 0.0;

                float diskAngle = -0.1 + shimmer * 0.012;
                vec2 diskPoint = rotate2d(diskAngle) * centered;
                vec2 flattenedDisk = vec2(diskPoint.x, diskPoint.y * mix(2.4, 2.85, uReducedMotion));
                float diskDistance = length(flattenedDisk);
                float diskInner = coreRadius * 0.72;
                float diskOuter = max(activeRadius * 1.08, coreRadius * 1.18);
                float diskRange = max(diskOuter - diskInner, 0.001);
                float diskNorm = clamp((diskDistance - diskInner) / diskRange, 0.0, 1.0);
                float verticalWindow = 1.0 - smoothstep(coreRadius * 0.2, coreRadius * 0.88, abs(diskPoint.y));
                float diskWindow = smoothstep(diskInner, coreRadius + edge * 6.0, diskDistance)
                    * (1.0 - smoothstep(diskOuter - edge * 18.0, diskOuter, diskDistance))
                    * verticalWindow
                    * mix(0.2, 1.0, progress);
                float cloudNoise = fbm(flattenedDisk * 7.5 + vec2(flowTime * 0.32, -flowTime * 0.12));
                float fineCloud = fbm(flattenedDisk * 18.0 + vec2(-flowTime * 0.18, flowTime * 0.1));
                float frontFeather = smoothstep(-coreRadius * 0.2, coreRadius * 0.34, diskPoint.y);
                float doppler = smoothstep(-0.9, 0.9, diskPoint.x / max(distanceFromCenter, 0.001));
                float edgeAttenuation = smoothstep(0.0, 0.08, diskNorm) * (1.0 - smoothstep(0.84, 1.0, diskNorm));
                float cloud = diskWindow
                    * edgeAttenuation
                    * (0.2 + cloudNoise * 0.48 + fineCloud * 0.16)
                    * mix(0.64, 1.0, frontFeather)
                    * (0.78 + doppler * 0.16);
                vec2 speckUv = flattenedDisk * minDimension * 0.28 + vec2(flowTime * 20.0, -flowTime * 5.0);
                float specks = smoothstep(0.9972, 0.9995, hash(floor(speckUv)))
                    * smoothstep(0.12, 0.28, diskNorm)
                    * (1.0 - smoothstep(0.78, 1.0, diskNorm))
                    * diskWindow
                    * (1.0 - uReducedMotion * 0.72);

                sceneRgb *= 1.0 - broadLensDistortion * 0.05;
                sceneRgb *= 1.0 - interiorMask * 0.96;
                cloud *= 1.0 - interiorMask * 0.9;
                specks *= 1.0 - interiorMask;

                vec3 color = sceneRgb;
                color = mix(color, coreColor, coreWindow * 0.72);
                color *= 1.0 - coreWindow * 0.72;
                color += coreGlints * vec3(0.78, 0.84, 0.9);
                color += cloud * vec3(1.0, 0.48, 0.16) * 0.26;
                color += specks * vec3(1.0, 0.62, 0.28) * 0.46;
                color += vec3(1.0, 0.86, 0.54) * max(photonRing, photonFromPass * 0.62) * 1.36;
                color += vec3(0.95, 0.74, 0.48) * photonGlow * 0.22;
                color += vec3(0.82, 0.78, 0.68) * lensHalo * 0.025;

                float apertureShadow = softBand(distanceFromCenter, coreRadius * 0.92, max(pixel * 2.0, coreRadius * 0.07), edge * 5.0);
                color *= 1.0 - apertureShadow * 0.36;
                color *= 1.0 - 0.08 * distortion * (1.0 - smoothstep(coreRadius * 0.68, activeRadius * 1.44, distanceFromCenter));

                float lensMask = (1.0 - smoothstep(activeRadius * 1.02, activeRadius * 1.58, distanceFromCenter)) * progress;
                float lightMask = clamp(
                    max(photonRing, photonFromPass * 0.62)
                    + photonGlow * 0.42
                    + cloud * 0.8
                    + specks * 0.8
                    + lensHalo * 0.35,
                    0.0,
                    1.0
                ) * progress;
                float coreMask = coreWindow * progress;
                float effectAlpha = clamp(
                    max(lensMask * 0.58, coreMask * 0.98)
                    + lightMask * 0.38
                    + broadLensDistortion * 0.18 * progress,
                    0.0,
                    0.98
                );
                float dimAlpha = progress * 0.24;
                float outputAlpha = clamp(dimAlpha + effectAlpha * (1.0 - dimAlpha), 0.0, 0.98);
                vec3 outputColor = mix(vec3(0.0), clamp(color, 0.0, 1.28), effectAlpha / max(outputAlpha, 0.001));

                gl_FragColor = vec4(outputColor, outputAlpha);
            }`,
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        depthTest: false,
    });
    blackHoleState.material.toneMapped = false;

    blackHoleState.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blackHoleState.material);
    blackHoleState.scene.add(blackHoleState.mesh);
    resizeBlackHolePass();
}

function applyBlackHoleLogoFit() {
    const logo = document.getElementById('logo');
    const minDimension = Math.max(1, Math.min(window.innerWidth, window.innerHeight));
    const targetDiameter = minDimension * config.blackHole.targetDiameterRatio;
    const baseCoreDiameter = targetDiameter * config.blackHole.coreDiameterRatio;
    const maxCoreDiameter = targetDiameter * 0.88;
    let logoScale = 1;
    let logoMaxDimension = 0;

    if (logoContainer) logoContainer.style.setProperty('--black-hole-logo-scale', '1');

    if (logo) {
        const logoRect = logo.getBoundingClientRect();
        logoMaxDimension = Math.max(logoRect.width, logoRect.height);
    }

    if (logoMaxDimension > 0 && logoMaxDimension + config.blackHole.logoPadding > maxCoreDiameter) {
        logoScale = THREE.MathUtils.clamp(
            (maxCoreDiameter - config.blackHole.logoPadding) / logoMaxDimension,
            config.blackHole.minLogoScale,
            1,
        );
    }

    const fittedLogoDiameter = logoMaxDimension * logoScale + config.blackHole.logoPadding;
    const coreDiameter = THREE.MathUtils.clamp(
        Math.max(baseCoreDiameter, fittedLogoDiameter),
        baseCoreDiameter,
        maxCoreDiameter,
    );

    blackHoleState.logoScale = logoScale;
    blackHoleState.targetRadius = config.blackHole.targetDiameterRatio * 0.5;
    blackHoleState.coreRadius = coreDiameter / (minDimension * 2);

    if (logoContainer) logoContainer.style.setProperty('--black-hole-logo-scale', logoScale.toFixed(4));
    updateBlackHoleUniformLayout();
}

function updateBlackHoleUniformLayout() {
    if (blackHoleState.material) {
        blackHoleState.material.uniforms.uTargetRadius.value = blackHoleState.targetRadius;
        blackHoleState.material.uniforms.uCoreRadius.value = blackHoleState.coreRadius;
    }

    if (blackHoleState.distortionMaterial) {
        blackHoleState.distortionMaterial.uniforms.uTargetRadius.value = blackHoleState.targetRadius;
        blackHoleState.distortionMaterial.uniforms.uCoreRadius.value = blackHoleState.coreRadius;
    }
}

function resizeBlackHolePass() {
    if (!blackHoleState.renderTarget || !blackHoleState.material) return;

    const pixelRatio = renderer.getPixelRatio();
    blackHoleState.renderTarget.setSize(
        Math.ceil(window.innerWidth * pixelRatio),
        Math.ceil(window.innerHeight * pixelRatio),
    );
    blackHoleState.distortionTarget.setSize(
        Math.max(1, Math.ceil(window.innerWidth * pixelRatio)),
        Math.max(1, Math.ceil(window.innerHeight * pixelRatio)),
    );

    if (blackHoleState.active) applyBlackHoleLogoFit();

    blackHoleState.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    blackHoleState.distortionMaterial.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    updateBlackHoleUniformLayout();
}

function updateBlackHole(elapsedTime) {
    if (!blackHoleState.active || !blackHoleState.material) return;

    const elapsed = performance.now() - blackHoleState.startTime;
    blackHoleState.progress = THREE.MathUtils.clamp(elapsed / config.blackHole.growthDuration, 0, 1);
    blackHoleState.material.uniforms.uTime.value = elapsedTime;
    blackHoleState.material.uniforms.uProgress.value = blackHoleState.progress;
    blackHoleState.distortionMaterial.uniforms.uProgress.value = blackHoleState.progress;
}

function renderFrame() {
    if (!blackHoleState.active) {
        renderer.render(scene, camera);
        return;
    }

    renderer.setRenderTarget(blackHoleState.renderTarget);
    renderer.clear();
    renderer.render(scene, camera);

    renderer.setRenderTarget(blackHoleState.distortionTarget);
    renderer.clear();
    renderer.render(blackHoleState.distortionScene, blackHoleState.distortionCamera);

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(blackHoleState.scene, blackHoleState.camera);
    renderer.autoClear = true;
}

function updatePointerAndCamera(delta, elapsedTime) {
    pointerCurrent.lerp(pointerTarget, config.pointerSmoothing);
    const idleTime = performance.now() - lastPointerActivity;
    const targetFlight = blackHoleState.active
        ? 0
        : smoothstep(0, config.flight.fadeIn, idleTime - config.flight.idleDelay);
    const response = targetFlight > flightIntensity ? config.flight.rise : config.flight.fall;
    flightIntensity = THREE.MathUtils.damp(flightIntensity, targetFlight, response, delta);
    flightVisualIntensity = smootherstep(0.02, 1, flightIntensity);
    if (!blackHoleState.active) {
        flightDistance += delta * config.flight.speed * flightVisualIntensity;
    }

    const blackHoleUnlockElapsed = blackHoleState.active
        ? Math.max(0, performance.now() - blackHoleState.startTime - config.blackHole.growthDuration)
        : config.blackHole.parallaxUnlockDuration;
    const blackHoleUnlockProgress = smootherstep(0, config.blackHole.parallaxUnlockDuration, blackHoleUnlockElapsed);
    const blackHoleParallaxLock = blackHoleState.active ? 1 - blackHoleUnlockProgress : 0;
    const targetParallaxLock = Math.max(flightVisualIntensity, blackHoleParallaxLock);
    const lockResponse = targetParallaxLock > parallaxLock ? 7.5 : 1.15;
    parallaxLock = THREE.MathUtils.damp(parallaxLock, targetParallaxLock, lockResponse, delta);
    pointerParallax.copy(pointerCurrent).multiplyScalar(1 - smootherstep(0, 1, parallaxLock));

    const targetCameraX = -pointerParallax.x * 0.035;
    const targetCameraY = pointerParallax.y * 0.028;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.035);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCameraY, 0.035);
    camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, -pointerParallax.y * 0.000035, 0.04);
    camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, -pointerParallax.x * 0.00004, 0.04);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0, 0.035);

    if (blackHoleState.active) {
        logoOffset.set(0, 0);
        logoTarget.set(0, 0);
        logoContainer.style.transform = 'translate(-50%, -50%)';
        logoContainer.style.setProperty('--flight-intensity', '0');
        return;
    }

    logoTarget.set(-pointerParallax.x * config.logoMovementRatio, -pointerParallax.y * config.logoMovementRatio);
    logoOffset.lerp(logoTarget, config.logoSmoothing);

    const logoScale = 1 + flightVisualIntensity * 0.025;
    logoContainer.style.transform = `translate(calc(-50% + ${logoOffset.x.toFixed(2)}px), calc(-50% + ${logoOffset.y.toFixed(2)}px)) scale(${logoScale.toFixed(4)})`;
    logoContainer.style.setProperty('--flight-intensity', flightVisualIntensity.toFixed(3));
}

function updateStars(elapsedTime) {
    starLayers.forEach((layer, index) => {
        layer.material.uniforms.uTime.value = elapsedTime;
        layer.material.uniforms.uFlightDistance.value = flightDistance;
        layer.material.uniforms.uFlightIntensity.value = flightVisualIntensity;
        layer.position.x = -pointerParallax.x * layer.userData.parallaxFactor;
        layer.position.y = pointerParallax.y * layer.userData.parallaxFactor;
        layer.rotation.z = layer.userData.baseRotation;
    });
}

function updateNebula(delta, elapsedTime) {
    nebulaClouds.forEach((cloud, index) => {
        cloud.material.uniforms.uTime.value = elapsedTime;
        cloud.rotation.z += cloud.userData.rotationSpeed * delta;
        const phase = cloud.userData.phase;
        cloud.position.x = cloud.userData.base.x - pointerParallax.x * cloud.userData.parallax + Math.sin(elapsedTime * 0.055 + phase) * 20;
        cloud.position.y = cloud.userData.base.y + pointerParallax.y * cloud.userData.parallax + Math.cos(elapsedTime * 0.047 + phase) * 16;
        cloud.position.z = cloud.userData.base.z;
    });
}

function updateCelestialEvents(delta) {
    if (!celestialEventCtx) return;

    celestialEventCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    if (blackHoleState.active) return;

    celestialEventCtx.save();
    celestialEventCtx.globalCompositeOperation = 'lighter';

    for (let i = celestialEvents.length - 1; i >= 0; i--) {
        const event = celestialEvents[i];
        event.age += delta;
        event.x += event.vx * delta;
        event.y += event.vy * delta;

        const progress = event.age / event.life;
        if (progress >= 1) {
            celestialEvents.splice(i, 1);
            continue;
        }

        drawCelestialEvent(event, progress);
    }

    celestialEventCtx.restore();
}

function drawCelestialEvent(event, progress) {
    const fadeIn = smoothstep(0, 0.14, progress);
    const fadeOut = 1 - smoothstep(0.64, 1, progress);
    const alpha = event.opacity * fadeIn * fadeOut;
    if (alpha <= 0.002) return;

    const tailX = event.x - event.dirX * event.tailLength;
    const tailY = event.y - event.dirY * event.tailLength;
    const tailGradient = celestialEventCtx.createLinearGradient(event.x, event.y, tailX, tailY);
    tailGradient.addColorStop(0, colorString(event.headColor, alpha * 0.86));
    tailGradient.addColorStop(0.28, colorString(event.tailColor, alpha * 0.34));
    tailGradient.addColorStop(1, colorString(event.tailColor, 0));

    celestialEventCtx.strokeStyle = tailGradient;
    celestialEventCtx.lineWidth = event.tailWidth;
    celestialEventCtx.lineCap = 'round';
    celestialEventCtx.beginPath();
    celestialEventCtx.moveTo(event.x, event.y);
    celestialEventCtx.lineTo(tailX, tailY);
    celestialEventCtx.stroke();

    if (event.type === 'comet') {
        const dustX = event.x - event.dirX * event.tailLength * 0.72 + event.sideX * event.tailWidth * 1.5;
        const dustY = event.y - event.dirY * event.tailLength * 0.72 + event.sideY * event.tailWidth * 1.5;
        const dustGradient = celestialEventCtx.createLinearGradient(event.x, event.y, dustX, dustY);
        dustGradient.addColorStop(0, colorString(event.headColor, alpha * 0.3));
        dustGradient.addColorStop(1, colorString(event.tailColor, 0));
        celestialEventCtx.strokeStyle = dustGradient;
        celestialEventCtx.lineWidth = event.tailWidth * 1.8;
        celestialEventCtx.beginPath();
        celestialEventCtx.moveTo(event.x, event.y);
        celestialEventCtx.lineTo(dustX, dustY);
        celestialEventCtx.stroke();
    }

    const glowRadius = event.headRadius * (event.type === 'comet' ? 5.4 : 3.6);
    const headGradient = celestialEventCtx.createRadialGradient(
        event.x,
        event.y,
        0,
        event.x,
        event.y,
        glowRadius,
    );
    headGradient.addColorStop(0, colorString(event.headColor, alpha));
    headGradient.addColorStop(0.32, colorString(event.headColor, alpha * 0.38));
    headGradient.addColorStop(1, colorString(event.tailColor, 0));

    celestialEventCtx.fillStyle = headGradient;
    celestialEventCtx.beginPath();
    celestialEventCtx.arc(event.x, event.y, glowRadius, 0, Math.PI * 2);
    celestialEventCtx.fill();
}

function scheduleCelestialEvent(delay) {
    if (celestialEventTimer) clearTimeout(celestialEventTimer);

    celestialEventTimer = setTimeout(() => {
        spawnCelestialEvent();
        scheduleCelestialEvent(randRange(config.celestialEvents.interval[0], config.celestialEvents.interval[1]));
    }, delay);
}

function spawnCelestialEvent() {
    if (celestialEvents.length >= config.celestialEvents.maxActive) return;

    const type = Math.random() < 0.7 ? 'meteor' : 'comet';
    const path = getCelestialEventPath(type);
    const palette = getCelestialEventPalette();
    const brightness = config.celestialEvents.brightness;

    celestialEvents.push({
        type,
        x: path.startX,
        y: path.startY,
        vx: path.dirX * path.speed,
        vy: path.dirY * path.speed,
        dirX: path.dirX,
        dirY: path.dirY,
        sideX: -path.dirY,
        sideY: path.dirX,
        life: path.life,
        age: 0,
        headRadius: path.headRadius,
        tailLength: path.tailLength,
        tailWidth: path.tailWidth,
        opacity: path.opacity * brightness,
        headColor: palette.head,
        tailColor: palette.tail,
    });
}

function getCelestialEventPath(type) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const compactScale = quality.isCompact ? 0.74 : 1;
    const reducedScale = quality.prefersReducedMotion ? 0.55 : 1;
    const rightward = Math.random() > 0.5;
    const angle = randRange(0.58, 0.98);
    const dirX = Math.cos(rightward ? angle : Math.PI - angle);
    const dirY = Math.sin(angle);
    const buffer = 120;
    const startX = rightward ? randRange(-buffer, width * 0.92) : randRange(width * 0.08, width + buffer);
    const startY = randRange(-buffer, height * 0.34);

    if (type === 'comet') {
        return {
            startX,
            startY,
            dirX,
            dirY,
            speed: randRange(165, 300) * compactScale * reducedScale,
            life: randRange(1.9, 3.2) / reducedScale,
            headRadius: randRange(2, 3.2) * compactScale,
            tailLength: randRange(70, 135) * compactScale,
            tailWidth: randRange(1.5, 2.4) * compactScale,
            opacity: randRange(0.24, 0.4),
        };
    }

    return {
        startX,
        startY,
        dirX,
        dirY,
        speed: randRange(430, 760) * compactScale * reducedScale,
        life: randRange(0.75, 1.35) / reducedScale,
        headRadius: randRange(1.1, 1.85) * compactScale,
        tailLength: randRange(70, 155) * compactScale,
        tailWidth: randRange(0.9, 1.45) * compactScale,
        opacity: randRange(0.26, 0.44),
    };
}

function getCelestialEventPalette() {
    const palettes = [
        { head: [210, 224, 248], tail: [118, 140, 178] },
        { head: [238, 218, 170], tail: [182, 132, 78] },
        { head: [224, 182, 142], tail: [158, 86, 54] },
        { head: [190, 210, 232], tail: [92, 118, 150] },
    ];
    return palettes[Math.floor(Math.random() * palettes.length)];
}

function colorString(rgb, alpha) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${THREE.MathUtils.clamp(alpha, 0, 1)})`;
}

function onWindowResize() {
    windowHalf.set(window.innerWidth / 2, window.innerHeight / 2);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeCelestialEventCanvas();
    resizeBlackHolePass();
}

function onPointerMove(event) {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
        pointerTarget.x = event.clientX - windowHalf.x;
        pointerTarget.y = event.clientY - windowHalf.y;
        lastPointerActivity = performance.now();
    }
}

function markPointerIdle() {
    pointerTarget.set(0, 0);
    lastPointerActivity = performance.now() - config.flight.idleDelay - 100;
}

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    const elapsedTime = clock.getElapsedTime();

    updatePointerAndCamera(delta, elapsedTime);
    updateStars(elapsedTime);
    updateNebula(delta, elapsedTime);
    updateCelestialEvents(delta);
    updateBlackHole(elapsedTime);

    renderFrame();
}

init();
