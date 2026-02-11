/**
 * hero-bg.js — Dual-mode hero background animation
 *
 * Dark mode:  Starfield — particles fly towards camera with size/brightness variance + mouse parallax
 * Light mode: Coloured rain streaks falling with mouse parallax on position & angle
 */

(function () {
    'use strict';

    var canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');

    // ── State ─────────────────────────────────────────────────
    var W, H;
    var mouse = { x: 0.5, y: 0.5 };       // normalised 0-1
    var particles = [];
    var raindrops = [];
    var raf;
    var currentMode = '';                    // 'dark' | 'light'

    // ── Config ────────────────────────────────────────────────
    var STAR_COUNT = 200;
    var RAIN_COUNT = 120;

    var RAIN_COLORS = [
        'rgba(0, 120, 212, 0.35)',   // blue
        'rgba(76, 175, 80, 0.30)',   // green
        'rgba(156, 39, 176, 0.25)',  // purple
        'rgba(255, 152, 0, 0.25)',   // orange
        'rgba(233, 30, 99, 0.22)',   // pink
        'rgba(0, 188, 212, 0.30)',   // cyan
    ];

    // ── Resize ────────────────────────────────────────────────
    function resize() {
        var rect = canvas.parentElement.getBoundingClientRect();
        var dpr = window.devicePixelRatio || 1;
        W = rect.width;
        H = rect.height;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ── Theme detection ───────────────────────────────────────
    function getMode() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    // ── Stars (dark mode) ─────────────────────────────────────
    function initStars() {
        particles = [];
        for (var i = 0; i < STAR_COUNT; i++) {
            particles.push(createStar());
        }
    }

    function createStar() {
        return {
            x: Math.random() * 2 - 1,           // -1 to 1 (centre-origin)
            y: Math.random() * 2 - 1,
            z: Math.random() * 1.5 + 0.2,       // depth
            baseSize: Math.random() * 1.8 + 0.4,
            brightness: Math.random() * 0.6 + 0.4,
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            twinklePhase: Math.random() * Math.PI * 2,
        };
    }

    function drawStars(t) {
        ctx.clearRect(0, 0, W, H);

        var parallaxX = (mouse.x - 0.5) * 40;
        var parallaxY = (mouse.y - 0.5) * 40;

        for (var i = 0; i < particles.length; i++) {
            var s = particles[i];

            // Move star forward (towards camera)
            s.z -= 0.002;
            if (s.z <= 0.05) {
                s.x = Math.random() * 2 - 1;
                s.y = Math.random() * 2 - 1;
                s.z = 1.5;
                s.brightness = Math.random() * 0.6 + 0.4;
            }

            // Project to screen with parallax
            var invZ = 1 / s.z;
            var sx = W / 2 + s.x * W * 0.5 * invZ + parallaxX * (1 - s.z);
            var sy = H / 2 + s.y * H * 0.5 * invZ + parallaxY * (1 - s.z);

            // Skip if off-screen
            if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;

            // Twinkle
            var twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
            var alpha = s.brightness * (0.5 + twinkle * 0.5);

            // Size scales with proximity
            var size = s.baseSize * invZ * 0.6;
            size = Math.min(size, 3.5);

            // Draw glow
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha * 0.95) + ')';
            ctx.fill();

            // Faint outer glow for brighter stars
            if (alpha > 0.6 && size > 1) {
                ctx.beginPath();
                ctx.arc(sx, sy, size * 2.5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 220, 255, ' + (alpha * 0.08) + ')';
                ctx.fill();
            }
        }
    }

    // ── Rain (light mode) ─────────────────────────────────────
    function initRain() {
        raindrops = [];
        for (var i = 0; i < RAIN_COUNT; i++) {
            raindrops.push(createRaindrop());
        }
    }

    function createRaindrop() {
        return {
            x: Math.random() * 1.4 - 0.2,           // slightly wider than viewport
            y: Math.random() * -1.5,                  // start above view
            speed: Math.random() * 3 + 2,             // fall speed
            length: Math.random() * 40 + 20,          // streak length
            thickness: Math.random() * 1.5 + 0.5,
            color: RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)],
            depth: Math.random() * 0.7 + 0.3,         // parallax depth layer
        };
    }

    function drawRain() {
        ctx.clearRect(0, 0, W, H);

        // Mouse influences angle and position
        var angleOffset = (mouse.x - 0.5) * 0.35;      // subtle tilt
        var parallaxX = (mouse.x - 0.5) * 60;
        var parallaxY = (mouse.y - 0.5) * 30;

        for (var i = 0; i < raindrops.length; i++) {
            var r = raindrops[i];

            // Move down
            r.y += r.speed * 0.008;

            // Reset when off-screen
            if (r.y > 1.3) {
                r.y = Math.random() * -0.5 - 0.1;
                r.x = Math.random() * 1.4 - 0.2;
                r.color = RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)];
            }

            // Screen position with parallax
            var sx = r.x * W + parallaxX * r.depth;
            var sy = r.y * H + parallaxY * r.depth;

            // Angle of rain streak
            var angle = Math.PI / 2 + angleOffset * r.depth;
            var dx = Math.cos(angle) * r.length * r.depth;
            var dy = Math.sin(angle) * r.length * r.depth;

            // Draw streak
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + dx, sy + dy);
            ctx.strokeStyle = r.color;
            ctx.lineWidth = r.thickness * r.depth;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
    }

    // ── Animation loop ────────────────────────────────────────
    var frameCount = 0;

    function loop() {
        frameCount++;
        var mode = getMode();

        // Re-init particles if mode changed
        if (mode !== currentMode) {
            currentMode = mode;
            if (mode === 'dark') {
                initStars();
            } else {
                initRain();
            }
        }

        if (mode === 'dark') {
            drawStars(frameCount);
        } else {
            drawRain();
        }

        raf = requestAnimationFrame(loop);
    }

    // ── Mouse tracking ────────────────────────────────────────
    function onMouseMove(e) {
        var rect = canvas.parentElement.getBoundingClientRect();
        mouse.x = (e.clientX - rect.left) / rect.width;
        mouse.y = (e.clientY - rect.top) / rect.height;
    }

    function onTouchMove(e) {
        if (e.touches.length > 0) {
            var rect = canvas.parentElement.getBoundingClientRect();
            mouse.x = (e.touches[0].clientX - rect.left) / rect.width;
            mouse.y = (e.touches[0].clientY - rect.top) / rect.height;
        }
    }

    // ── Init ──────────────────────────────────────────────────
    function init() {
        resize();
        currentMode = getMode();
        if (currentMode === 'dark') {
            initStars();
        } else {
            initRain();
        }
        loop();

        window.addEventListener('resize', resize);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
