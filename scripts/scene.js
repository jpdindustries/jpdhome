import * as THREE from 'three';

let scene, camera, renderer, objectTrailCanvas, objectTrailCtx;
let logoContainer, spaceObjectContainer, currentSpaceObjectElement;
const clock = new THREE.Clock();

const pointerTarget = new THREE.Vector2();
const pointerCurrent = new THREE.Vector2();
const logoOffset = new THREE.Vector2();
const logoTarget = new THREE.Vector2();
const windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

const starLayers = [];
const nebulaClouds = [];
const objectTrailParticles = [];
const reusableColor = new THREE.Color();

let lastPointerActivity = performance.now();
let flightIntensity = 0;
let flightVisualIntensity = 0;
let flightDistance = 0;
let lastTrailScreenPosition = null;
let activeObjectVelocity = new THREE.Vector2(1, 0);

const quality = getQualitySettings();

const config = {
    logoMovementRatio: quality.isCompact ? 0.026 : 0.048,
    pointerSmoothing: 0.055,
    logoSmoothing: 0.045,
    spaceObjects: [
        { id: 'astronaut', name: 'Astronaut', size: quality.isCompact ? 38 : 48, trailHue: 0.56 },
        { id: 'meteorite', name: 'Meteorite', size: quality.isCompact ? 34 : 42, trailHue: 0.04 },
        { id: 'rocket', name: 'Rocket', size: quality.isCompact ? 40 : 50, trailHue: 0.94 },
        { id: 'satellite', name: 'Satellite', size: quality.isCompact ? 36 : 44, trailHue: 0.15 },
    ],
    flight: {
        idleDelay: quality.prefersReducedMotion ? 9000 : 3200,
        fadeIn: quality.prefersReducedMotion ? 6500 : 4300,
        rise: quality.prefersReducedMotion ? 0.38 : 0.72,
        fall: quality.prefersReducedMotion ? 1.4 : 2.8,
        speed: quality.flightSpeed,
        drift: quality.isCompact ? 34 : 68,
    },
    trail: {
        maxParticles: quality.trailParticles,
        emitRate: quality.trailEmitRate,
        baseLife: quality.isCompact ? 0.68 : 0.92,
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
            trailParticles: 240,
            trailEmitRate: 1,
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
            trailParticles: 360,
            trailEmitRate: 1,
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
            trailParticles: 500,
            trailEmitRate: 2,
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
        trailParticles: 700,
        trailEmitRate: 4,
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
    spaceObjectContainer = document.getElementById('space-object-container');

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
    createTrail();

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('pointermove', onPointerMove, false);
    document.addEventListener('mouseleave', markPointerIdle, false);
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) clock.getDelta();
    });

    setTimeout(launchSpaceObject, quality.isCompact ? 1800 : 1200);
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

            float hash(float n) {
                return fract(sin(n) * 43758.5453123);
            }

            void main() {
                float moved = position.z - uFarZ + uFlightDistance * uLayerSpeed;
                float cycle = floor(moved / uDepthSpan);
                float wrappedZ = uFarZ + mod(moved, uDepthSpan);
                vec2 cycleJitter = vec2(hash(random * 91.7 + cycle * 17.0), hash(random * 37.1 + cycle * 29.0)) - 0.5;
                vec3 animatedPosition = vec3(position.xy + cycleJitter * 180.0 * uFlightIntensity, wrappedZ);

                vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
                float perspective = 720.0 / max(180.0, -mvPosition.z);
                float streakBoost = mix(1.0, 2.65, uFlightIntensity * smoothstep(0.18, 1.0, perspective));

                gl_PointSize = clamp(size * perspective * streakBoost, 0.65, 22.0);
                gl_Position = projectionMatrix * mvPosition;

                vColor = color;
                vRandom = random;
                vFlight = uFlightIntensity;
                vAngle = atan(mvPosition.y, mvPosition.x);
                vDepthGlow = smoothstep(0.0, 1.0, perspective);
            }`,
        fragmentShader: `
            precision highp float;
            uniform float uTime;
            varying vec3 vColor;
            varying float vRandom;
            varying float vFlight;
            varying float vAngle;
            varying float vDepthGlow;

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
                vec3 rgbShift = 0.08 * vec3(
                    sin(uTime * 0.35 + vRandom * 17.0),
                    sin(uTime * 0.42 + vRandom * 19.0 + 2.1),
                    sin(uTime * 0.31 + vRandom * 23.0 + 4.2)
                );
                vec3 color = clamp(vColor + rgbShift + glint * vec3(0.45, 0.22, 0.7), 0.0, 1.35);

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
    if (randomValue < 0.34) color.setHSL(0.57 + layerIndex * 0.012, 0.95, 0.74);
    else if (randomValue < 0.55) color.setHSL(0.81, 0.98, 0.72);
    else if (randomValue < 0.74) color.setHSL(0.12, 0.96, 0.72);
    else if (randomValue < 0.9) color.setHSL(0.96, 0.94, 0.72);
    else color.setHSL(Math.random(), 1.0, 0.68);
}

