/**
 * Navbar Logic - Refined Dynamic States
 * - INLINE: scrollY < heroHeight
 * - STUCK: heroHeight <= scrollY < heroHeight + DWELL_DISTANCE (Full-width sticky bar)
 * - FLOATING: scrollY >= heroHeight + DWELL_DISTANCE (Mini-card mode, Desktop only)
 * - HIDDEN: Hidden after continuous downward scroll (Desktop only)
 */

(function () {
    const header = document.querySelector('.site-header');
    if (!header) return;

    // Configuration
    const HIDE_DISTANCE = 800;    // Continuous downward scroll to hide
    const MOUSE_THRESHOLD = 60;   // Pixels from top to reveal
    const BREAKPOINT = 1024;      // Mobile breakpoint
    const DWELL_DISTANCE = 100;   // Pixels to stay stuck before floating

    let lastScrollY = window.scrollY;
    let accumulatedDown = 0;
    let isMobile = window.innerWidth < BREAKPOINT;

    function updateNavbar() {
        const isWide = window.innerWidth >= 1024;
        const currentScrollY = window.scrollY;
        const delta = currentScrollY - lastScrollY;
        const heroHeight = window.innerHeight;

        // Configuration
        const deskDepth = 80;    // Desktop submersion
        const deskFloat = 16;   // Desktop floating top
        const mobDepth = 48;     // Mobile submersion
        const mobFloat = 0;      // Mobile sticky top (no gap)

        if (isWide) {
            // Desktop: Pure 1:1 Sync (No state-switch jumps)
            // Initial position is heroHeight + 80px into the article content.
            // As we scroll, top value relative to viewport decreases.
            const targetTop = Math.max(deskFloat, (heroHeight + deskDepth) - currentScrollY);
            header.style.top = `${targetTop}px`;

            if (targetTop <= deskFloat) {
                // At the floating threshold: Handle reveal/hide logic
                if (delta < -10) {
                    // Scrolling UP - reveal
                    header.className = 'site-header floating';
                    accumulatedDown = 0;
                } else if (delta > 10) {
                    // Scrolling DOWN - potential hide
                    if (header.classList.contains('floating')) {
                        accumulatedDown += delta;
                        if (accumulatedDown > HIDE_DISTANCE) {
                            header.className = 'site-header hidden';
                        }
                    } else if (!header.classList.contains('hidden')) {
                        header.className = 'site-header floating';
                    }
                } else if (!header.classList.contains('hidden')) {
                    header.className = 'site-header floating';
                }
            } else {
                // Above floating threshold: Reset to base state
                header.className = 'site-header';
                accumulatedDown = 0;
            }
        } else {
            // Mobile/Small Window: 1:1 Sync
            const targetTop = Math.max(mobFloat, (heroHeight + mobDepth) - currentScrollY);
            header.style.top = `${targetTop}px`;

            if (targetTop <= mobFloat) {
                header.className = 'site-header stuck';
                accumulatedDown = 0;
            } else {
                header.className = 'site-header';
                accumulatedDown = 0;
            }
        }

        // Final reveal: Only show the header once the first JS calculation has positioned it correctly
        if (header.style.opacity !== '1') {
            header.style.opacity = '1';
        }

        lastScrollY = currentScrollY;
    }

    // Mouse reveal logic
    window.addEventListener('mousemove', (e) => {
        if (isMobile) return;
        const threshold = window.innerHeight + DWELL_DISTANCE;
        if (e.clientY < MOUSE_THRESHOLD && window.scrollY > threshold) {
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
    function onScrollUpdate() {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                updateNavbar();
                ticking = false;
            });
            ticking = true;
        }
    }

    // Connect to Lenis if it exists
    if (window.lenis) {
        window.lenis.on('scroll', updateNavbar);
    } else {
        window.addEventListener('scroll', onScrollUpdate, { passive: true });
    }

    // Initial check
    updateNavbar();
})();
