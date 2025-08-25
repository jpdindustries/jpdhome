document.addEventListener('DOMContentLoaded', () => {
    const nebulaCanvas = document.getElementById('nebula-canvas');
    const nebulaCtx = nebulaCanvas.getContext('2d');
    const starsCanvas = document.getElementById('stars-canvas');
    const starsCtx = starsCanvas.getContext('2d');
    const logoContainer = document.getElementById('logo-container');
    const spaceObjectContainer = document.getElementById('space-object-container');

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let logoMovementRatio = 0.08;
    let mouseOutsideTimer = null;
    let isMouseOutside = false;
    
    // Lissajous curve parameters for subtle automatic parallax
    let lissajousMagnitude = 1000; // Maximum movement in pixels
    let lissajousSpeed = 0.000035; // Speed of the motion
    let lissajousA = 3; // Frequency parameter for X axis
    let lissajousB = 4; // Frequency parameter for Y axis
    let lissajousDelta = Math.PI / 2; // Phase shift

    function resizeCanvases() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        nebulaCanvas.width = width;
        nebulaCanvas.height = height;
        starsCanvas.width = width;
        starsCanvas.height = height;
    }
    // Keep canvas sizing and responsive settings in sync
    window.addEventListener(
        'resize',
        debounce(() => {
            resizeCanvases();
            updateResponsiveSettings();
            recreateElements();
        }, 250)
    );
    resizeCanvases();

    let baseNumStars = 1337;
    const stars = [];
    const shootingStars = [];
    const astronautTrailParticles = []; // New array for astronaut trail particles
    const nebulaClouds = [];
    // Responsive controls (adjust for small screens / portrait)
    let starSizeScale = 1;
    let starCountScale = 1;
    let shootingFreq = 0.015;
    // keep previous values so we can detect changes and adjust existing stars
    let _prevStarSizeScale = starSizeScale;
    let _prevStarCountScale = starCountScale;
    function updateResponsiveSettings() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;
        // Mobile / narrow portrait: fewer, smaller stars but user requested 4× density (no cap)
        if (w <= 480 || (isPortrait && w < 1200)) {
            starSizeScale = 0.6;
            // increase small-screen density 4× relative to the previous small setting
            starCountScale = 0.3; // decrease small-screen density by half by a third
            shootingFreq = 0.005;
            // reduce parallax so the logo stays visually centered on phones
            logoMovementRatio = 0.02;
        } else if (w <= 1200) {
            // Small laptops / large phones: slightly reduced
            starSizeScale = 0.8;
            starCountScale = 0.4;
            shootingFreq = 0.008;
            logoMovementRatio = 0.04;
        } else {
            // Desktop / large displays: original settings
            starSizeScale = 1;
            starCountScale = 1;
            shootingFreq = 0.015;
            logoMovementRatio = 0.08;
        }
        // If the size scale changed, adjust existing star sizes proportionally
        if (starSizeScale !== _prevStarSizeScale && stars.length > 0) {
            const ratio = starSizeScale / (_prevStarSizeScale || 1);
            stars.forEach(s => { s.size = Math.max(0.2, s.size * ratio); });
            _prevStarSizeScale = starSizeScale;
        }
        // If the count scale changed, add/remove stars to match desired density
        if (starCountScale !== _prevStarCountScale) {
            adjustStarCount();
            _prevStarCountScale = starCountScale;
        }
    }

    const starColors = {
        whiteBlue: 'rgba(200, 200, 255, OPACITY)',
        yellowWhite: 'rgba(255, 255, 200, OPACITY)',
        redTinted: 'rgba(255, 180, 180, OPACITY)'
    };

    const shootingStarColors = [
        { start: 'rgba(255, 100, 100, OPACITY)', end: 'rgba(255, 0, 0, 0)' }, // Red
        { start: 'rgba(200, 220, 255, OPACITY)', end: 'rgba(200, 220, 255, 0)' }, // White/Blue
        { start: 'rgba(255, 255, 200, OPACITY)', end: 'rgba(255, 255, 0, 0)' }  // Yellow/Gold
    ];

    function getRandomColor() {
        const rand = Math.random();
        if (rand < 0.7) return starColors.whiteBlue;
        if (rand < 0.9) return starColors.yellowWhite;
        return starColors.redTinted;
    }

    function getStarMovementRatio(star) {
        const depth = star.z / starsCanvas.width;
        if (depth < 0.33) return 0.060; // Near
        if (depth < 0.66) return 0.040; // Mid
        return 0.020; // Far
    }

    function brightenRgba(rgbaStr, targetAlpha) {
        const parts = rgbaStr.match(/(\d+)/g);
        if (!parts || parts.length < 3) return `rgba(255, 255, 255, ${targetAlpha})`;
        const [r, g, b] = parts.map(Number);
        const brighten = (val) => Math.min(255, val + 70);
        return `rgba(${brighten(r)}, ${brighten(g)}, ${brighten(b)}, ${targetAlpha})`;
    }
    
    // Calculate Lissajous curve position for subtle automatic parallax
    function calculateLissajousPosition(time) {
        const x = lissajousMagnitude * Math.sin(lissajousA * time * lissajousSpeed + lissajousDelta);
        const y = lissajousMagnitude * Math.sin(lissajousB * time * lissajousSpeed);
        return { x, y };
    }

    class Star {
        constructor() {
            const buffer = 0.2; // 20% buffer on each side
            this.x = (Math.random() * (1 + 2 * buffer) - buffer) * starsCanvas.width;
            this.y = (Math.random() * (1 + 2 * buffer) - buffer) * starsCanvas.height;
            this.z = Math.random() * starsCanvas.width;
            // scale star sizes responsively (starSizeScale set by updateResponsiveSettings)
            this.size = (Math.random() * 2 + 1) * starSizeScale;
            this.baseOpacity = Math.random() * 0.5 + 0.3;
            this.opacity = this.baseOpacity;
            this.isRedGiant = Math.random() > 0.98;
            if (this.isRedGiant) {
                this.color = 'rgba(255, 100, 100, OPACITY)';
                this.size = (Math.random() * 2 + 2) * starSizeScale;
                this.pulseDirection = 1;
                this.pulseSpeed = Math.random() * 0.02;
            } else {
                this.color = getRandomColor();
            }
            this.twinkleSpeed = Math.random() * 0.05;
            this.twinkleOffset = Math.random() * Math.PI * 2;
            this.isShining = false;
            this.shineProgress = 0;
            this.shineDuration = 150;
            this.shineAngle = 0;
        }

        draw(ctx, pX, pY) {
            const parallaxX = this.x - pX * getStarMovementRatio(this);
            const parallaxY = this.y - pY * getStarMovementRatio(this);

            if (Math.random() < 0.0005 && !this.isShining) {
                this.isShining = true;
                this.shineProgress = 0;
                this.shineAngle = Math.random() * Math.PI * 2;
            }

            if (this.isShining) {
                this.shineProgress++;
                this.shineAngle += 0.005;
                const sineProgress = Math.sin((this.shineProgress / this.shineDuration) * Math.PI);
                
                const shineAlpha1 = sineProgress * 0.6; // Alpha for big cross
                const shineAlpha2 = sineProgress * 0.4; // Alpha for small cross

                const brighterColorRgba1 = brightenRgba(this.color, shineAlpha1);
                const brighterColorRgba2 = brightenRgba(this.color, shineAlpha2);

                ctx.lineWidth = 1.5;

                // Draw first, larger cross (X)
                ctx.strokeStyle = brighterColorRgba1;
                const crossLength1 = this.size * 5 * sineProgress;
                for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    const angle = (i / 4) * Math.PI * 2 + (Math.PI / 4) + this.shineAngle;
                    ctx.moveTo(parallaxX, parallaxY);
                    ctx.lineTo(parallaxX + Math.cos(angle) * crossLength1, parallaxY + Math.sin(angle) * crossLength1);
                    ctx.stroke();
                }

                // Draw second, smaller cross (+)
                ctx.strokeStyle = brighterColorRgba2;
                const crossLength2 = crossLength1 * 0.6;
                 for (let i = 0; i < 4; i++) {
                    ctx.beginPath();
                    const angle = (i / 4) * Math.PI * 2 + this.shineAngle;
                    ctx.moveTo(parallaxX, parallaxY);
                    ctx.lineTo(parallaxX + Math.cos(angle) * crossLength2, parallaxY + Math.sin(angle) * crossLength2);
                    ctx.stroke();
                }

                if (this.shineProgress >= this.shineDuration) this.isShining = false;
            }

            let currentOpacity = this.opacity;
            if (this.isRedGiant) {
                this.opacity += this.pulseSpeed * this.pulseDirection;
                if (this.opacity > 1 || this.opacity < 0.3) this.pulseDirection *= -1;
            } else {
                currentOpacity = this.baseOpacity + Math.sin(Date.now() * 0.001 * this.twinkleSpeed + this.twinkleOffset) * 0.3;
            }
            currentOpacity = Math.max(0, Math.min(1, currentOpacity));
            ctx.beginPath();
            ctx.arc(parallaxX, parallaxY, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color.replace('OPACITY', currentOpacity);
            ctx.fill();
        }
    }

    class ShootingStar {
        constructor() {
            // Start shooting stars farther off-screen for a better effect with parallax
            const startX = Math.random() * starsCanvas.width * 1.5 - (starsCanvas.width * 0.25);
            const startY = Math.random() * starsCanvas.height * 0.5;
            this.x = startX;
            this.y = startY;
            this.len = Math.random() * 120 + 30;
            this.speed = Math.random() * 8 + 7;
            this.angle = -Math.PI / 4;
            this.vx = Math.cos(this.angle) * this.speed;
            this.vy = Math.sin(this.angle) * this.speed;
            this.opacity = 1;
            const colorSet = shootingStarColors[Math.floor(Math.random() * shootingStarColors.length)];
            this.colorStart = colorSet.start;
            this.colorEnd = colorSet.end;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.opacity -= 0.01;
        }
        draw(ctx) {
            const grad = ctx.createLinearGradient(this.x, this.y, this.x - this.len * Math.cos(this.angle), this.y - this.len * Math.sin(this.angle));
            grad.addColorStop(0, this.colorStart.replace('OPACITY', this.opacity));
            grad.addColorStop(1, this.colorEnd);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.len * Math.cos(this.angle), this.y - this.len * Math.sin(this.angle));
            ctx.stroke();
        }
        isOffscreen() {
            return this.x < -this.len || this.y > starsCanvas.height + this.len || this.opacity <= 0;
        }
    }

    class AstronautTrailParticle {
        constructor(x, y, size, color) {
            this.x = x;
            this.y = y;
            this.size = size;
            this.color = color;
            this.opacity = 1;
            this.decayRate = Math.random() * 0.02 + 0.01; // Slower decay for subtlety
            this.vx = (Math.random() - 0.5) * 0.5; // Slight random movement
            this.vy = (Math.random() - 0.5) * 0.5;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.opacity -= this.decayRate;
            this.size *= 0.98; // Shrink slightly
        }

        draw(ctx) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color.replace('OPACITY', Math.max(0, this.opacity));
            ctx.fill();
        }

        isFaded() {
            return this.opacity <= 0 || this.size <= 0.5;
        }
    }

    class NebulaCloud {
        constructor() {
            this.x = Math.random() * nebulaCanvas.width;
            this.y = Math.random() * nebulaCanvas.height;
                        this.radius = Math.random() * (nebulaCanvas.width / 2) + (nebulaCanvas.width / 2);
            this.maxOpacity = Math.random() * 0.1 + 0.05;
            const r = Math.random() > 0.5 ? 255 : 100;
            const g = 0;
            const b = Math.random() > 0.5 ? 255 : 150;
            this.color = `${r}, ${g}, ${b}`;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x - this.radius > nebulaCanvas.width) this.x = -this.radius;
            if (this.x + this.radius < 0) this.x = nebulaCanvas.width + this.radius;
            if (this.y - this.radius > nebulaCanvas.height) this.y = -this.radius;
            if (this.y + this.radius < 0) this.y = nebulaCanvas.height + this.radius;
        }
        draw(ctx) {
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
            grad.addColorStop(0.1, `rgba(${this.color}, ${this.maxOpacity})`);
            grad.addColorStop(0.5, `rgba(${this.color}, ${this.maxOpacity * 0.3})`);
            grad.addColorStop(1, `rgba(${this.color}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function recreateElements() {
        nebulaClouds.length = 0;
        for (let i = 0; i < 4; i++) nebulaClouds.push(new NebulaCloud());
        adjustStarCount();
    }
    // Fire up the simulation
    recreateElements();
    // Adjust star count to match current starCountScale
    function adjustStarCount() {
        const desired = Math.round(baseNumStars * starCountScale);
        stars.length = 0; // Clear the array
        for (let i = 0; i < desired; i++) {
            stars.push(new Star());
        }
    }

    function animateNebulas() {
        nebulaCtx.clearRect(0, 0, nebulaCanvas.width, nebulaCanvas.height);
        nebulaClouds.forEach(cloud => {
            cloud.update();
            cloud.draw(nebulaCtx);
        });
    }

    function animateStars() {
        mouseX += (targetMouseX - mouseX) * 0.05;
        mouseY += (targetMouseY - mouseY) * 0.05;
        logoContainer.style.transform = `translate(calc(-50% + ${-mouseX * logoMovementRatio}px), calc(-50% + ${-mouseY * logoMovementRatio}px))`;
        
        // Calculate Lissajous position for subtle automatic parallax
        const lissajousPos = calculateLissajousPosition(Date.now());
        
        // Combine mouse parallax with Lissajous motion for stars (but not for logo)
        const combinedMouseX = mouseX + lissajousPos.x;
        const combinedMouseY = mouseY + lissajousPos.y;
        
        starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
        stars.forEach(star => star.draw(starsCtx, combinedMouseX, combinedMouseY));
        if (Math.random() < shootingFreq) shootingStars.push(new ShootingStar());
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            shootingStars[i].update();
            shootingStars[i].draw(starsCtx);
            if (shootingStars[i].isOffscreen()) shootingStars.splice(i, 1);
        }

        // Update and draw astronaut trail particles
        for (let i = astronautTrailParticles.length - 1; i >= 0; i--) {
            astronautTrailParticles[i].update();
            astronautTrailParticles[i].draw(starsCtx);
            if (astronautTrailParticles[i].isFaded()) {
                astronautTrailParticles.splice(i, 1);
            }
        }

        requestAnimationFrame(animateStars);
    }

    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') {
            targetMouseX = (e.clientX - window.innerWidth / 2);
            targetMouseY = (e.clientY - window.innerHeight / 2);
            
            // If mouse was outside and now it's inside, clear the timer
            if (isMouseOutside) {
                console.log('Mouse re-entered the window');
                isMouseOutside = false;
                if (mouseOutsideTimer) {
                    console.log('Clearing mouse-out timer');
                    clearTimeout(mouseOutsideTimer);
                    mouseOutsideTimer = null;
                }
            }
        }
    });
    
    // Add event listeners for mouse leaving and entering the window
    document.addEventListener('mouseout', (e) => {
        if (e.relatedTarget === null) {
            isMouseOutside = true;
            // Start a 3-second timer to reset the parallax effect
            mouseOutsideTimer = setTimeout(() => {
                // Reset the mouse position to center (which will center the logo)
                targetMouseX = 0;
                targetMouseY = 0;
                mouseOutsideTimer = null;
            }, 3000); // 3 seconds
        }
    });
    
    document.addEventListener('mouseover', (e) => {
        if (e.relatedTarget !== null) {
            // If mouse enters the window, clear the timer
            if (mouseOutsideTimer) {
                clearTimeout(mouseOutsideTimer);
                mouseOutsideTimer = null;
            }
            isMouseOutside = false;
        }
    });


    // initialize stars according to responsive scale (moved here after Star class is defined)
    updateResponsiveSettings();
    adjustStarCount();
    
    setInterval(animateNebulas, 100); // Low-frequency loop for background
    animateStars(); // High-frequency loop for foreground

    function launchSpaceObject() {
        const container = spaceObjectContainer;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // Randomly select a space object
        const spaceObjects = [
            { id: 'astronaut', name: 'Astronaut' },
            { id: 'meteorite', name: 'Meteorite' },
            { id: 'rocket', name: 'Rocket' },
            { id: 'satellite', name: 'Satellite' }
        ];
        const selectedObject = spaceObjects[Math.floor(Math.random() * spaceObjects.length)];
        const spaceObjectEl = document.getElementById(selectedObject.id);
        
        // Hide all space objects first
        document.querySelectorAll('.space-object').forEach(el => {
            el.style.display = 'none';
        });
        
        // Show only the selected space object
        spaceObjectEl.style.display = 'block';
        
        // Force a reflow to ensure the display property is applied before animation
        void container.offsetWidth;
        
        // Robustly compute space object size (try offsetWidth, bounding rect, then fallback)
        const spaceObjectSizeCandidate = (spaceObjectEl && spaceObjectEl.offsetWidth) ? spaceObjectEl.offsetWidth :
            (spaceObjectEl ? Math.round(spaceObjectEl.getBoundingClientRect().width) : 38);
        const spaceObjectSize = spaceObjectSizeCandidate > 0 ? spaceObjectSizeCandidate : 38;
        // Use a larger buffer to avoid clipping when rotated or scaled
        const buffer = spaceObjectSize * 4 + 50;

        // Clear any existing trail particles when a new space object launches
        astronautTrailParticles.length = 0;
        
        // Remove any previous rocket-specific class
        container.classList.remove('rocket');
 
        // 1. Define random start and end points off-screen
        const startPos = { x: 0, y: 0 };
        const endPos = { x: 0, y: 0 };
        const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
 
        switch (edge) {
            case 0: // Start top
                startPos.x = Math.random() * vw;
                startPos.y = -buffer;
                endPos.x = Math.random() * vw;
                endPos.y = vh + buffer;
                break;
            case 1: // Start right
                startPos.x = vw + buffer;
                startPos.y = Math.random() * vh;
                endPos.x = -buffer;
                endPos.y = Math.random() * vh;
                break;
            case 2: // Start bottom
                startPos.x = Math.random() * vw;
                startPos.y = vh + buffer;
                endPos.x = Math.random() * vw;
                endPos.y = -buffer;
                break;
            case 3: // Start left
                startPos.x = -buffer;
                startPos.y = Math.random() * vh;
                endPos.x = vw + buffer;
                endPos.y = Math.random() * vh;
                break;
        }
 
        // 2. Set random duration and rotation
        const duration = Math.random() * 10 + 10; // 10-20 seconds
        let startRotation, endRotation;
        
        if (selectedObject.id === 'rocket') {
            // Rocket's nose should point in the direction of travel.
            // Image points up, so we calculate the angle and add 90 degrees.
            const angle = Math.atan2(endPos.y - startPos.y, endPos.x - startPos.x) * (180 / Math.PI);
            const rotation = angle + 90;
            startRotation = rotation;
            endRotation = rotation;
            // Add rocket-specific class for squiggle animation
            container.classList.add('rocket');
        } else {
            // Other objects should rotate like the astronaut
            startRotation = Math.random() * 360;
            endRotation = startRotation + (Math.random() > 0.5 ? 1 : -1) * 360; // Rotate 360 deg clockwise or counter-clockwise
            // Reset transform for non-rocket objects
            spaceObjectEl.style.transform = '';
        }
 
        // 3. Apply CSS variables
        container.style.setProperty('--start-x', `${startPos.x}px`);
        container.style.setProperty('--start-y', `${startPos.y}px`);
        container.style.setProperty('--end-x', `${endPos.x}px`);
        container.style.setProperty('--end-y', `${endPos.y}px`);
        container.style.setProperty('--duration', `${duration}s`);
        container.style.setProperty('--start-rotate', `${startRotation}deg`);
        container.style.setProperty('--end-rotate', `${endRotation}deg`);
 
 
        // 4. Ensure visibility and GPU-accelerate transform
        container.style.visibility = 'visible';
        container.style.display = 'block';
        container.style.willChange = 'transform, opacity';
        container.style.opacity = '1';
        container.classList.add('animate');
        
        // Ensure the selected space object remains visible after animation starts
        spaceObjectEl.style.display = 'block';

        // Start emitting trail particles
        let trailInterval;
        const startEmittingTrail = () => {
            if (trailInterval) clearInterval(trailInterval);
            trailInterval = setInterval(() => {
                const rect = spaceObjectEl.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                // Emit multiple particles for a denser trail
                for (let i = 0; i < 3; i++) {
                    astronautTrailParticles.push(new AstronautTrailParticle(
                        centerX,
                        centerY,
                        Math.random() * 1.5 + 0.5, // Smaller size for subtlety
                        'rgba(200, 220, 255, OPACITY)' // Subtle white/blue
                    ));
                }
            }, 50); // Emit particles every 50ms
        };
        startEmittingTrail();
 
        // Clear any previous timer/listener to avoid double-scheduling
        if (container._astronautTimer) {
            clearTimeout(container._astronautTimer);
            container._astronautTimer = null;
        }
        if (container._astronautListener) {
            container.removeEventListener('animationend', container._astronautListener);
            container._astronautListener = null;
        }
 
        // 5. Remove animate class after the expected duration (plus small buffer) to ensure it stays visible the entire path
        const msDuration = Math.round(duration * 1000);
        const onDone = () => {
            container.classList.remove('animate');
            // Stop emitting trail particles
            if (trailInterval) clearInterval(trailInterval);
            // hide it safely
            container.style.opacity = '0';
            container.style.visibility = 'hidden';
            // Schedule the next launch after a random delay
            setTimeout(launchSpaceObject, Math.random() * 8000 + 2000); // 2-10 seconds delay
        };
        // Attach both a timer and an animationend listener as a robust fallback
        container._astronautTimer = setTimeout(onDone, msDuration + 300);
        container._astronautListener = (e) => {
            // ensure we only respond to the move-astronaut animation (not child animations)
            if (e.animationName === 'move-astronaut') {
                clearTimeout(container._astronautTimer);
                container._astronautTimer = null;
                onDone();
            }
        };
        container.addEventListener('animationend', container._astronautListener);
    }

    // Initial launch after a short delay
    setTimeout(launchSpaceObject, 5000);
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