function createStars() {
    config.starLayers.forEach((layerConfig, index) => {
        const layer = createStarLayer(layerConfig, index);
        starLayers.push(layer);
        scene.add(layer);
    });
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

function createTrail() {
    objectTrailCanvas = document.createElement('canvas');
    objectTrailCanvas.id = 'object-trail-canvas';
    objectTrailCanvas.style.position = 'fixed';
    objectTrailCanvas.style.inset = '0';
    objectTrailCanvas.style.zIndex = '3';
    objectTrailCanvas.style.pointerEvents = 'none';
    objectTrailCanvas.style.width = '100%';
    objectTrailCanvas.style.height = '100%';
    objectTrailCanvas.style.mixBlendMode = 'screen';
    document.body.insertBefore(objectTrailCanvas, spaceObjectContainer);

    objectTrailCtx = objectTrailCanvas.getContext('2d');
    resizeTrailCanvas();
}

function resizeTrailCanvas() {
    if (!objectTrailCanvas || !objectTrailCtx) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    objectTrailCanvas.width = Math.ceil(window.innerWidth * pixelRatio);
    objectTrailCanvas.height = Math.ceil(window.innerHeight * pixelRatio);
    objectTrailCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function smoothstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

function smootherstep(edge0, edge1, value) {
    const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
}

function updatePointerAndCamera(delta, elapsedTime) {
    pointerCurrent.lerp(pointerTarget, config.pointerSmoothing);
    const idleTime = performance.now() - lastPointerActivity;
    const targetFlight = smoothstep(0, config.flight.fadeIn, idleTime - config.flight.idleDelay);
    const response = targetFlight > flightIntensity ? config.flight.rise : config.flight.fall;
    flightIntensity = THREE.MathUtils.damp(flightIntensity, targetFlight, response, delta);
    flightVisualIntensity = smootherstep(0.02, 1, flightIntensity);
    flightDistance += delta * config.flight.speed * flightVisualIntensity;

    const driftX = Math.sin(elapsedTime * 0.21) * config.flight.drift * flightVisualIntensity;
    const driftY = Math.cos(elapsedTime * 0.17) * config.flight.drift * 0.62 * flightVisualIntensity;
    const targetCameraX = -pointerCurrent.x * 0.035 + driftX;
    const targetCameraY = pointerCurrent.y * 0.028 + driftY;
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.035);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCameraY, 0.035);
    camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, -pointerCurrent.y * 0.000035 + Math.sin(elapsedTime * 0.19) * 0.012 * flightVisualIntensity, 0.04);
    camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, -pointerCurrent.x * 0.00004 + Math.cos(elapsedTime * 0.15) * 0.016 * flightVisualIntensity, 0.04);
    camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, Math.sin(elapsedTime * 0.13) * 0.018 * flightVisualIntensity, 0.035);

    logoTarget.set(-pointerCurrent.x * config.logoMovementRatio, -pointerCurrent.y * config.logoMovementRatio);
    logoTarget.x += Math.sin(elapsedTime * 0.4) * 5 * flightVisualIntensity;
    logoTarget.y += Math.cos(elapsedTime * 0.34) * 4 * flightVisualIntensity;
    logoOffset.lerp(logoTarget, config.logoSmoothing);

    const logoScale = 1 + flightVisualIntensity * 0.025;
    const logoTilt = Math.sin(elapsedTime * 0.5) * flightVisualIntensity * 1.2;
    logoContainer.style.transform = `translate(calc(-50% + ${logoOffset.x.toFixed(2)}px), calc(-50% + ${logoOffset.y.toFixed(2)}px)) scale(${logoScale.toFixed(4)}) rotate(${logoTilt.toFixed(3)}deg)`;
    logoContainer.style.setProperty('--flight-intensity', flightVisualIntensity.toFixed(3));
}

function updateStars(elapsedTime) {
    starLayers.forEach((layer, index) => {
        layer.material.uniforms.uTime.value = elapsedTime;
        layer.material.uniforms.uFlightDistance.value = flightDistance;
        layer.material.uniforms.uFlightIntensity.value = flightVisualIntensity;
        layer.position.x = -pointerCurrent.x * layer.userData.parallaxFactor + Math.sin(elapsedTime * (0.08 + index * 0.017)) * 22 * flightVisualIntensity;
        layer.position.y = pointerCurrent.y * layer.userData.parallaxFactor + Math.cos(elapsedTime * (0.075 + index * 0.013)) * 18 * flightVisualIntensity;
        layer.rotation.z = layer.userData.baseRotation + Math.sin(elapsedTime * 0.05 + index) * 0.012 * flightVisualIntensity;
    });
}

