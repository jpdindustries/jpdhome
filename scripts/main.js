document.addEventListener('DOMContentLoaded', () => {
    const nebulaCanvas = document.getElementById('nebula-canvas');
    const nebulaCtx = nebulaCanvas.getContext('2d');
    const starsCanvas = document.getElementById('stars-canvas');
    const starsCtx = starsCanvas.getContext('2d');
    const logoContainer = document.getElementById('logo-container');
    const spaceObjectContainer = document.getElementById('space-object-container');

    const config = {
        baseNumStars: 1337,
        logoMovementRatio: 0.08,
        lissajous: {
            magnitude: 1000,
            speed: 0.000035,
            a: 3,
            b: 4,
            delta: Math.PI / 2,
        },
        starColors: {
            whiteBlue: 'rgba(200, 200, 255, OPACITY)',
            yellowWhite: 'rgba(255, 255, 200, OPACITY)',
            redTinted: 'rgba(255, 180, 180, OPACITY)'
        },
        shootingStarColors: [
            { start: 'rgba(255, 100, 100, OPACITY)', end: 'rgba(255, 0, 0, 0)' },
            { start: 'rgba(200, 220, 255, OPACITY)', end: 'rgba(200, 220, 255, 0)' },
            { start: 'rgba(255, 255, 200, OPACITY)', end: 'rgba(255, 255, 0, 0)' }
        ],
        spaceObjects: [
            { id: 'astronaut', name: 'Astronaut' },
            { id: 'meteorite', name: 'Meteorite' },
            { id: 'rocket', name: 'Rocket' },
            { id: 'satellite', name: 'Satellite' }
        ]
    };

    const state = {
        mouseX: 0,
        mouseY: 0,
        targetMouseX: 0,
        targetMouseY: 0,
        logoMovementRatio: config.logoMovementRatio,
        mouseOutsideTimer: null,
        isMouseOutside: false,
        mouseIdleTimer: null,
        isMouseIdle: false,
        lastMouseActivityTime: Date.now(),
        stars: [],
        shootingStars: [],
        astronautTrailParticles: [],
        nebulaClouds: [],
        starSizeScale: 1,
        starCountScale: 1,
        shootingFreq: 0.015,
        _prevStarSizeScale: 1,
        _prevStarCountScale: 1,
    };

    function resizeCanvases() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        nebulaCanvas.width = width;
        nebulaCanvas.height = height;
        starsCanvas.width = width;
        starsCanvas.height = height;
    }
    
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
    
    function updateResponsiveSettings() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isPortrait = h > w;

        if (w <= 480 || (isPortrait && w < 1200)) {
            state.starSizeScale = 0.6;
            state.starCountScale = 0.3;
            state.shootingFreq = 0.005;
            state.logoMovementRatio = 0.02;
        } else if (w <= 1200) {
            state.starSizeScale = 0.8;
            state.starCountScale = 0.4;
            state.shootingFreq = 0.008;
            state.logoMovementRatio = 0.04;
        } else {
            state.starSizeScale = 1;
            state.starCountScale = 1;
            state.shootingFreq = 0.015;
            state.logoMovementRatio = config.logoMovementRatio;
        }

        if (state.starSizeScale !== state._prevStarSizeScale && state.stars.length > 0) {
            const ratio = state.starSizeScale / (state._prevStarSizeScale || 1);
            state.stars.forEach(s => { s.size = Math.max(0.2, s.size * ratio); });
            state._prevStarSizeScale = state.starSizeScale;
        }

        if (state.starCountScale !== state._prevStarCountScale) {
            adjustStarCount();
            state._prevStarCountScale = state.starCountScale;
        }
    }

    function getRandomColor() {
        const rand = Math.random();
        if (rand < 0.7) return config.starColors.whiteBlue;
        if (rand < 0.9) return config.starColors.yellowWhite;
        return config.starColors.redTinted;
    }

    function getStarMovementRatio(star) {
        const depth = star.z / starsCanvas.width;
        if (depth < 0.33) return 0.060;
        if (depth < 0.66) return 0.040;
        return 0.020;
    }

    function brightenRgba(rgbaStr, targetAlpha) {
        const parts = rgbaStr.match(/(\d+)/g);
        if (!parts || parts.length < 3) return `rgba(255, 255, 255, ${targetAlpha})`;
        const [r, g, b] = parts.map(Number);
        const brighten = (val) => Math.min(255, val + 70);
        return `rgba(${brighten(r)}, ${brighten(g)}, ${brighten(b)}, ${targetAlpha})`;
    }

    function calculateLissajousPosition(time) {
        const { magnitude, speed, a, b, delta } = config.lissajous;
        const x = magnitude * Math.sin(a * time * speed + delta);
        const y = magnitude * Math.sin(b * time * speed);
        return { x, y };
    }

    class Star {
        constructor() {
            const buffer = 0.2;
            this.x = (Math.random() * (1 + 2 * buffer) - buffer) * starsCanvas.width;
            this.y = (Math.random() * (1 + 2 * buffer) - buffer) * starsCanvas.height;
            this.z = Math.random() * starsCanvas.width;
            this.size = (Math.random() * 2 + 1) * state.starSizeScale;
            this.baseOpacity = Math.random() * 0.5 + 0.3;
            this.opacity = this.baseOpacity;
            this.isRedGiant = Math.random() > 0.98;
            if (this.isRedGiant) {
                this.color = 'rgba(255, 100, 100, OPACITY)';
                this.size = (Math.random() * 2 + 2) * state.starSizeScale;
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

                const drawShine = (alpha, length, angleOffset) => {
                    ctx.strokeStyle = brightenRgba(this.color, sineProgress * alpha);
                    const crossLength = this.size * 5 * sineProgress * length;
                    for (let i = 0; i < 4; i++) {
                        ctx.beginPath();
                        const angle = (i / 4) * Math.PI * 2 + angleOffset + this.shineAngle;
                        ctx.moveTo(parallaxX, parallaxY);
                        ctx.lineTo(parallaxX + Math.cos(angle) * crossLength, parallaxY + Math.sin(angle) * crossLength);
                        ctx.stroke();
                    }
                };

                ctx.lineWidth = 1.5;
                drawShine(0.6, 1, Math.PI / 4);
                drawShine(0.4, 0.6, 0);

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
            const colorSet = config.shootingStarColors[Math.floor(Math.random() * config.shootingStarColors.length)];
            this.colorStart = colorSet.start;
            this.colorEnd = colorSet.end;
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.opacity -= 0.01;
        }
        draw(ctx) {
            const endX = this.x - this.len * Math.cos(this.angle);
            const endY = this.y - this.len * Math.sin(this.angle);
            const grad = ctx.createLinearGradient(this.x, this.y, endX, endY);
            grad.addColorStop(0, this.colorStart.replace('OPACITY', this.opacity));
            grad.addColorStop(1, this.colorEnd);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(endX, endY);
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
            const maxWidth = Math.min(nebulaCanvas.width, 1400);
            this.radius = Math.random() * (maxWidth / 2.5) + (maxWidth / 2.5);
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

    function setupScene() {
        state.nebulaClouds.length = 0;
        for (let i = 0; i < 4; i++) state.nebulaClouds.push(new NebulaCloud());
        adjustStarCount();
    }

    function adjustStarCount() {
        const desired = Math.round(config.baseNumStars * state.starCountScale);
        state.stars.length = 0;
        for (let i = 0; i < desired; i++) {
            state.stars.push(new Star());
        }
    }

    function animateNebulas() {
        nebulaCtx.clearRect(0, 0, nebulaCanvas.width, nebulaCanvas.height);
        state.nebulaClouds.forEach(cloud => {
            cloud.update();
            cloud.draw(nebulaCtx);
        });
    }

    function updateMousePosition() {
        // Use different smoothing factors based on whether we're resetting to center
        const smoothingFactor = (state.isMouseIdle || state.isMouseOutside) ? 0.02 : 0.05;
        state.mouseX += (state.targetMouseX - state.mouseX) * smoothingFactor;
        state.mouseY += (state.targetMouseY - state.mouseY) * smoothingFactor;
        logoContainer.style.transform = `translate(calc(-50% + ${-state.mouseX * state.logoMovementRatio}px), calc(-50% + ${-state.mouseY * state.logoMovementRatio}px))`;
        
        // Check if mouse has been idle for 3 seconds
        const currentTime = Date.now();
        if (currentTime - state.lastMouseActivityTime > 3000 && !state.isMouseIdle && !state.isMouseOutside) {
            state.isMouseIdle = true;
            state.targetMouseX = 0;
            state.targetMouseY = 0;
        }
    }

    function drawStars() {
        const lissajousPos = calculateLissajousPosition(Date.now());
        const combinedMouseX = state.mouseX + lissajousPos.x;
        const combinedMouseY = state.mouseY + lissajousPos.y;
        
        starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
        state.stars.forEach(star => star.draw(starsCtx, combinedMouseX, combinedMouseY));
    }

    function manageShootingStars() {
        if (Math.random() < state.shootingFreq) {
            state.shootingStars.push(new ShootingStar());
        }

        for (let i = state.shootingStars.length - 1; i >= 0; i--) {
            const shootingStar = state.shootingStars[i];
            shootingStar.update();
            shootingStar.draw(starsCtx);
            if (shootingStar.isOffscreen()) {
                state.shootingStars.splice(i, 1);
            }
        }
    }

    function manageAstronautTrail() {
        for (let i = state.astronautTrailParticles.length - 1; i >= 0; i--) {
            const particle = state.astronautTrailParticles[i];
            particle.update();
            particle.draw(starsCtx);
            if (particle.isFaded()) {
                state.astronautTrailParticles.splice(i, 1);
            }
        }
    }

    function animateStars() {
        updateMousePosition();
        drawStars();
        manageShootingStars();
        manageAstronautTrail();
        requestAnimationFrame(animateStars);
    }

    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') {
            state.targetMouseX = e.clientX - window.innerWidth / 2;
            state.targetMouseY = e.clientY - window.innerHeight / 2;
            state.lastMouseActivityTime = Date.now();
            
            // Clear idle state if mouse moves
            if (state.isMouseIdle) {
                state.isMouseIdle = false;
                if (state.mouseIdleTimer) {
                    clearTimeout(state.mouseIdleTimer);
                    state.mouseIdleTimer = null;
                }
            }
            
            if (state.isMouseOutside) {
                console.log('Mouse re-entered the window');
                state.isMouseOutside = false;
                if (state.mouseOutsideTimer) {
                    console.log('Clearing mouse-out timer');
                    clearTimeout(state.mouseOutsideTimer);
                    state.mouseOutsideTimer = null;
                }
            }
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (e.relatedTarget === null) {
            state.isMouseOutside = true;
            state.mouseOutsideTimer = setTimeout(() => {
                state.targetMouseX = 0;
                state.targetMouseY = 0;
                state.mouseOutsideTimer = null;
            }, 3000);
        }
    });

    document.addEventListener('mouseover', (e) => {
        if (e.relatedTarget !== null) {
            if (state.mouseOutsideTimer) {
                clearTimeout(state.mouseOutsideTimer);
                state.mouseOutsideTimer = null;
            }
            state.isMouseOutside = false;
        }
    });

    function selectSpaceObject() {
        const selected = config.spaceObjects[Math.floor(Math.random() * config.spaceObjects.length)];
        const element = document.getElementById(selected.id);
        document.querySelectorAll('.space-object').forEach(el => el.style.display = 'none');
        element.style.display = 'block';
        return { ...selected, element };
    }

    function getOffscreenPositions(buffer) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const startPos = { x: 0, y: 0 };
        const endPos = { x: 0, y: 0 };
        const edge = Math.floor(Math.random() * 4);

        switch (edge) {
            case 0: // Top to Bottom
                startPos.x = Math.random() * vw;
                startPos.y = -buffer;
                endPos.x = Math.random() * vw;
                endPos.y = vh + buffer;
                break;
            case 1: // Right to Left
                startPos.x = vw + buffer;
                startPos.y = Math.random() * vh;
                endPos.x = -buffer;
                endPos.y = Math.random() * vh;
                break;
            case 2: // Bottom to Top
                startPos.x = Math.random() * vw;
                startPos.y = vh + buffer;
                endPos.x = Math.random() * vw;
                endPos.y = -buffer;
                break;
            case 3: // Left to Right
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
            return { startRotation: angle, endRotation: angle };
        }
        element.style.transform = '';
        const startRotation = Math.random() * 360;
        const endRotation = startRotation + (Math.random() > 0.5 ? 1 : -1) * 360;
        return { startRotation, endRotation };
    }

    function launchSpaceObject() {
        const container = spaceObjectContainer;
        const spaceObject = selectSpaceObject();
        void container.offsetWidth;

        const size = (spaceObject.element && spaceObject.element.offsetWidth) ? spaceObject.element.offsetWidth :
            (spaceObject.element ? Math.round(spaceObject.element.getBoundingClientRect().width) : 38);
        const buffer = (size > 0 ? size : 38) * 4 + 50;

        state.astronautTrailParticles.length = 0;
        container.classList.remove('rocket');

        const { startPos, endPos } = getOffscreenPositions(buffer);
        const duration = Math.random() * 10 + 10;
        const { startRotation, endRotation } = getObjectRotation(spaceObject.id, startPos, endPos, spaceObject.element);

        if (spaceObject.id === 'rocket') {
            container.classList.add('rocket');
        }

        Object.entries({
            '--start-x': `${startPos.x}px`,
            '--start-y': `${startPos.y}px`,
            '--end-x': `${endPos.x}px`,
            '--end-y': `${endPos.y}px`,
            '--duration': `${duration}s`,
            '--start-rotate': `${startRotation}deg`,
            '--end-rotate': `${endRotation}deg`,
        }).forEach(([prop, val]) => container.style.setProperty(prop, val));

        Object.assign(container.style, {
            visibility: 'visible',
            display: 'block',
            willChange: 'transform, opacity',
            opacity: '1',
        });
        container.classList.add('animate');
        spaceObject.element.style.display = 'block';

        const msDuration = Math.round(duration * 1000);
        manageAnimation(container, spaceObject.element, msDuration);
    }
    function manageAnimation(container, element, msDuration) {
        let trailInterval;
        const startEmittingTrail = () => {
            if (trailInterval) clearInterval(trailInterval);
            trailInterval = setInterval(() => {
                const rect = element.getBoundingClientRect();
                if (rect.width > 0) {
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    for (let i = 0; i < 3; i++) {
                        state.astronautTrailParticles.push(new AstronautTrailParticle(
                            centerX,
                            centerY,
                            Math.random() * 1.5 + 0.5,
                            'rgba(200, 220, 255, OPACITY)'
                        ));
                    }
                }
            }, 50);
        };

        const onDone = () => {
            container.classList.remove('animate');
            if (trailInterval) clearInterval(trailInterval);
            Object.assign(container.style, {
                opacity: '0',
                visibility: 'hidden',
            });
            setTimeout(launchSpaceObject, Math.random() * 8000 + 2000);
        };

        if (container._astronautTimer) clearTimeout(container._astronautTimer);
        if (container._astronautListener) container.removeEventListener('animationend', container._astronautListener);
        
        container._astronautTimer = setTimeout(onDone, msDuration + 300);
        container._astronautListener = (e) => {
            if (e.animationName === 'move-astronaut') {
                clearTimeout(container._astronautTimer);
                container._astronautTimer = null;
                onDone();
            }
        };
        container.addEventListener('animationend', container._astronautListener);

        startEmittingTrail();
    }
    
    function init() {
        resizeCanvases();
        updateResponsiveSettings();
        setupScene();

        window.addEventListener('resize', debounce(() => {
            resizeCanvases();
            updateResponsiveSettings();
            setupScene();
        }, 250));

        setInterval(animateNebulas, 100);
        animateStars();
        setTimeout(launchSpaceObject, 5000);
    }

    init();
});
