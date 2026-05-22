/**
 * bgm.js — Elegant BGM Controller with Web Audio API Real Rhythm Visualizer
 * 
 * Features:
 *  1. Clean, responsive zero-lag BGM control without volume fading.
 *  2. Smart bypass of browser autoplay policies with mobile protection.
 *  3. Dynamic Floating-in CSS Transition powered by double requestAnimationFrame.
 *  4. Advanced Rhythmic Spectrum Visualizer using Web Audio API and physics damping.
 *  5. Immediate pause on opening any article cards, no automatic resumption.
 *  6. Seamlessly synchronized startup with the elegant hero title fade-in.
 */

(function () {
    'use strict';

    // Configuration Constants
    const AUDIO_SRC = './assets/audio/FEARLESS - LE SSERAFIM.mp3';
    const SONG_TITLE = 'FEARLESS';
    const SONG_ARTIST = 'LE SSERAFIM';
    const TARGET_VOLUME = 0.5; // Optimal listening volume (max volume limit)

    // Internal State Variables
    let audio = null;
    let container = null;
    let playBtn = null;
    let isMobileDevice = false;
    let hasInteracted = false;

    // Web Audio API State Variables
    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    let dataArray = null;
    let animationFrameId = null;
    let visualizerBars = [];

    // Physics Visualizer Interpolation Array (6 Symmetric Bars)
    let currentScales = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];

    // Volume Fader Timer Reference
    let fadeInterval = null;

    /**
     * Detects if the current user agent is a mobile device or screen is narrow.
     */
    function detectDevice() {
        const checkUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const checkWidth = window.innerWidth <= 768;
        isMobileDevice = checkUserAgent || checkWidth;
    }

    /**
     * One-time initialization of Web Audio API to prevent "already connected" errors.
     */
    function initWebAudio() {
        if (audioCtx) return; // Safeguard

        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            audioCtx = new AudioContextClass();
            analyser = audioCtx.createAnalyser();
            
            // Concentrate FFT to yield sharp, localized energy peaks
            analyser.fftSize = 64; 

            sourceNode = audioCtx.createMediaElementSource(audio);
            sourceNode.connect(analyser);
            analyser.connect(audioCtx.destination);

            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
        } catch (e) {
            console.error('Failed to initialize Web Audio API for visualizer:', e);
        }
    }

    /**
     * Smoothly transitions the audio volume to a target value over a duration.
     * Guaranteed lag-free interpolation using interval frame timings.
     */
    function fadeVolumeTo(targetVal, durationMs, onComplete) {
        if (!audio) return;
        
        if (fadeInterval) {
            clearInterval(fadeInterval);
            fadeInterval = null;
        }

        if (durationMs <= 0) {
            audio.volume = targetVal;
            if (onComplete) onComplete();
            return;
        }

        const startVal = audio.volume;
        const diff = targetVal - startVal;
        const stepTime = 16; // ~60fps
        const totalSteps = durationMs / stepTime;
        let currentStep = 0;

        fadeInterval = setInterval(() => {
            currentStep++;
            if (currentStep >= totalSteps) {
                audio.volume = targetVal;
                clearInterval(fadeInterval);
                fadeInterval = null;
                if (onComplete) onComplete();
            } else {
                const ratio = currentStep / totalSteps;
                audio.volume = startVal + diff * ratio;
            }
        }, stepTime);
    }

    /**
     * High-performance frequency animation loop synchronized with the screen refresh rate.
     * Incorporates gain compensation and physical damping for elegant bounce physics.
     * Ensures iOS Dynamic Island visual contour (high in the middle, low on both sides).
     */
    function updateVisualizer() {
        if (!audio || audio.paused || !analyser || !dataArray || visualizerBars.length === 0) {
            stopVisualizerLoop();
            return;
        }

        animationFrameId = requestAnimationFrame(updateVisualizer);

        // Resume AudioContext if suspended (browser user interaction security bypass)
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        analyser.getByteFrequencyData(dataArray);

        // 6 Bars FFT indices mapping: 从左到右低音到高音 (1=Bass, 15=Treble)
        const indices = [1, 2, 4, 7, 10, 15];
        
        // Calibrated multipliers to avoid clipping/saturation and keep visualizer breathing
        const multipliers = [0.70, 0.85, 1.05, 1.35, 1.70, 2.20];
        
        // Golden ratio frequency envelope that naturally maintains a beautiful staggered curve
        const maxScaleYLimits = [0.85, 0.95, 0.90, 0.80, 0.70, 0.60];
        const minScaleYLimits = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
        
        for (let i = 0; i < visualizerBars.length; i++) {
            const bar = visualizerBars[i];
            const dataIndex = indices[i];
            const rawValue = dataArray[dataIndex] || 0;
            
            // Compensate amplitude
            const boostedValue = Math.min(255, rawValue * multipliers[i]);
            const dynamicFactor = boostedValue / 255;
            
            // Map strictly inside contour limits using 1.6 power-law soft compression
            const targetScaleY = minScaleYLimits[i] + Math.pow(dynamicFactor, 1.6) * (maxScaleYLimits[i] - minScaleYLimits[i]);
            
            // Physics Non-Symmetrical Damping Interpolation:
            // Rise immediately on beats (0.7 responsiveness), settle down gently and smoothly (0.18 response)
            if (targetScaleY > currentScales[i]) {
                currentScales[i] = currentScales[i] * 0.3 + targetScaleY * 0.7;
            } else {
                currentScales[i] = currentScales[i] * 0.82 + targetScaleY * 0.18;
            }
            
            bar.style.transform = `scaleY(${currentScales[i]})`;
        }
    }

    /**
     * Pauses frequency animation and resets the visualizer bars to minimum height.
     */
    function stopVisualizerLoop() {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        
        // Settle all bars smoothly to static elegant flat layout
        currentScales = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
        visualizerBars.forEach((bar, i) => {
            bar.style.transform = `scaleY(${currentScales[i]})`;
        });

        // Set global sync state to stopped
        if (window.bgmData) {
            window.bgmData.isPlaying = false;
            window.bgmData.currentScales = [0.15, 0.15, 0.15, 0.15, 0.15, 0.15];
        }
    }

    /**
     * Initiates audio playback + visualizer loop with optional volume fade-in.
     */
    /**
     * Awaits first physical transient activation to unmute the automatically started audio.
     * Smoothly fades BGM in using a premium 0.5s volume gradient.
     */
    function setupMutedUnlock() {
        if (hasInteracted) return;

        const unlockEvents = ['click', 'touchstart', 'keydown', 'wheel', 'mousedown'];
        
        const unmute = () => {
            if (hasInteracted) return;
            hasInteracted = true;

            // Remove events immediately
            unlockEvents.forEach(evt => document.removeEventListener(evt, unmute));

            if (audio) {
                audio.muted = false;
                audio.volume = 0;
                fadeVolumeTo(TARGET_VOLUME, 500); // 0.5s from silent to premium target volume
            }
        };

        unlockEvents.forEach(evt => document.addEventListener(evt, unmute, { passive: true }));
    }

    /**
     * Initiates audio playback + visualizer loop with optional volume fade-in.
     * Uses muted autoplay bypass technique to guarantee 100% startup on desktop browsers.
     */
    function playBgm(useFade = false) {
        if (!audio) return;
        
        // Web Audio API must be initialized at first playback trigger
        initWebAudio();
        
        let isMutedAttempt = false;
        if (!useFade) {
            // Desktop automatic start: play muted first to guarantee 100% bypass of autoplay blocks
            audio.muted = true;
            isMutedAttempt = true;
            audio.volume = TARGET_VOLUME;
        } else {
            // Manual trigger: ensure unmuted, start volume from 0 to smoothly fade in
            audio.muted = false;
            audio.volume = 0;
        }
        
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                updateUIState(true);
                
                // Initialize global BGM data sharing
                window.bgmData = {
                    isPlaying: true,
                    currentScales: currentScales
                };

                // Active AudioContext and start real music rhythm visualizer loop
                if (audioCtx) {
                    audioCtx.resume().then(() => {
                        updateVisualizer();
                    });
                }

                if (isMutedAttempt) {
                    setupMutedUnlock();
                } else if (useFade) {
                    fadeVolumeTo(TARGET_VOLUME, 500); // 0.5s fade-in
                }
            }).catch((err) => {
                console.warn('Autoplay blocked even with muted bypass attempt.', err);
                updateUIState(false);
                setupInteractionUnlock();
            });
        } else {
            // Fallback for older browsers
            updateUIState(true);
            window.bgmData = {
                isPlaying: true,
                currentScales: currentScales
            };
            updateVisualizer();
            if (isMutedAttempt) {
                setupMutedUnlock();
            } else if (useFade) {
                fadeVolumeTo(TARGET_VOLUME, 500);
            }
        }
    }

    /**
     * Pauses audio playback immediately or smoothly fades out.
     */
    function pauseBgm(useFade = false, fadeDuration = 500) {
        if (!audio || audio.paused) return;
        
        if (useFade) {
            // Update UI & visualizer immediately for zero-lag sensory feedback
            updateUIState(false);
            stopVisualizerLoop();

            // Transition volume in background, then completely pause
            fadeVolumeTo(0, fadeDuration, () => {
                audio.pause();
            });
        } else {
            if (fadeInterval) {
                clearInterval(fadeInterval);
                fadeInterval = null;
            }
            audio.pause();
            audio.volume = 0;
            updateUIState(false);
            stopVisualizerLoop();
        }
    }

    /**
     * Awaits first physical interaction with the page to bypass desktop autoplay blocks.
     */
    function setupInteractionUnlock() {
        if (hasInteracted || isMobileDevice) return;

        const unlockEvents = ['click', 'touchstart', 'keydown', 'wheel'];
        
        const unlock = () => {
            if (hasInteracted) return;
            hasInteracted = true;

            // Remove events listeners immediately
            unlockEvents.forEach(evt => document.removeEventListener(evt, unlock));

            // Start playing manually (0.5s fade-in)
            if (audio && audio.paused) {
                playBgm(true);
            }
        };

        unlockEvents.forEach(evt => document.addEventListener(evt, unlock, { passive: true }));
    }

    /**
     * Main Play/Pause controller toggling function with 0.5s manual fading.
     */
    function togglePlayback() {
        if (!audio) return;
        if (audio.paused) {
            playBgm(true); // 0.5s manual fade-in
        } else {
            pauseBgm(true, 500); // 0.5s manual fade-out
        }
    }

    /**
     * Updates the DOM classes and SVG play/pause symbols to reflect playback state.
     */
    function updateUIState(isPlaying) {
        if (!container || !playBtn) return;
        
        if (isPlaying) {
            container.classList.add('playing');
            // Pause icon
            playBtn.innerHTML = `
                <svg class="icon-pause" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                    <rect x="14" y="4" width="4" height="16" rx="1"></rect>
                </svg>
            `;
            playBtn.setAttribute('title', '暂停 BGM');
        } else {
            container.classList.remove('playing');
            // Play icon
            playBtn.innerHTML = `
                <svg class="icon-play" viewBox="0 0 24 24" style="margin-left: 2px;">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            `;
            playBtn.setAttribute('title', '播放 BGM');
        }
    }

    /**
     * MutationObserver to pause playback smoothly (2.0s slow fade-out) upon opening details modal.
     * When modal closes, the BGM remains paused, satisfying user request.
     */
    function setupSmartVolumeObserver() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class' && audio) {
                    const isModalActive = document.body.classList.contains('modal-open');
                    if (isModalActive && !audio.paused) {
                        // Gently fade out audio in 2 seconds upon opening article details
                        pauseBgm(true, 2000);
                    }
                }
            });
        });

        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }

    /**
     * Dynamic DOM Creation and event bindings.
     */
    function createBgmController() {
        if (document.getElementById('bgm-player-box')) return;

        detectDevice();

        // 1. Create Audio Node
        audio = document.createElement('audio');
        audio.src = AUDIO_SRC;
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = TARGET_VOLUME;
        document.body.appendChild(audio);

        // 2. Create UI Node (6 Bars Symmetric Visualizer)
        container = document.createElement('div');
        container.id = 'bgm-player-box';
        container.className = 'bgm-player';
        container.setAttribute('aria-label', '背景音乐播放器');

        container.innerHTML = `
            <!-- Left Side: Real Music Rhythm Visualizer Bars (6 Bars) -->
            <div class="bgm-player__visualizer" id="bgm-visuals" title="音乐频谱（iOS 灵动岛对称）">
                <span class="bgm-player__bar"></span>
                <span class="bgm-player__bar"></span>
                <span class="bgm-player__bar"></span>
                <span class="bgm-player__bar"></span>
                <span class="bgm-player__bar"></span>
                <span class="bgm-player__bar"></span>
            </div>

            <!-- Central Section: Metadata Info -->
            <div class="bgm-player__info" title="${SONG_TITLE} - ${SONG_ARTIST}">
                <span class="bgm-player__title">${SONG_TITLE}</span>
                <span class="bgm-player__artist">${SONG_ARTIST}</span>
            </div>

            <!-- Right Side: Clean Play/Pause Control Button -->
            <button class="bgm-player__btn" id="bgm-play-btn" aria-label="播放或暂停背景音乐" title="播放 BGM">
                <svg class="icon-play" viewBox="0 0 24 24" style="margin-left: 2px;">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
            </button>
        `;

        document.body.appendChild(container);

        // Cache visualizer bars DOM and play button DOM references
        visualizerBars = Array.from(container.querySelectorAll('.bgm-player__bar'));
        playBtn = document.getElementById('bgm-play-btn');

        // Render initial elegant static visualizer contour heights
        visualizerBars.forEach((bar, i) => {
            bar.style.transform = `scaleY(${currentScales[i]})`;
        });

        // Bind Play/Pause events
        playBtn.addEventListener('click', togglePlayback);

        // Double requestAnimationFrame to ensure the browser paints the initial state 
        // before transitioning, preventing the container from abruptly flashing.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (container) {
                    container.classList.add('ready');
                }
            });
        });
    }

    /**
     * BGM Lifecycle Initialization.
     * Starts immediately after the site loader completes, synchronized with the elegant hero title.
     */
    function init() {
        detectDevice();

        const handleStart = () => {
            // Introduce a 300ms delay to shift heavy DOM creation away from critical page reveal.
            setTimeout(() => {
                createBgmController();
                setupSmartVolumeObserver();

                // Shift heavy Web Audio API and play() call away from CSS Transition animation.
                // Ensures full frame rate for both player slide-in and hero background canvas.
                setTimeout(() => {
                    if (isMobileDevice) {
                        console.log('Mobile device detected. BGM loaded silently. Waiting for manual trigger.');
                        updateUIState(false);
                    } else {
                        // Desktop device: automatically play immediately WITHOUT volume fading
                        playBgm(false);
                    }
                }, 900);
            }, 300);
        };

        // Delay until entry loader overlay split reveal completes (matches hero title elegant fade-in timeline)
        window.addEventListener('site-reveal-complete', handleStart, { once: true });

        // Safety fallback: in case event is missed or already fired
        setTimeout(() => {
            if (!container) {
                console.log('Loader safety callback triggered for BGM controller initialization');
                handleStart();
            }
        }, 3500);
    }

    // Execute synchronizing with DOM interactive state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