function updateNebula(delta, elapsedTime) {
    nebulaClouds.forEach((cloud, index) => {
        cloud.material.uniforms.uTime.value = elapsedTime;
        cloud.rotation.z += cloud.userData.rotationSpeed * delta * (1 + flightVisualIntensity * 1.8);
        const phase = cloud.userData.phase;
        cloud.position.x = cloud.userData.base.x - pointerCurrent.x * cloud.userData.parallax + Math.sin(elapsedTime * 0.055 + phase) * 58 * (0.35 + flightVisualIntensity);
        cloud.position.y = cloud.userData.base.y + pointerCurrent.y * cloud.userData.parallax + Math.cos(elapsedTime * 0.047 + phase) * 46 * (0.35 + flightVisualIntensity);
        cloud.position.z = cloud.userData.base.z + Math.sin(elapsedTime * 0.04 + index) * 26 * flightVisualIntensity;
    });
}

function updateTrail(delta, elapsedTime) {
    if (currentSpaceObjectElement && spaceObjectContainer.classList.contains('animate')) {
        const rect = currentSpaceObjectElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
            const currentScreenX = rect.left + rect.width / 2;
            const currentScreenY = rect.top + rect.height / 2;

            if (!lastTrailScreenPosition) {
                lastTrailScreenPosition = new THREE.Vector2(currentScreenX, currentScreenY);
            }

            const deltaX = currentScreenX - lastTrailScreenPosition.x;
            const deltaY = currentScreenY - lastTrailScreenPosition.y;
            const moved = Math.hypot(deltaX, deltaY);
            const travelX = moved > 0.35 ? deltaX / moved : activeObjectVelocity.x;
            const travelY = moved > 0.35 ? deltaY / moved : activeObjectVelocity.y;
            const backX = -travelX;
            const backY = -travelY;
            const sideX = -travelY;
            const sideY = travelX;
            const objectRadius = Math.max(rect.width, rect.height) * 0.42;
            const emitterX = currentScreenX + backX * objectRadius;
            const emitterY = currentScreenY + backY * objectRadius;

            const emitRate = Math.round(THREE.MathUtils.lerp(config.trail.emitRate, config.trail.emitRate + 1, flightVisualIntensity));
            for (let i = 0; i < emitRate; i++) {
                spawnTrailParticle(emitterX, emitterY, backX, backY, sideX, sideY, elapsedTime, i, currentSpaceObjectElement.id);
            }

            lastTrailScreenPosition.set(currentScreenX, currentScreenY);
        }
    } else {
        lastTrailScreenPosition = null;
    }

    objectTrailCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    objectTrailCtx.save();
    objectTrailCtx.globalCompositeOperation = 'lighter';

    for (let i = objectTrailParticles.length - 1; i >= 0; i--) {
        const particle = objectTrailParticles[i];
        particle.life -= delta;
        if (particle.life <= 0) {
            objectTrailParticles.splice(i, 1);
            continue;
        }

        const progress = particle.life / particle.maxLife;
        const alpha = progress * progress * 0.48;
        const radius = particle.size * (0.42 + progress * 0.42);
        const gradient = objectTrailCtx.createRadialGradient(
            particle.x,
            particle.y,
            0,
            particle.x,
            particle.y,
            radius,
        );
        gradient.addColorStop(0, `hsla(${particle.hue}, 78%, 70%, ${alpha})`);
        gradient.addColorStop(0.48, `hsla(${particle.hue}, 70%, 58%, ${alpha * 0.38})`);
        gradient.addColorStop(1, `hsla(${particle.hue}, 62%, 44%, 0)`);

        objectTrailCtx.fillStyle = gradient;
        objectTrailCtx.beginPath();
        objectTrailCtx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        objectTrailCtx.fill();
    }

    objectTrailCtx.restore();
}

function spawnTrailParticle(originX, originY, backX, backY, sideX, sideY, elapsedTime, index, objectId) {
    if (objectTrailParticles.length >= config.trail.maxParticles) {
        objectTrailParticles.splice(0, objectTrailParticles.length - config.trail.maxParticles + 1);
    }

    const hue = getTrailHue(objectId, index);
    const maxLife = config.trail.baseLife * THREE.MathUtils.randFloat(0.5, 0.94);
    objectTrailParticles.push({
        x: originX + sideX * THREE.MathUtils.randFloatSpread(7) + backX * THREE.MathUtils.randFloat(0, 6),
        y: originY + sideY * THREE.MathUtils.randFloatSpread(7) + backY * THREE.MathUtils.randFloat(0, 6),
        hue,
        size: THREE.MathUtils.randFloat(5, quality.isCompact ? 13 : 19) * (1 + flightVisualIntensity * 0.12),
        life: maxLife,
        maxLife,
    });
}

