import * as THREE from 'three';

// THREE.js objects
let scene, camera, renderer, nebulaClouds = [], trailParticles, starLayers = [];
const clock = new THREE.Clock();


// Mouse and interaction objects
const mouse = new THREE.Vector2();
const target = new THREE.Vector2();
const windowHalf = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

// Logo recentering
let mouseInactivityTimer = null;
let isMouseActive = false;
const MOUSE_INACTIVITY_DELAY = 3000; // 3 seconds
let currentLogoOffsetX = 0;
let currentLogoOffsetY = 0;
let targetLogoOffsetX = 0;
let targetLogoOffsetY = 0;

// DOM elements
let logoContainer, spaceObjectContainer;
let currentSpaceObjectElement;

// Config
const config = {
    logoMovementRatio: 0.05,
    spaceObjects: [
        { id: 'astronaut', name: 'Astronaut' },
        { id: 'meteorite', name: 'Meteorite' },
        { id: 'rocket', name: 'Rocket' },
        { id: 'satellite', name: 'Satellite' }
    ],
    trail: {
        maxParticles: 500,
        emitRate: 3,
    },
    lissajous: {
        magnitude: 800,
        speed: 0.001,
        a: 3,
        b: 4,
        delta: Math.PI / 2,
    },
};

function init() {
    logoContainer = document.getElementById('logo-container');
    spaceObjectContainer = document.getElementById('space-object-container');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
    camera.position.z = 1000;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.insertBefore(renderer.domElement, document.body.firstChild);

    renderer.domElement.style.position = 'fixed';
    renderer.domElement.style.top = 0;
    renderer.domElement.style.left = 0;
    renderer.domElement.style.zIndex = -2;

    createStars();
    createNebula();
    createTrail();

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('pointermove', onMouseMove, false);
    document.addEventListener('mouseleave', onMouseLeave, false);

    setTimeout(launchSpaceObject, 1500);
    animate();
}

function createStarLayer(numStars, size, minDepth, maxDepth, parallaxFactor) {
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numStars * 3);
    const colors = new Float32Array(numStars * 3);
    const sizes = new Float32Array(numStars);
    const randoms = new Float32Array(numStars);
    const color = new THREE.Color();

    for (let i = 0; i < numStars; i++) {
        const i3 = i * 3;
        positions[i3] = THREE.MathUtils.randFloatSpread(2000);
        positions[i3 + 1] = THREE.MathUtils.randFloatSpread(2000);
        positions[i3 + 2] = THREE.MathUtils.randFloat(minDepth, maxDepth);

        const rand = Math.random();
        if (rand < 0.7) color.set(0xaec6ff);
        else if (rand < 0.9) color.set(0xfff4a3);
        else color.set(0xffa5a5);
        
        colors[i3] = color.r;
        colors[i3 + 1] = color.g;
        colors[i3 + 2] = color.b;

        sizes[i] = THREE.MathUtils.randFloat(size * 0.35, size * 0.4);
        randoms[i] = Math.random();
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    starGeometry.setAttribute('random', new THREE.BufferAttribute(randoms, 1));

    const starMaterial = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0.0 } },
        vertexShader: `
            attribute float size; attribute vec3 color; attribute float random;
            varying vec3 vColor; varying float vRandom;
            void main() {
                vColor = color; vRandom = random;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * (600.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            uniform float uTime; varying vec3 vColor; varying float vRandom;
            void main() {
                float d = distance(gl_PointCoord, vec2(0.5, 0.5));
                if (d > 0.5) discard;
                
                // Improved gentle twinkling with multiple frequencies
                float twinkle1 = sin(uTime * 1.5 * vRandom + vRandom * 6.28);
                float twinkle2 = sin(uTime * 0.8 * vRandom + vRandom * 3.14);
                float twinkle = 0.8 + 0.15 * twinkle1 + 0.05 * twinkle2;
                
                float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * twinkle;
                
                gl_FragColor = vec4(vColor, alpha);
            }`,
        blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    stars.userData.parallaxFactor = parallaxFactor;
    return stars;
}

