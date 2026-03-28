/**
 * Navbar Logic - Refined Dynamic States
 * - AT_TOP: scrollY < 200
 * - FLOATING: scrollY >= 200 (Active state)
 * - HIDDEN: Hidden after continuous downward scroll
 */

(function () {
    const header = document.querySelector('.site-header');
    if (!header) return;

    // Configuration
    const TOP_THRESHOLD = 200;    // Scroll distance to trigger floating mode
    const HIDE_DISTANCE = 800;    // Continuous downward scroll to hide
    const MOUSE_THRESHOLD = 60;   // Pixels from top to reveal
    const BREAKPOINT = 1024;      // Mobile breakpoint

    let lastScrollY = window.scrollY;
    let accumulatedDown = 0;
    let isMobile = window.innerWidth < BREAKPOINT;
    let topTimer = null; // Timer for return-to-top delay

    function updateNavbar() {
        if (isMobile) {
            header.className = 'site-header';
            return;
        }

        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;

        if (currentScrollY <= 20) {
            // Reached the very top - revert to integrated style AFTER a delay
            if (header.classList.contains('floating') || header.classList.contains('hidden')) {
                if (!topTimer) {
                    topTimer = setTimeout(() => {
                        header.className = 'site-header';
                        topTimer = null;
                        accumulatedDown = 0;
                    }, 1000); // 1-second delay
                }
            } else {
                header.className = 'site-header';
            }
        } else {
            // Not at the very top, cancel any pending return-to-top timer
            if (topTimer) {
                clearTimeout(topTimer);
                topTimer = null;
            }

            if (currentScrollY < TOP_THRESHOLD) {
                // In the "transition zone", keep floating if we are already floating 
                // until we hit the <= 5px mark for the delayed return.
                if (!header.classList.contains('floating') && !header.classList.contains('hidden')) {
                    header.className = 'site-header';
                }
            } else {
                // Past Top Threshold
                if (delta < -10) {
                    // Scrolling UP - instantly show as floating
                    header.className = 'site-header floating';
                    accumulatedDown = 0;
                } else if (delta > 10) {
                    // Scrolling DOWN
                    if (header.classList.contains('floating')) {
                        accumulatedDown += delta;
                        if (accumulatedDown > HIDE_DISTANCE) {
                            header.className = 'site-header hidden';
                        }
                    } else if (!header.classList.contains('hidden')) {
                        // Coming from AT_TOP past 200px
                        header.className = 'site-header floating';
                    }
                }
            }
        }

        lastScrollY = currentScrollY;
    }

    // Mouse reveal logic
    window.addEventListener('mousemove', (e) => {
        if (isMobile) return;
        if (e.clientY < MOUSE_THRESHOLD && window.scrollY > TOP_THRESHOLD) {
            header.classList.remove('hidden');
            header.classList.add('floating');
            accumulatedDown = 0;
        }
    });

    // Resize handler
    window.addEventListener('resize', () => {
        isMobile = window.innerWidth < BREAKPOINT;
        updateNavbar();
    });

    // Throttled scroll
    let ticking = false;
    // Global scroll listener with Lenis compatibility
    function onScrollUpdate() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateNavbar();
                ticking = false;
            });
            ticking = true;
        }
    }

    // Connect to Lenis if it exists (for perfect synchronization)
    if (window.lenis) {
        window.lenis.on('scroll', updateNavbar);
    } else {
        window.addEventListener('scroll', onScrollUpdate, { passive: true });
    }

    // Initial check
    updateNavbar();
})();