function getTrailHue(objectId, index) {
    const objectConfig = config.spaceObjects.find((object) => object.id === objectId);
    const baseHue = ((objectConfig?.trailHue ?? 0.58) * 360) % 360;
    return Math.round((baseHue + index * 3 + THREE.MathUtils.randFloatSpread(12) + 360) % 360);
}

function onWindowResize() {
    windowHalf.set(window.innerWidth / 2, window.innerHeight / 2);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    resizeTrailCanvas();
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
    updateTrail(delta, elapsedTime);

    renderer.render(scene, camera);
}

function selectSpaceObject() {
    const selected = config.spaceObjects[Math.floor(Math.random() * config.spaceObjects.length)];
    const element = document.getElementById(selected.id);
    document.querySelectorAll('.space-object').forEach((el) => {
        el.style.display = 'none';
    });

    if (element) {
        element.style.display = 'block';
        element.style.width = `${selected.size}px`;
        currentSpaceObjectElement = element;
    }

    return { ...selected, element };
}

function getOffscreenPositions(buffer) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const startPos = { x: 0, y: 0 };
    const endPos = { x: 0, y: 0 };
    const edge = Math.floor(Math.random() * 4);

    switch (edge) {
        case 0:
            startPos.x = Math.random() * vw;
            startPos.y = -buffer;
            endPos.x = Math.random() * vw;
            endPos.y = vh + buffer;
            break;
        case 1:
            startPos.x = vw + buffer;
            startPos.y = Math.random() * vh;
            endPos.x = -buffer;
            endPos.y = Math.random() * vh;
            break;
        case 2:
            startPos.x = Math.random() * vw;
            startPos.y = vh + buffer;
            endPos.x = Math.random() * vw;
            endPos.y = -buffer;
            break;
        default:
            startPos.x = -buffer;
            startPos.y = Math.random() * vh;
            endPos.x = vw + buffer;
            endPos.y = Math.random() * vh;
            break;
    }

    return { startPos, endPos };
}

function getObjectRotation(id, startPos, endPos, element) {
    if (id === 'rocket') {
        const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x) * (180 / Math.PI) + 90;
        return {
            startRotation: angle,
            endRotation: angle,
        };
    }

    if (element) element.style.transform = '';
    const startRotation = Math.random() * 360;
    const spin = (Math.random() > 0.5 ? 1 : -1) * THREE.MathUtils.randFloat(120, 300);
    return {
        startRotation,
        endRotation: startRotation + spin,
    };
}

function launchSpaceObject() {
    const container = spaceObjectContainer;
    const spaceObject = selectSpaceObject();
    if (!spaceObject.element || !container) return;

    container.classList.remove('animate', 'rocket');
    void container.offsetWidth;

    const size = spaceObject.element.offsetWidth || spaceObject.size || 58;
    const buffer = size * 5 + 70;
    const { startPos, endPos } = getOffscreenPositions(buffer);
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    const length = Math.hypot(dx, dy) || 1;
    activeObjectVelocity.set(dx / length, dy / length);

    const duration = THREE.MathUtils.randFloat(quality.isCompact ? 7 : 8, quality.isCompact ? 12 : 14);
    const scale = THREE.MathUtils.randFloat(0.82, 1.08);
    const { startRotation, endRotation } = getObjectRotation(spaceObject.id, startPos, endPos, spaceObject.element);

    if (spaceObject.id === 'rocket') container.classList.add('rocket');

    Object.entries({
        '--start-x': `${startPos.x}px`,
        '--start-y': `${startPos.y}px`,
        '--end-x': `${endPos.x}px`,
        '--end-y': `${endPos.y}px`,
        '--duration': `${duration}s`,
        '--start-rotate': `${startRotation}deg`,
        '--end-rotate': `${endRotation}deg`,
        '--object-scale': scale.toFixed(3),
    }).forEach(([prop, value]) => container.style.setProperty(prop, value));

    lastTrailScreenPosition = null;
    container.classList.add('animate');

    const onDone = () => {
        container.classList.remove('animate', 'rocket');
        currentSpaceObjectElement = null;
        lastTrailScreenPosition = null;
        setTimeout(launchSpaceObject, THREE.MathUtils.randFloat(1800, 5600));
    };

    if (container.animationTimeout) clearTimeout(container.animationTimeout);
    container.animationTimeout = setTimeout(onDone, duration * 1000 + 120);
}

init();
