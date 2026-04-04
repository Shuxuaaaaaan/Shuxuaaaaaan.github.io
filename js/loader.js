/**
 * Website Entry Loader Orchestrator
 * Synchronizes rhythmic animations with background resource loading.
 */

(function () {
    'use strict';

    // Configuration
    // Changed to 2500ms(2.5s): 0.5s (pre-delay) + 2s (expansion)
    const MIN_ANIMATION_TIME = 2500; 
    const SAFETY_TIMEOUT = 5000;      // Don't keep the user waiting longer than 5s
    const startTime = Date.now();

    /**
     * Tracks critical assets (fonts, data, images)
     */
    async function trackResources() {
        const resources = [];

        // 1. Wait for Fonts
        if (document.fonts && document.fonts.ready) {
            resources.push(document.fonts.ready);
        }

        // 2. Wait for Content Data (from cards.js)
        if (window.contentLoadedPromise) {
            resources.push(window.contentLoadedPromise);
        } else {
            // If cards.js hasn't defined it yet, wait for it or timeout
            resources.push(new Promise(resolve => {
                let attempts = 0;
                const check = () => {
                    if (window.contentLoadedPromise) resolve(window.contentLoadedPromise);
                    else if (attempts++ < 50) setTimeout(check, 20); // Check for 1s
                    else resolve(); // Progressive enhancement
                };
                check();
            }));
        }

        // 3. Minimum Display Timer
        const timerPromise = new Promise(resolve => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, MIN_ANIMATION_TIME - elapsed);
            setTimeout(resolve, remaining);
        });
        resources.push(timerPromise);

        // Wait for all or safety timeout
        await Promise.race([
            Promise.all(resources),
            new Promise(resolve => setTimeout(resolve, SAFETY_TIMEOUT))
        ]);
    }

    /**
     * Triggers the final "split and reveal" sequence
     */
    function revealSite() {
        const body = document.body;
        const loader = document.getElementById('loader');
        
        if (!body || body.classList.contains('loaded')) return;

        // Start CSS slide animations
        body.classList.add('loaded');

        // Cleanup DOM after slide completes (1.0s in CSS)
        setTimeout(() => {
            if (loader) {
                loader.remove();
            }
            body.classList.remove('loading');
            
            // Dispatch event for other listeners (parallax, Lenis, etc)
            window.dispatchEvent(new CustomEvent('site-reveal-complete'));
        }, 1000);
    }

    // Execution starts as soon as DOM is interactive
    const init = async () => {
        await trackResources();
        revealSite();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
