/**
 * Website Entry Loader Orchestrator
 * Synchronizes rhythmic animations with background resource loading.
 */

(function () {
    'use strict';

    // Configuration
    // Reduced to 1500ms(1.5s) for a snappier reveal while keeping the premium line animation
    const MIN_ANIMATION_TIME = 1500; 
    const SAFETY_TIMEOUT = 3000;      // Don't keep the user waiting longer than 3s
    const startTime = Date.now();

    /**
     * Tracks critical assets (minimal floor to ensure animation visibility)
     */
    async function trackResources() {
        const resources = [];

        // 1. Minimum Display Timer (to show line expansion)
        const timerPromise = new Promise(resolve => {
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, MIN_ANIMATION_TIME - elapsed);
            setTimeout(resolve, remaining);
        });
        resources.push(timerPromise);

        // Wait for timer or safety timeout
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
