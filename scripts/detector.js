/**
 * Capability Detection and Version Selection for jpd.industries
 * Determines whether to use WebGL or base version based on WebGL support and performance
 */

class VersionDetector {
    constructor() {
        this.webglSupported = false;
        this.performanceTestPassed = false;
        this.isMobile = false;
        this.goodGPU = false;
        this.selectedVersion = 'base'; // default fallback
        this.testResults = {};
        this.gpuRenderer = '';
        this.performanceMeterVisible = false;
    }

    /**
     * Check if the device is mobile
     */
    isMobileDevice() {
        // Check user agent for mobile keywords
        const userAgent = navigator.userAgent.toLowerCase();
        const mobileKeywords = ['mobile', 'android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];

        // Check for touch capability
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        // Check screen size (typical mobile breakpoint)
        const isSmallScreen = window.innerWidth <= 768;

        // Check for mobile-specific navigator properties
        const isMobileNavigator = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        return mobileKeywords.some(keyword => userAgent.includes(keyword)) || hasTouch || isSmallScreen || isMobileNavigator;
    }

    /**
     * Check if the GPU is considered "good" (discrete GPU, not integrated)
     */
    checkGPUQuality() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

            if (!gl) return false;

            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (!ext) return false;

            const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase();
            this.gpuRenderer = renderer; // Store renderer info for display

            // Exclude integrated graphics (Intel HD/UHD, AMD Vega, etc.)
            const integratedPatterns = [
                /intel.*hd/i,
                /intel.*uhd/i,
                /intel.*integrated/i,
                /amd.*vega/i,
                /radeon.*vega/i,
                /microsoft.*basic/i,
                /vmware/i,
                /virtualbox/i,
                /qemu/i
            ];

            // Check if renderer matches integrated graphics
            const isIntegrated = integratedPatterns.some(pattern => pattern.test(renderer));

            // Consider discrete GPUs as good (NVIDIA GeForce, AMD Radeon, etc.)
            const isDiscrete = /nvidia|geforce|radeon|amd|ati/i.test(renderer) && !isIntegrated;

            console.log('GPU Renderer:', renderer, 'Is Discrete:', isDiscrete);

            return isDiscrete;
        } catch (e) {
            console.warn('GPU quality check failed:', e);
            return false;
        }
    }

    /**
     * Main detection flow
     */
    async detectCapabilities() {
        console.log('Starting capability detection...');

        // Step 1: Check WebGL support
        this.webglSupported = this.checkWebGLSupport();
        this.testResults.webgl = this.webglSupported;

        if (!this.webglSupported) {
            console.log('WebGL not supported, using base version');
            this.selectedVersion = 'base';
            return this.selectedVersion;
        }

        // Step 2: Check GPU quality and show info
        this.goodGPU = this.checkGPUQuality();
        this.showGPUInfo();
        
        // Step 3: Run performance test
        console.log('Running performance test...');
        this.showPerformanceMeter();
        this.performanceTestPassed = await this.runPerformanceTest();
        this.hidePerformanceMeter();
        this.testResults.performance = this.performanceTestPassed;

        if (this.performanceTestPassed) {
            console.log('Performance test passed, using WebGL version');
            this.selectedVersion = 'webgl';
        } else {
            console.log('Performance test failed, using base version');
            this.selectedVersion = 'base';
        }

        return this.selectedVersion;
    }

    /**
     * Check if WebGL is supported
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) return false;

            // Additional checks for WebGL functionality
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            if (ext) {
                const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
                console.log('WebGL Renderer:', renderer);
            }

            return true;
        } catch (e) {
            console.warn('WebGL support check failed:', e);
            return false;
        }
    }

    /**
     * Run a quick WebGL performance test
     */
    async runPerformanceTest() {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                const gl = canvas.getContext('webgl', { antialias: true, alpha: true });

                if (!gl) {
                    resolve(false);
                    return;
                }

                // Raw WebGL shaders adapted from Three.js version
                const vertexShaderSource = `
                    attribute vec3 position;
                    attribute vec3 color;
                    attribute float size;
                    attribute float random;
                    varying vec3 vColor;
                    varying float vRandom;
                    
                    void main() {
                        vColor = color;
                        vRandom = random;
                        gl_Position = vec4(position, 1.0);
                        gl_PointSize = size;
                    }`;

                const fragmentShaderSource = `
                    precision mediump float;
                    uniform float uTime;
                    varying vec3 vColor;
                    varying float vRandom;
                    
                    void main() {
                        float d = distance(gl_PointCoord, vec2(0.5, 0.5));
                        if (d > 0.5) discard;
                        
                        // Improved gentle twinkling with multiple frequencies (exact from real site)
                        float twinkle1 = sin(uTime * 1.5 * vRandom + vRandom * 6.28);
                        float twinkle2 = sin(uTime * 0.8 * vRandom + vRandom * 3.14);
                        float twinkle = 0.8 + 0.15 * twinkle1 + 0.05 * twinkle2;
                        
                        float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * twinkle;
                        
                        gl_FragColor = vec4(vColor, alpha);
                    }`;

                const vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, vertexShaderSource);
                gl.compileShader(vertexShader);

                if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                    console.error('Vertex shader error:', gl.getShaderInfoLog(vertexShader));
                    resolve(false);
                    return;
                }

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, fragmentShaderSource);
                gl.compileShader(fragmentShader);

                if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                    console.error('Fragment shader error:', gl.getShaderInfoLog(fragmentShader));
                    resolve(false);
                    return;
                }

                const program = gl.createProgram();
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);

                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    console.error('Program link error:', gl.getProgramInfoLog(program));
                    resolve(false);
                    return;
                }

                gl.useProgram(program);

                // Create exact particle count from real site: 30K + 50K + 20K = 100K
                const starLayers = [
                    { count: 30000, size: 2, depthMin: 200, depthMax: 500, parallax: 0.05 },   // Distant layer
                    { count: 50000, size: 3, depthMin: 400, depthMax: 700, parallax: 0.1 },     // Middle layer
                    { count: 20000, size: 4, depthMin: 600, depthMax: 900, parallax: 0.2 }      // Near layer
                ];

                const totalParticles = starLayers.reduce((sum, layer) => sum + layer.count, 0);
                const positions = new Float32Array(totalParticles * 3);
                const colors = new Float32Array(totalParticles * 3);
                const sizes = new Float32Array(totalParticles);
                const randoms = new Float32Array(totalParticles);

                let particleIndex = 0;
                
                starLayers.forEach(layer => {
                    for (let i = 0; i < layer.count; i++) {
                        const i3 = particleIndex * 3;
                        
                        // Position with depth (adapted for raw WebGL coordinates)
                        positions[i3] = (Math.random() - 0.5) * 4.0;      // X: -2 to 2
                        positions[i3 + 1] = (Math.random() - 0.5) * 4.0;  // Y: -2 to 2
                        positions[i3 + 2] = (Math.random() * (layer.depthMax - layer.depthMin) + layer.depthMin) / 1000.0 - 1.0;

                        // Color distribution exactly like real site
                        const rand = Math.random();
                        if (rand < 0.7) {
                            // Blue stars (0xAEC6FF)
                            colors[i3] = 0.68; colors[i3 + 1] = 0.78; colors[i3 + 2] = 1.0;
                        } else if (rand < 0.9) {
                            // Yellow stars (0xFFF4A3)
                            colors[i3] = 1.0; colors[i3 + 1] = 0.96; colors[i3 + 2] = 0.64;
                        } else {
                            // Red stars (0xFFA5A5)
                            colors[i3] = 1.0; colors[i3 + 1] = 0.65; colors[i3 + 2] = 0.65;
                        }

                        // Size calculation exactly like real site
                        sizes[particleIndex] = (Math.random() * 0.05 + 0.35) * layer.size;
                        randoms[particleIndex] = Math.random();
                        particleIndex++;
                    }
                });

                // Create and bind buffers
                const positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

                const colorBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, colors, gl.STATIC_DRAW);

                const sizeBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

                const randomBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, randomBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, randoms, gl.STATIC_DRAW);

                // Set up attributes with error checking
                const positionLocation = gl.getAttribLocation(program, 'position');
                if (positionLocation !== -1) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                    gl.enableVertexAttribArray(positionLocation);
                    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);
                }

                const colorLocation = gl.getAttribLocation(program, 'color');
                if (colorLocation !== -1) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
                    gl.enableVertexAttribArray(colorLocation);
                    gl.vertexAttribPointer(colorLocation, 3, gl.FLOAT, false, 0, 0);
                }

                const sizeLocation = gl.getAttribLocation(program, 'size');
                if (sizeLocation !== -1) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
                    gl.enableVertexAttribArray(sizeLocation);
                    gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);
                }

                const randomLocation = gl.getAttribLocation(program, 'random');
                if (randomLocation !== -1) {
                    gl.bindBuffer(gl.ARRAY_BUFFER, randomBuffer);
                    gl.enableVertexAttribArray(randomLocation);
                    gl.vertexAttribPointer(randomLocation, 1, gl.FLOAT, false, 0, 0);
                }

                gl.clearColor(0.035, 0.0, 0.115, 1.0); // Real site background color
                gl.clear(gl.COLOR_BUFFER_BIT);

                // Enable additive blending exactly like real site
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
                gl.disable(gl.DEPTH_TEST); // Disable depth test for particle rendering

                // Mouse interaction setup
                const mouse = { x: 0, y: 0 };

                // Mouse move handler
                const handleMouseMove = (event) => {
                    mouse.x = (event.clientX - window.innerWidth / 2) / window.innerWidth;
                    mouse.y = -(event.clientY - window.innerHeight / 2) / window.innerHeight;
                };
                document.addEventListener('mousemove', handleMouseMove);

                // Run performance test
                let frameCount = 0;
                const startTime = performance.now();
                const testDuration = 4000; // 4 seconds for accurate measurement
                let lastUpdateTime = startTime;

                const animate = () => {
                    const currentTime = performance.now();
                    const elapsed = currentTime - startTime;

                    if (elapsed < testDuration) {
                        // Update time uniform
                        gl.uniform1f(gl.getUniformLocation(program, 'uTime'), elapsed * 0.001);

                        gl.clear(gl.COLOR_BUFFER_BIT);
                        gl.drawArrays(gl.POINTS, 0, totalParticles);

                        frameCount++;

                        // Update meter every 100ms
                        if (currentTime - lastUpdateTime >= 100) {
                            const currentFps = frameCount / (elapsed / 1000);
                            const progress = elapsed / testDuration;
                            this.updatePerformanceMeter(currentFps, progress);
                            lastUpdateTime = currentTime;
                        }

                        requestAnimationFrame(animate);
                    } else {
                        // Cleanup mouse listener
                        document.removeEventListener('mousemove', handleMouseMove);

                        // Final results
                        const fps = frameCount / (elapsed / 1000);
                        this.updatePerformanceMeter(fps, 1.0);
                        console.log(`Performance test: ${fps.toFixed(1)} FPS with ${totalParticles} particles (exact real site load)`);

                        // Realistic FPS requirement for 100K particles
                        const passed = fps > 100; // Threshold: benchmark score must exceed 100
                        resolve(passed);
                    }
                };

                requestAnimationFrame(animate);

            } catch (e) {
                console.warn('Performance test failed:', e);
                resolve(false);
            }
        });
    }

    /**
     * Load the selected version
     */
    async loadVersion(version) {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = loadingScreen.querySelector('.loading-text');

        try {
            // Fade out current content first
            document.body.classList.add('content-fade-out');
            await new Promise(resolve => setTimeout(resolve, 300));

            if (version === 'webgl') {
                loadingText.textContent = 'Loading WebGL version...';
                await this.loadWebGLVersion();
            } else {
                loadingText.textContent = 'Loading base version...';
                await this.loadBaseVersion();
            }

            // Fade in new content
            document.body.classList.remove('content-fade-out');
            document.body.classList.add('content-fade-in');
            
            // Wait for content to fade in
            await new Promise(resolve => setTimeout(resolve, 100));

            // Fade out loading screen
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                // Remove content fade-in class after loading screen is hidden
                document.body.classList.remove('content-fade-in');
            }, 500);

        } catch (error) {
            console.error('Failed to load version:', error);
            // Fallback to base version on error
            if (version === 'webgl') {
                console.log('Falling back to base version due to load error');
                await this.loadBaseVersion();
                document.body.classList.remove('content-fade-out');
                document.body.classList.add('content-fade-in');
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    document.body.classList.remove('content-fade-in');
                }, 500);
            }
        }
    }

    /**
     * Load WebGL version assets
     */
    async loadWebGLVersion() {
        // Load Three.js
        await this.loadScript('https://unpkg.com/three@0.164.1/build/three.module.js', 'three');

        // Load WebGL styles (non-blocking)
        this.loadStylesheet('webgl/styles/main.css');
        this.loadStylesheet('webgl/styles/animations.css');

        // Update HTML content for WebGL
        this.updateHTMLForWebGL();
    }

    /**
     * Load base version assets
     */
    async loadBaseVersion() {
        // Load base styles
        await this.loadStylesheet('base/styles/main.css');
        await this.loadStylesheet('base/styles/animations.css');

        // Load base script
        await this.loadScript('base/scripts/main.js');

        // Update HTML content for base
        this.updateHTMLForBase();
    }

    /**
     * Utility method to load scripts
     */
    loadScript(src, id) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            if (id) script.id = id;
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Utility method to load stylesheets
     */
    loadStylesheet(href) {
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = reject;
            document.head.appendChild(link);
        });
    }

    /**
     * Update HTML for WebGL version
     */
    updateHTMLForWebGL() {
        const body = document.body;

        // Add import map for Three.js
        const importMap = document.createElement('script');
        importMap.type = 'importmap';
        importMap.textContent = JSON.stringify({
            imports: {
                "three": "https://unpkg.com/three@0.164.1/build/three.module.js",
                "three/addons/": "https://unpkg.com/three@0.164.1/examples/jsm/"
            }
        });
        document.head.appendChild(importMap);

        // Update body content
        body.innerHTML = `
            <div id="logo-container">
                <img src="webgl/assets/jpdlogo.png" alt="JPD Logo" id="logo">
            </div>

            <div id="space-object-container">
                <img src="webgl/assets/jpdaustronaut.png" alt="Floating Astronaut" id="astronaut" class="space-object">
                <img src="webgl/assets/meteorite.png" alt="Floating Meteorite" id="meteorite" class="space-object">
                <img src="webgl/assets/rocket.png" alt="Flying Rocket" id="rocket" class="space-object">
                <img src="webgl/assets/satellite.png" alt="Floating Satellite" id="satellite" class="space-object">
            </div>
        `;

        // Load WebGL script as module
        const script = document.createElement('script');
        script.type = 'module';
        script.src = 'webgl/scripts/scene.js';
        document.body.appendChild(script);
    }

    /**
     * Update HTML for base version
     */
    updateHTMLForBase() {
        const body = document.body;

        // Update body content
        body.innerHTML = `
            <canvas id="nebula-canvas"></canvas>
            <canvas id="stars-canvas"></canvas>
            <div id="logo-container">
                <img src="base/assets/jpdlogo.png" alt="JPD Logo" id="logo">
            </div>

            <div id="space-object-container">
                <img src="base/assets/jpdaustronaut.png" alt="Floating Astronaut" id="astronaut" class="space-object">
                <img src="base/assets/meteorite.png" alt="Floating Meteorite" id="meteorite" class="space-object">
                <img src="base/assets/rocket.png" alt="Flying Rocket" id="rocket" class="space-object">
                <img src="base/assets/satellite.png" alt="Floating Satellite" id="satellite" class="space-object">
            </div>
        `;

        // Load base script
        const script = document.createElement('script');
        script.src = 'base/scripts/main.js';
        document.body.appendChild(script);
    }

    /**
     * Show GPU information on loading screen with fade transition
     */
    async showGPUInfo() {
        const gpuInfoElement = document.getElementById('gpu-info');
        if (gpuInfoElement && this.gpuRenderer) {
            gpuInfoElement.textContent = `GPU: ${this.gpuRenderer}`;
            // Add fade-in transition
            gpuInfoElement.style.transition = 'opacity 0.3s ease-out';
            gpuInfoElement.style.opacity = '0';
            gpuInfoElement.style.display = 'block';
            
            // Wait for transition to complete
            await new Promise(resolve => setTimeout(resolve, 50));
            gpuInfoElement.style.opacity = '1';
        }
    }

    /**
     * Show performance meter on loading screen with fade transition
     */
    async showPerformanceMeter() {
        const meterElement = document.getElementById('performance-meter');
        if (meterElement) {
            // Add fade-in transition
            meterElement.style.transition = 'opacity 0.3s ease-out';
            meterElement.style.opacity = '0';
            meterElement.style.display = 'block';
            
            // Wait for transition to complete
            await new Promise(resolve => setTimeout(resolve, 50));
            meterElement.style.opacity = '1';
            this.performanceMeterVisible = true;
        }
    }

    /**
     * Hide performance meter with fade transition
     */
    async hidePerformanceMeter() {
        const meterElement = document.getElementById('performance-meter');
        if (meterElement) {
            // Add fade-out transition
            meterElement.style.transition = 'opacity 0.3s ease-out';
            meterElement.style.opacity = '0';
            
            // Wait for transition to complete before hiding
            await new Promise(resolve => setTimeout(resolve, 300));
            meterElement.style.display = 'none';
            this.performanceMeterVisible = false;
        }
    }

    /**
     * Update performance meter with current FPS and progress
     */
    updatePerformanceMeter(fps, progress) {
        if (!this.performanceMeterVisible) return;

        const fpsElement = document.getElementById('fps-value');
        const progressFill = document.getElementById('progress-fill');
        const gaugeFill = document.getElementById('fps-gauge-fill');

        if (fpsElement) {
            fpsElement.textContent = fps.toFixed(1);
        }

        if (progressFill) {
            progressFill.style.width = `${progress * 100}%`;
        }

        // Update circular gauge (0-300 FPS range)
        if (gaugeFill) {
            const maxFps = 244;
            const normalizedFps = Math.min(fps, maxFps);
            const percentage = normalizedFps / maxFps;
            const circumference = 2 * Math.PI * 50; // radius = 50
            const offset = circumference - (percentage * circumference);
            gaugeFill.style.strokeDashoffset = offset;
        }
    }

    /**
     * Get test results for debugging
     */
    getResults() {
        return {
            selectedVersion: this.selectedVersion,
            webglSupported: this.webglSupported,
            performanceTestPassed: this.performanceTestPassed,
            testResults: this.testResults,
            gpuRenderer: this.gpuRenderer
        };
    }
}

// Initialize detection when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    const detector = new VersionDetector();
    const version = await detector.detectCapabilities();
    await detector.loadVersion(version);

    // Make results available globally for debugging
    window.versionDetector = detector;
});