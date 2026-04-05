/**
 * Website Entry Loader Orchestrator
 * Synchronizes rhythmic animations with background resource loading.
 */

(function () {
    'use strict';

    // Configuration
    // Always play loader animation on each homepage open.
    const MIN_ANIMATION_TIME = 1200;
    const PANEL_ANIMATION_TIME = 720;
    const SAFETY_TIMEOUT = 2300;
    let startTime = 0;
    let safetyTimer = null;
    let isRevealed = false;

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

        // If body doesn't exist yet, wait and try again
        if (!body) {
            if (Date.now() - startTime < SAFETY_TIMEOUT) {
                setTimeout(revealSite, 50);
            }
            return;
        }

        if (isRevealed || body.classList.contains('loaded')) return;
        isRevealed = true;

        // Start CSS slide animations
        body.classList.add('loaded');

        const cleanup = () => {
            if (loader) {
                loader.remove();
            }
            body.classList.remove('loader-active');
            body.classList.remove('loading');

            // Dispatch event for other listeners (parallax, Lenis, etc)
            window.dispatchEvent(new CustomEvent('site-reveal-complete'));
        };

        if (PANEL_ANIMATION_TIME > 0) {
            setTimeout(cleanup, PANEL_ANIMATION_TIME);
        } else {
            cleanup();
        }
    }

    // Execution starts as soon as DOM is interactive
    const init = async () => {
        const body = document.body;
        if (!body) return;

        startTime = Date.now();
        body.classList.add('loader-active');

        if (safetyTimer) {
            clearTimeout(safetyTimer);
        }
        safetyTimer = setTimeout(() => {
            if (!isRevealed) {
                console.log('Loader safety fallback triggered');
                revealSite();
            }
        }, SAFETY_TIMEOUT + 500);

        try {
            await trackResources();
        } catch (e) {
            console.warn('Loader resource tracking failed:', e);
        } finally {
            revealSite();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
