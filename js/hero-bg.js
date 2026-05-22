/**
 * hero-bg.js — Dual-mode hero background animation with BGM Synced Interactive FX
 *
 * Dark mode:  Starfield — particles fly towards camera with size/brightness variance + mouse parallax
 *             *Synced*: Stars fade from grey to pure white and expand radial glow (without hard borders) on beats.
 *                       Heavy beats trigger neon blue purple atmospheric nebula flashes.
 * Light mode: Coloured rain streaks falling with mouse parallax on position & angle
 *             *Synced*: Rain falls at a steady slow rate. Heavy beats stretch rain streaks significantly 
 *                       and wrap them with soft glowing neon halos. Heavy beats flash pure white glare.
 */

(function () {
    'use strict';

    var canvas = document.getElementById('hero-canvas');
    var canvasFront = document.getElementById('hero-canvas-front');
    if (!canvas) return;
    
    // Attempt Display-P3 (Wide Gamut / HDR ready) context
    var ctx, ctxFront;
    var supportsP3 = window.matchMedia && window.matchMedia('(color-gamut: p3)').matches;
    
    try {
        if (supportsP3) {
            ctx = canvas.getContext('2d', { colorSpace: 'display-p3' });
            if (canvasFront) {
                ctxFront = canvasFront.getContext('2d', { colorSpace: 'display-p3' });
            }
        } else {
            ctx = canvas.getContext('2d');
            if (canvasFront) {
                ctxFront = canvasFront.getContext('2d');
            }
        }
    } catch (e) {
        ctx = canvas.getContext('2d');
        if (canvasFront) {
            ctxFront = canvasFront.getContext('2d');
        }
        supportsP3 = false;
    }

    // ── State ─────────────────────────────────────────────────
    var W, H;
    var mouse = { x: 0.5, y: 0.5 };       // normalised 0-1
    var particles = [];
    var raindrops = [];
    var raf;
    var currentMode = '';                    // 'dark' | 'light'
    
    // Dynamic BGM Interactivity State
    var lightningAlpha = 0;                  // Atmospheric lightning intensity
    var lastBassValue = 0;                   // First-difference onset storage

    // ── Config ────────────────────────────────────────────────
    var STAR_COUNT = 400;
    var RAIN_COUNT = 250;                     // Reduced base for elegant sparsity and space

    var RAIN_COLORS = [
        'rgba(229, 0, 0, 0.30)',    
        'rgba(255, 141, 0, 0.30)',  
        'rgba(255, 238, 0, 0.30)',  
        'rgba(1, 129, 33, 0.30)',    
        'rgba(0, 76, 255, 0.30)',    
        'rgba(119, 0, 136, 0.30)'    
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

        if (canvasFront && ctxFront) {
            canvasFront.width = W * dpr;
            canvasFront.height = H * dpr;
            canvasFront.style.width = W + 'px';
            canvasFront.style.height = H + 'px';
            ctxFront.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
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
            group: Math.floor(Math.random() * 6), // 0 to 5 mapping to 6 BGM analyzer frequency bands
            isFront: Math.random() < 0.15      // 15% 的雨丝或恒星飞掠在最前方的文字层上层
        };
    }

    function drawStars(t) {
        ctx.clearRect(0, 0, W, H);
        if (ctxFront) ctxFront.clearRect(0, 0, W, H);

        var parallaxX = (mouse.x - 0.5) * 40;
        var parallaxY = (mouse.y - 0.5) * 40;

        // Global entrance fade
        var globalFade = spawnProgress;

        // ── Retrieve Realtime Music Data ──
        var isPlaying = window.bgmData && window.bgmData.isPlaying;
        var currentScales = isPlaying ? window.bgmData.currentScales : [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
        var bassValue = currentScales[0];

        // ── First-Difference Onset Detection for Cyber Purple-Blue Lightning ──
        var bassDelta = bassValue - lastBassValue;
        lastBassValue = bassValue;

        if (isPlaying && bassDelta > 0.32 && bassValue > 0.65 && lightningAlpha < 0.1) {
            lightningAlpha = 0.40; // Flash onset
        }

        // Ambient lightning decay
        if (lightningAlpha > 0.01) {
            lightningAlpha -= 0.025; // Decays gently for a nebula neon feel
        } else {
            lightningAlpha = 0;
        }

        for (var i = 0; i < particles.length; i++) {
            var s = particles[i];

            // 前景恒星粒子飞掠速度更快以体现 3D 纵深差异
            var speedCoeff = s.isFront ? 0.0035 : 0.002;
            s.z -= speedCoeff;
            if (s.z <= 0.05) {
                s.x = Math.random() * 2 - 1;
                s.y = Math.random() * 2 - 1;
                s.z = 1.5;
                s.brightness = Math.random() * 0.6 + 0.4;
            }

            // Project to screen with parallax
            var invZ = 1 / s.z;
            var pFactor = Math.max(0, 1.5 - s.z);
            var sx = W / 2 + s.x * W * 0.5 * invZ + parallaxX * pFactor;
            var sy = H / 2 + s.y * H * 0.5 * invZ + parallaxY * pFactor;

            if (sx < -10 || sx > W + 10 || sy < -10 || sy > H + 10) continue;

            // Fading logic: 
            // 1. Entrance fade (spawnProgress)
            // 2. Horizon fade (fade in as they appear in distance)
            // 3. Near fade (fade out as they pass camera)
            var zFade = Math.min(1, (1.5 - s.z) * 4) * Math.min(1, s.z * 5);
            
            // Basic natural twinkle
            var twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase);
            
            // Synced frequency bands effect mapping (0.15 - 1.0 to 0.0 - 1.0)
            var musicSync = currentScales[s.group] || 0.15;
            var syncEffect = Math.max(0, (musicSync - 0.15) / 0.85);

            // Stars brightness dynamically modulated by specific instrument frequencies
            var alpha = s.brightness * (0.3 + twinkle * 0.3 + syncEffect * 0.6) * zFade * globalFade;

            // 前景近焦恒星粒子物理尺寸放大，以强化 3D 景深感
            var sizeCoeff = s.isFront ? 1.4 : 1.0;
            var size = s.baseSize * invZ * 0.6 * (1.0 + syncEffect * 0.4) * sizeCoeff;
            size = Math.min(size, s.isFront ? 5.5 : 4.0);

            // ── Color Interpolation: Low-energy (elegant grey) -> High-energy (pure white) ──
            var intensityFactor = Math.max(0, Math.min(1, syncEffect * 0.7 + twinkle * 0.3));
            var colorVal = Math.floor(125 + (255 - 125) * intensityFactor);

            // 依据 isFront 分流至背景或前景 Canvas 渲染
            var targetCtx = (s.isFront && ctxFront) ? ctxFront : ctx;

            // Draw core star
            targetCtx.beginPath();
            targetCtx.arc(sx, sy, size, 0, Math.PI * 2);
            targetCtx.fillStyle = 'rgba(' + colorVal + ', ' + colorVal + ', ' + colorVal + ', ' + (alpha * 0.95) + ')';
            targetCtx.fill();

            // ── Seamless Radial Glow ──
            var glowSize = size * (1.2 + syncEffect * 4.8);
            if (alpha > 0.3 && glowSize > size * 1.3) {
                targetCtx.beginPath();
                var glow = targetCtx.createRadialGradient(sx, sy, size * 0.15, sx, sy, glowSize);
                
                if (supportsP3) {
                    glow.addColorStop(0, 'color(display-p3 0.7 0.85 1 / ' + (alpha * 0.18 * intensityFactor) + ')');
                    glow.addColorStop(1, 'color(display-p3 0.7 0.85 1 / 0)');
                } else {
                    glow.addColorStop(0, 'rgba(180, 210, 255, ' + (alpha * 0.15 * intensityFactor) + ')');
                    glow.addColorStop(1, 'rgba(180, 210, 255, 0)');
                }
                
                targetCtx.fillStyle = glow;
                targetCtx.arc(sx, sy, glowSize, 0, Math.PI * 2);
                targetCtx.fill();
            }
        }

        // Draw Dark-mode cosmic neon blue lightning overlay on Canvas (背景层)
        if (lightningAlpha > 0) {
            ctx.beginPath();
            if (supportsP3) {
                ctx.fillStyle = 'color(display-p3 0.38 0.48 1 / ' + (lightningAlpha * 0.5) + ')';
            } else {
                ctx.fillStyle = 'rgba(96, 120, 255, ' + (lightningAlpha * 0.45) + ')';
            }
            ctx.fillRect(0, 0, W, H);
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
            speed: Math.random() * 1.8 + 1.2,         // reduced fall speed for steady calm falling
            length: Math.random() * 40 + 20,          // streak length
            thickness: Math.random() * 2.2 + 2.0,     // Thicker rain streaks for elegant contrast
            color: RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)],
            depth: Math.random() * 0.7 + 0.3,         // parallax depth layer
            isFront: Math.random() < 0.15            // 15% 的雨丝从文字前方落下
        };
    }

    function drawRain() {
        ctx.clearRect(0, 0, W, H);
        if (ctxFront) ctxFront.clearRect(0, 0, W, H);

        // Mouse influences angle and position
        var angleOffset = (mouse.x - 0.5) * 0.35;      // subtle tilt
        var parallaxX = (mouse.x - 0.5) * 60;
        var parallaxY = (mouse.y - 0.5) * 30;

        // Global entrance fade
        var globalFade = spawnProgress;

        // ── Retrieve Realtime Music Data ──
        var isPlaying = window.bgmData && window.bgmData.isPlaying;
        var currentScales = isPlaying ? window.bgmData.currentScales : [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
        var bassValue = currentScales[0];

        // ── First-Difference Onset Detection for Pure White Flash ──
        var bassDelta = bassValue - lastBassValue;
        lastBassValue = bassValue;

        if (isPlaying && bassDelta > 0.32 && bassValue > 0.65 && lightningAlpha < 0.1) {
            lightningAlpha = 0.45; // Pure white flash onset
        }

        // Ambient lightning decay
        if (lightningAlpha > 0.01) {
            lightningAlpha -= 0.038; // Decays rapidly for a sharp flash effect
        } else {
            lightningAlpha = 0;
        }

        // Calculate dynamic rain speed and length multipliers based on overall audio intensity
        var avgIntensity = (currentScales[0] + currentScales[1] + currentScales[2] + currentScales[3] + currentScales[4] + currentScales[5]) / 6;
        var intensityFactor = Math.max(0, (avgIntensity - 0.15) / 0.85); // 0.0 to 1.0
        
        // ── Keep falling speed natural and slightly slow ──
        var speedMultiplier = 0.95; 
        var lengthMultiplier = 1.0 + intensityFactor * 1.5;  // Streaks stretch up to 2.5x length on beats

        for (var i = 0; i < raindrops.length; i++) {
            var r = raindrops[i];

            // 前景雨丝速度稍微加快以展现透视视差
            var fallSpeedCoeff = r.isFront ? 0.009 : 0.007;
            r.y += r.speed * fallSpeedCoeff * speedMultiplier;

            if (r.y > 1.3) {
                r.y = Math.random() * -0.5 - 0.1;
                r.x = Math.random() * 1.4 - 0.2;
                r.color = RAIN_COLORS[Math.floor(Math.random() * RAIN_COLORS.length)];
            }

            // Screen position with parallax
            var pFactor = (r.depth - 0.3) / 0.7; // 0 at far (0.3), 1 at near (1.0)
            var sx = r.x * W + parallaxX * pFactor;
            var sy = r.y * H + parallaxY * pFactor;

            // Angle of rain streak (Vertical)
            var angle = Math.PI / 2;
            var dx = 0;

            // 前景近景雨滴长度放大 (1.25x 放大)
            var lenCoeff = r.isFront ? 1.25 : 1.0;
            var dy = r.length * r.depth * lengthMultiplier * lenCoeff; // Dynamic length stretching!

            // 前景近景雨滴厚度放大 (1.3x 放大)
            var thickCoeff = r.isFront ? 1.3 : 1.0;
            var strokeWidth = r.thickness * r.depth * thickCoeff;

            // 依据 isFront 分流至背景或前景 Canvas 渲染
            var targetCtx = (r.isFront && ctxFront) ? ctxFront : ctx;

            // Apply global fade by reducing stroke opacity
            targetCtx.globalAlpha = globalFade;

            // ── 1. Draw Companion Rain Glow Streak on beats ──
            // If music intensity is strong, draw a wider, very soft neon glowing streak behind it
            if (isPlaying && intensityFactor > 0.3) {
                targetCtx.beginPath();
                targetCtx.moveTo(sx, sy);
                targetCtx.lineTo(sx + dx, sy + dy);
                
                var glowColor = r.color.replace(/[\d\.]+\)$/, (0.05 * intensityFactor) + ')');
                targetCtx.strokeStyle = glowColor;
                targetCtx.lineWidth = strokeWidth * 3.5; // Thicker glow line
                targetCtx.lineCap = 'round';
                targetCtx.stroke();
            }

            // ── 2. Draw Main Core Rain Streak ──
            targetCtx.beginPath();
            targetCtx.moveTo(sx, sy);
            targetCtx.lineTo(sx + dx, sy + dy);
            targetCtx.strokeStyle = r.color;
            targetCtx.lineWidth = strokeWidth;
            targetCtx.lineCap = 'round';
            targetCtx.stroke();
            
            targetCtx.globalAlpha = 1.0;
        }

        // Draw Light-mode white lightning overlay inside Canvas (Background level, text remains clean and readable)
        if (lightningAlpha > 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, ' + lightningAlpha + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    // ── Animation state ──────────────────────────────────────
    var frameCount = 0;
    var spawnProgress = 0;              // 0 to 1 for entrance growth
    var isInitialised = false;

    function loop(t) {
        frameCount++;
        
        // Handle entrance growth
        if (isInitialised && spawnProgress < 1) {
            spawnProgress += 0.005;     // Adjust speed of growth (~3-4 seconds at 60fps)
            if (spawnProgress > 1) spawnProgress = 1;
        }

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
        var rect = canvas.parentElement.getBoundingClientRect();
        var initialW = rect.width;
        var scale = Math.max(0.3, Math.min(initialW / 1920, 1.2));
        STAR_COUNT = Math.floor(600 * scale);
        // Reduced base rain count for elegant, spacious sparsity
        RAIN_COUNT = Math.floor(250 * scale);

        resize();
        currentMode = getMode();
        if (currentMode === 'dark') {
            initStars();
        } else {
            initRain();
        }
        loop();
        isInitialised = true;

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
