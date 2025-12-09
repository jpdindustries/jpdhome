/**
 * Capability Detection and Version Selection for jpd.industries
 * Determines whether to use WebGL or base version based on WebGL support and performance
 */

class VersionDetector {
    constructor() {
        this.webglSupported = false;
        this.performanceTestPassed = false;
        this.selectedVersion = 'base'; // default fallback
        this.testResults = {};
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

        // Step 2: Run performance test
        console.log('WebGL supported, running performance test...');
        this.performanceTestPassed = await this.runPerformanceTest();
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
                canvas.width = 400;
                canvas.height = 300;
                const gl = canvas.getContext('webgl');

                if (!gl) {
                    resolve(false);
                    return;
                }

                // Create a simple test scene with many particles
                const vertexShaderSource = `
                    attribute vec2 position;
                    void main() {
                        gl_Position = vec4(position, 0.0, 1.0);
                        gl_PointSize = 2.0;
                    }
                `;

                const fragmentShaderSource = `
                    void main() {
                        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
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

                // Create test particles (reduced for faster detection)
                const numParticles = 5000;
                const positions = new Float32Array(numParticles * 2);

                for (let i = 0; i < numParticles; i++) {
                    positions[i * 2] = (Math.random() - 0.5) * 2;
                    positions[i * 2 + 1] = (Math.random() - 0.5) * 2;
                }

                const buffer = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
                gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

                const positionLocation = gl.getAttribLocation(program, 'position');
                gl.enableVertexAttribArray(positionLocation);
                gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT);

                // Run performance test for 1 second
                let frameCount = 0;
                const startTime = performance.now();
                const testDuration = 1000; // 1 second

                const animate = () => {
                    const currentTime = performance.now();
                    const elapsed = currentTime - startTime;

                    if (elapsed < testDuration) {
                        // Rotate particles slightly for animation
                        const angle = elapsed * 0.001;
                        gl.uniform1f(gl.getUniformLocation(program, 'time'), angle);

                        gl.clear(gl.COLOR_BUFFER_BIT);
                        gl.drawArrays(gl.POINTS, 0, numParticles);

                        frameCount++;
                        requestAnimationFrame(animate);
                    } else {
                        // Calculate FPS
                        const fps = frameCount / (elapsed / 1000);
                        console.log(`Performance test: ${fps.toFixed(1)} FPS`);

                        // Require at least 30 FPS for WebGL version
                        const passed = fps >= 30;
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
            if (version === 'webgl') {
                loadingText.textContent = 'Loading WebGL version...';
                await this.loadWebGLVersion();
            } else {
                loadingText.textContent = 'Loading base version...';
                await this.loadBaseVersion();
            }

            // Fade out loading screen
            loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);

        } catch (error) {
            console.error('Failed to load version:', error);
            // Fallback to base version on error
            if (version === 'webgl') {
                console.log('Falling back to base version due to load error');
                await this.loadBaseVersion();
                loadingScreen.classList.add('fade-out');
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
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

        // Load WebGL styles
        await this.loadStylesheet('webgl/styles/main.css');
        await this.loadStylesheet('webgl/styles/animations.css');

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
     * Get test results for debugging
     */
    getResults() {
        return {
            selectedVersion: this.selectedVersion,
            webglSupported: this.webglSupported,
            performanceTestPassed: this.performanceTestPassed,
            testResults: this.testResults
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