function createStars() {
    // Multiple layers at different depths
    starLayers.push(createStarLayer(30000, 2, 500, 200, 0.05));  // Distant layer
    starLayers.push(createStarLayer(50000, 3, 700, 400, 0.1));    // Middle layer
    starLayers.push(createStarLayer(20000, 4, 900, 600, 0.2));     // Near layer
    starLayers.forEach(layer => scene.add(layer));
}


function createNebula() {
    const planeSize = 4500; // Much larger size to span more of window
    const nebulaGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
    for (let i = 0; i < 6; i++) { // More clouds for better coverage
        const r = Math.random() > 0.5 ? 1.0 : 0.4; const b = Math.random() > 0.5 ? 1.0 : 0.6;
        const nebulaMaterial = new THREE.ShaderMaterial({
            uniforms: { 
                uTime: { value: 0 }, 
                uColor: { value: new THREE.Vector3(r, 0.0, b) }, 
                uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
                uOffset: { value: new THREE.Vector2(Math.random() * 100, Math.random() * 100) }
            },
            vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
            fragmentShader: `
                uniform float uTime; uniform vec3 uColor; uniform vec2 uResolution; uniform vec2 uOffset; varying vec2 vUv;
                float random(vec2 st) { return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123); }
                float noise(vec2 st) {
                    vec2 i = floor(st); vec2 f = fract(st); float a = random(i); float b = random(i + vec2(1.0, 0.0));
                    float c = random(i + vec2(0.0, 1.0)); float d = random(i + vec2(1.0, 1.0));
                    vec2 u = f * f * (3.0 - 2.0 * f); return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.y * u.x;
                }
                float fbm(vec2 st) {
                    float value = 0.0; float amplitude = 0.5;
                    for (int i = 0; i < 7; i++) { value += amplitude * noise(st); st *= 2.1; amplitude *= 0.45; }
                    return value;
                }
                void main() {
                    vec2 st = vUv * 3.0 + uOffset; // Use UV coordinates instead of screen coordinates
                    vec2 q = vec2(fbm(st + 0.05 * uTime), fbm(st + vec2(1.0)));
                    vec2 r = vec2(fbm(st + 1.0 * q + vec2(1.7, 9.2) + 0.08 * uTime), fbm(st + 1.0 * q + vec2(8.3, 2.8) + 0.063 * uTime));
                    float f = fbm(st + r);
                    vec3 color = mix(vec3(0.035, 0.0, 0.115), uColor, f * f * 1.5);
                    
                    // Fade edges to hide plane boundaries
                    float edgeFade = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x) * 
                                     smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
                    
                    float cloudAlpha = smoothstep(0.4, 0.7, f) * 0.25 * edgeFade;
                    gl_FragColor = vec4(color, cloudAlpha);
                }`,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
        });
        const cloud = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
        cloud.position.set(THREE.MathUtils.randFloatSpread(800), THREE.MathUtils.randFloatSpread(800), THREE.MathUtils.randFloat(-200, -1400));
        cloud.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.00025, (Math.random() - 0.5) * 0.00025, 0); // Nearly static movement
        cloud.rotation.z = Math.random() * Math.PI * 2; // Random rotation
        scene.add(cloud);
        nebulaClouds.push(cloud);
    }
}

function createTrail() {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(config.trail.maxParticles * 3);
    const alphas = new Float32Array(config.trail.maxParticles);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1));
    
    const material = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(0xaec6ff) } },
        vertexShader: `
            attribute float alpha; varying float vAlpha;
            void main() {
                vAlpha = alpha; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = (1.0 - alpha) * 4.0;
                gl_Position = projectionMatrix * mvPosition;
            }`,
        fragmentShader: `
            uniform vec3 uColor; varying float vAlpha;
            void main() {
                float d = distance(gl_PointCoord, vec2(0.5, 0.5));
                if (d > 0.5) discard;
                gl_FragColor = vec4(uColor, vAlpha * (1.0 - d * 2.0));
            }`,
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    
    trailParticles = new THREE.Points(geometry, material);
    trailParticles.userData.pool = [];
    for (let i = 0; i < config.trail.maxParticles; i++) {
        trailParticles.userData.pool.push({
            position: new THREE.Vector3(), velocity: new THREE.Vector3(),
            alpha: 0, life: 0,
        });
    }
    scene.add(trailParticles);
}

