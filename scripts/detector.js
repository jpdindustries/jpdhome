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

                // Create complex test scene similar to real site with FBM noise shaders
                const vertexShaderSource = `
                    attribute vec2 position;
                    attribute float size;
                    attribute float random;
                    varying float vRandom;
                    
                    void main() {
                        vRandom = random;
                        gl_Position = vec4(position, 0.0, 1.0);
                        gl_PointSize = size;
                    }
                `;

                const fragmentShaderSource = `
                    uniform float uTime;
                    varying float vRandom;
                    
                    // FBM noise functions similar to real site nebula
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
                        float amplitude = 0.5;
                        for (int i = 0; i < 6; i++) {
                            value += amplitude * noise(st);
                            st *= 2.0;
                            amplitude *= 0.5;
                        }
                        return value;
                    }
                    
                    void main() {
                        vec2 st = gl_PointCoord;
                        float d = distance(st, vec2(0.5));
                        if (d > 0.5) discard;
                        
                        // Complex noise-based particle with twinkling
                        float noise1 = fbm(st * 3.0 + uTime * 0.5 + vRandom * 6.28);
                        float noise2 = fbm(st * 6.0 + uTime * 0.8 + vRandom * 3.14);
                        float combined = noise1 * 0.7 + noise2 * 0.3;
                        
                        // Twinkling effect with multiple frequencies
                        float twinkle1 = sin(uTime * 1.5 * vRandom + vRandom * 6.28);
                        float twinkle2 = sin(uTime * 0.8 * vRandom + vRandom * 3.14);
                        float twinkle = 0.8 + 0.15 * twinkle1 + 0.05 * twinkle2;
                        
                        float alpha = (1.0 - smoothstep(0.3, 0.5, d)) * combined * twinkle;
                        vec3 color = mix(vec3(0.68, 0.78, 1.0), vec3(1.0, 0.96, 0.64), combined);
                        
                        gl_FragColor = vec4(color, alpha);
                    }
                `;

                const vertexShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vertexShader, vertexShaderSource);
                gl.compileShader(vertexShader);

                const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fragmentShader, fragmentShaderSource);
                gl.compileShader(fragmentShader);

                const program = gl.createProgram();
                gl.attachShader(program, vertexShader);
                gl.attachShader(program, fragmentShader);
                gl.linkProgram(program);
                gl.useProgram(program);

                // Create test particles - significantly increased to match real site complexity
                const numParticles = 25000; // 5x increase from 5K to 25K
                const positions = new Float32Array(numParticles * 2);
                const sizes = new Float32Array(numParticles);
                const randoms = new Float32Array(numParticles);

                for (let i = 0; i < numParticles; i++) {
                    positions[i * 2] = (Math.random() - 0.5) * 2;
                    positions[i * 2 + 1] = (Math.random() - 0.5) * 2;
                    sizes[i] = Math.random() * 2.0 + 1.0; // Variable particle sizes
                    randoms[i] = Math.random();
                }

                // Create buffers
                const positionBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

                const sizeBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

                const randomBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, randomBuffer);
                gl.bufferData(gl.ARRAY_BUFFER, randoms, gl.STATIC_DRAW);

                // Set up attributes
                const positionLocation = gl.getAttribLocation(program, 'position');
                gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
                gl.enableVertexAttribArray(positionLocation);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

                const sizeLocation = gl.getAttribLocation(program, 'size');
                gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuffer);
                gl.enableVertexAttribArray(sizeLocation);
                gl.vertexAttribPointer(sizeLocation, 1, gl.FLOAT, false, 0, 0);

                const randomLocation = gl.getAttribLocation(program, 'random');
                gl.bindBuffer(gl.ARRAY_BUFFER, randomBuffer);
                gl.enableVertexAttribArray(randomLocation);
                gl.vertexAttribPointer(randomLocation, 1, gl.FLOAT, false, 0, 0);

                gl.clearColor(0.06, 0.06, 0.11, 1.0); // Dark space-like background
                gl.clear(gl.COLOR_BUFFER_BIT);

                // Enable additive blending for more realistic rendering
                gl.enable(gl.BLEND);
                gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

                // Run performance test for longer duration
                let frameCount = 0;
                const startTime = performance.now();
                const testDuration = 3000; // 3 seconds for more stable measurement
                let lastUpdateTime = startTime;

                const animate = () => {
                    const currentTime = performance.now();
                    const elapsed = currentTime - startTime;

                    if (elapsed < testDuration) {
                        // Update time uniform for shader animation
                        const time = elapsed * 0.001;
                        gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time);

                        gl.clear(gl.COLOR_BUFFER_BIT);
                        gl.drawArrays(gl.POINTS, 0, numParticles);

                        frameCount++;

                        // Update meter every 100ms for smooth display
                        if (currentTime - lastUpdateTime >= 100) {
                            const currentFps = frameCount / (elapsed / 1000);
                            const progress = elapsed / testDuration;
                            this.updatePerformanceMeter(currentFps, progress);
                            lastUpdateTime = currentTime;
                        }

                        requestAnimationFrame(animate);
                    } else {
                        // Final update with complete results
                        const fps = frameCount / (elapsed / 1000);
                        this.updatePerformanceMeter(fps, 1.0);
                        console.log(`Performance test: ${fps.toFixed(1)} FPS with ${numParticles} complex particles`);

                        // Adjusted FPS requirement - lower threshold for more demanding test
                        const passed = fps >= 20; // Reduced from 30 to 20 FPS due to increased complexity
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