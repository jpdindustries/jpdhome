document.addEventListener('DOMContentLoaded', () => {
    const nebulaCanvas = document.getElementById('nebula-canvas');
    const nebulaCtx = nebulaCanvas.getContext('2d');
    const starsCanvas = document.getElementById('stars-canvas');
    const starsCtx = starsCanvas.getContext('2d');
    const logoContainer = document.getElementById('logo-container');

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    const logoMovementRatio = 0.08;

    function resizeCanvases() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        nebulaCanvas.width = width;
        nebulaCanvas.height = height;
        starsCanvas.width = width;
        starsCanvas.height = height;
    }
    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();

    const numStars = 1000;
    const stars = [];
    const shootingStars = [];
    const nebulaClouds = [];

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

    class Star {
        constructor() {
            this.x = Math.random() * starsCanvas.width;
            this.y = Math.random() * starsCanvas.height;
            this.z = Math.random() * starsCanvas.width;
            this.size = Math.random() * 2 + 1;
            this.baseOpacity = Math.random() * 0.5 + 0.3;
            this.opacity = this.baseOpacity;
            this.isRedGiant = Math.random() > 0.98;
            if (this.isRedGiant) {
                this.color = 'rgba(255, 100, 100, OPACITY)';
                this.size = Math.random() * 2 + 2;
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
            this.x = Math.random() * starsCanvas.width * 1.5;
            this.y = Math.random() * starsCanvas.height * 0.5;
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

    for (let i = 0; i < 4; i++) nebulaClouds.push(new NebulaCloud());
    for (let i = 0; i < numStars; i++) stars.push(new Star());

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
        starsCtx.clearRect(0, 0, starsCanvas.width, starsCanvas.height);
        stars.forEach(star => star.draw(starsCtx, mouseX, mouseY));
        if (Math.random() < 0.015) shootingStars.push(new ShootingStar());
        for (let i = shootingStars.length - 1; i >= 0; i--) {
            shootingStars[i].update();
            shootingStars[i].draw(starsCtx);
            if (shootingStars[i].isOffscreen()) shootingStars.splice(i, 1);
        }
        requestAnimationFrame(animateStars);
    }

    document.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'mouse') {
            targetMouseX = (e.clientX - window.innerWidth / 2);
            targetMouseY = (e.clientY - window.innerHeight / 2);
        }
    });

    function handleOrientation(event) {
        const y = event.beta, x = event.gamma;
        if (x === null || y === null) return;
        const clampedX = Math.max(-45, Math.min(45, x));
        const clampedY = Math.max(-45, Math.min(45, y));
        targetMouseX = (clampedX / 45) * (window.innerWidth / 4);
        targetMouseY = (clampedY / 45) * (window.innerHeight / 4);
    }

    if (window.DeviceOrientationEvent && 'ontouchstart' in window) {
        DeviceOrientationEvent.requestPermission?.().then(permissionState => {
            if (permissionState === 'granted') window.addEventListener('deviceorientation', handleOrientation);
        }).catch(() => {
            if (!('requestPermission' in DeviceOrientationEvent)) window.addEventListener('deviceorientation', handleOrientation);
        });
    }

    setInterval(animateNebulas, 100); // Low-frequency loop for background
    animateStars(); // High-frequency loop for foreground
});