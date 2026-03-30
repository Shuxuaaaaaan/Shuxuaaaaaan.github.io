/**
 * Smooth Scroll Implementation using Lenis
 * Provides momentum-based scrolling for a premium feel.
 */

(function () {
    // Initialize Lenis
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // https://www.desmos.com/calculator/brs54l4xou
        direction: 'vertical', // vertical, horizontal
        gestureDirection: 'vertical', // vertical, horizontal, both
        smoothIndicator: true,
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 2,
        infinite: false,
    });

    // Integrated with the browser's animation frame
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Synchronize with anchor links (optional, Lenis handles this by default usually)
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            // If the href is just # or it's been changed by JS to a real URL, don't intercept
            if (!targetId || !targetId.startsWith('#') || targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                lenis.scrollTo(targetElement, {
                    offset: -100, // Matching scroll-padding-top in CSS
                    duration: 1.5,
                });
            }
        });
    });

    // Scroll indicator interaction
    const scrollIndicator = document.querySelector('.hero__scroll-indicator');
    if (scrollIndicator) {
        scrollIndicator.addEventListener('click', () => {
            const articles = document.querySelector('#articles');
            if (articles) {
                lenis.scrollTo(articles, {
                    offset: -100,
                    duration: 1.5,
                });
            }
        });
    }

    // Expose lenis globally if needed for other scripts
    window.lenis = lenis;
})();