function updateTrail() {
    const positions = trailParticles.geometry.attributes.position.array;
    const alphas = trailParticles.geometry.attributes.alpha.array;
    const pool = trailParticles.userData.pool;
    let visibleCount = 0;

    if (currentSpaceObjectElement && spaceObjectContainer.classList.contains('animate')) {
        for (let i = 0; i < config.trail.emitRate; i++) {
            const particle = pool.find(p => p.life <= 0);
            if (particle) {
                const rect = currentSpaceObjectElement.getBoundingClientRect();
                const worldPos = screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
                
                particle.position.copy(worldPos);
                particle.velocity.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
                particle.life = Math.random() * 1.5 + 0.5;
                particle.alpha = 1.0;
            }
        }
    }

    pool.forEach(particle => {
        if (particle.life > 0) {
            particle.life -= 0.016;
            particle.alpha -= 0.018; // Faster fade
            particle.position.add(particle.velocity.clone().multiplyScalar(0.016));

            const i3 = visibleCount * 3;
            positions[i3] = particle.position.x;
            positions[i3 + 1] = particle.position.y;
            positions[i3 + 2] = particle.position.z;
            alphas[visibleCount] = particle.alpha;
            
            visibleCount++;
        }
    });

    trailParticles.geometry.setDrawRange(0, visibleCount);
    trailParticles.geometry.attributes.position.needsUpdate = true;
    trailParticles.geometry.attributes.alpha.needsUpdate = true;
}




function screenToWorld(x, y) {
    const vec = new THREE.Vector3( (x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1, 0.5);
    vec.unproject(camera);
    vec.sub(camera.position).normalize();
    const distance = -camera.position.z / vec.z;
    return camera.position.clone().add(vec.multiplyScalar(distance));
}

function onWindowResize() {
    windowHalf.set(window.innerWidth / 2, window.innerHeight / 2);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    nebulaClouds.forEach(cloud => { cloud.material.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight); });
}

function onMouseMove(event) {
    if (event.pointerType === 'mouse') {
        mouse.x = (event.clientX - windowHalf.x);
        mouse.y = (event.clientY - windowHalf.y);
        
        // Reset mouse activity tracking
        isMouseActive = true;
        if (mouseInactivityTimer) {
            clearTimeout(mouseInactivityTimer);
        }
        mouseInactivityTimer = setTimeout(() => {
            isMouseActive = false;
        }, MOUSE_INACTIVITY_DELAY);
    }
}

function onMouseLeave() {
    isMouseActive = false;
    if (mouseInactivityTimer) {
        clearTimeout(mouseInactivityTimer);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    const elapsedTime = clock.getElapsedTime();

    const { magnitude, speed, a, b, delta: lissajousDelta } = config.lissajous;
    const lissajousX = magnitude * Math.sin(a * elapsedTime * speed + lissajousDelta);
    const lissajousY = magnitude * Math.sin(b * elapsedTime * speed);

    starLayers.forEach(layer => {
        layer.material.uniforms.uTime.value = elapsedTime;
        layer.position.x = -mouse.x * layer.userData.parallaxFactor + lissajousX * layer.userData.parallaxFactor;
        layer.position.y = mouse.y * layer.userData.parallaxFactor + lissajousY * layer.userData.parallaxFactor;
    });

    // Logo recentering logic
    if (isMouseActive) {
        // Set target position based on mouse position
        targetLogoOffsetX = -mouse.x * config.logoMovementRatio;
        targetLogoOffsetY = -mouse.y * config.logoMovementRatio;
        
        // Smoothly interpolate toward target position
        const followSpeed = 0.02;
        currentLogoOffsetX = THREE.MathUtils.lerp(currentLogoOffsetX, targetLogoOffsetX, followSpeed);
        currentLogoOffsetY = THREE.MathUtils.lerp(currentLogoOffsetY, targetLogoOffsetY, followSpeed);
    } else {
        // Smoothly return to center when mouse is inactive
        const centeringSpeed = 0.02;
        currentLogoOffsetX = THREE.MathUtils.lerp(currentLogoOffsetX, 0, centeringSpeed);
        currentLogoOffsetY = THREE.MathUtils.lerp(currentLogoOffsetY, 0, centeringSpeed);
    }
    
    logoContainer.style.transform = `translate(calc(-50% + ${currentLogoOffsetX}px), calc(-50% + ${currentLogoOffsetY}px))`;

    nebulaClouds.forEach(cloud => {
        cloud.material.uniforms.uTime.value = elapsedTime;
        cloud.position.add(cloud.userData.velocity.clone().multiplyScalar(delta));
        if (cloud.position.x > 1500) cloud.position.x = -1500;
        if (cloud.position.x < -1500) cloud.position.x = 1500;
        if (cloud.position.y > 1500) cloud.position.y = -1500;
        if (cloud.position.y < -1500) cloud.position.y = 1500;
    });


    updateTrail();
    renderer.render(scene, camera);
}

function selectSpaceObject() {
    const selected = config.spaceObjects[Math.floor(Math.random() * config.spaceObjects.length)];
    const element = document.getElementById(selected.id);
    document.querySelectorAll('.space-object').forEach(el => el.style.display = 'none');
    if (element) {
        element.style.display = 'block';
        currentSpaceObjectElement = element;
    }
    return { ...selected, element };
}

function getOffscreenPositions(buffer) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const startPos = { x: 0, y: 0 }; const endPos = { x: 0, y: 0 };
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
        case 0: startPos.x = Math.random() * vw; startPos.y = -buffer; endPos.x = Math.random() * vw; endPos.y = vh + buffer; break;
        case 1: startPos.x = vw + buffer; startPos.y = Math.random() * vh; endPos.x = -buffer; endPos.y = Math.random() * vh; break;
        case 2: startPos.x = Math.random() * vw; startPos.y = vh + buffer; endPos.x = Math.random() * vw; endPos.y = -buffer; break;
        case 3: startPos.x = -buffer; startPos.y = Math.random() * vh; endPos.x = vw + buffer; endPos.y = Math.random() * vh; break;
    }
    return { startPos, endPos };
}

function getObjectRotation(id, startPos, endPos, element) {
    if (id === 'rocket') {
        const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x) * (180 / Math.PI) + 90;
        return { startRotation: angle, endRotation: angle };
    }
    if (element) { element.style.transform = ''; }
    const startRotation = Math.random() * 360;
    const endRotation = startRotation + (Math.random() > 0.5 ? 1 : -1) * 360;
    return { startRotation, endRotation };
}

function launchSpaceObject() {
    const container = spaceObjectContainer;
    const spaceObject = selectSpaceObject();
    if (!spaceObject.element || !container) return;

    container.classList.remove('animate', 'rocket');
    void container.offsetWidth;

    const size = spaceObject.element.offsetWidth || 38;
    const buffer = size * 2;

    const { startPos, endPos } = getOffscreenPositions(buffer);
    const duration = Math.random() * 8 + 8;
    const { startRotation, endRotation } = getObjectRotation(spaceObject.id, startPos, endPos, spaceObject.element);

    if (spaceObject.id === 'rocket') { container.classList.add('rocket'); }

    container.style.setProperty('--start-x', `${startPos.x}px`);
    container.style.setProperty('--start-y', `${startPos.y}px`);
    container.style.setProperty('--end-x', `${endPos.x}px`);
    container.style.setProperty('--end-y', `${endPos.y}px`);
    container.style.setProperty('--duration', `${duration}s`);
    container.style.setProperty('--start-rotate', `${startRotation}deg`);
    container.style.setProperty('--end-rotate', `${endRotation}deg`);

    container.classList.add('animate');
    
    const onDone = () => {
        if (container) {
            container.classList.remove('animate');
            currentSpaceObjectElement = null;
            setTimeout(launchSpaceObject, Math.random() * 3000 + 2000);
        }
    };
    
    if (container.animationTimeout) clearTimeout(container.animationTimeout);
    container.animationTimeout = setTimeout(onDone, duration * 1000);
}

init();

