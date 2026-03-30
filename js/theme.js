/**
 * theme.js — Dark mode manager
 *
 * Priority:
 *   1. localStorage persisted preference
 *   2. System prefers-color-scheme
 *   3. Default to light
 */

(function () {
  'use strict';

  const STORAGE_KEY = 'theme';

  /**
   * Apply the given theme ('light' | 'dark') to <html>.
   */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Return the current resolved theme.
   */
  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  /**
   * Toggle between light and dark, persist to localStorage.
   */
  function toggleTheme(event) {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';

    const actualToggle = () => {
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
    };

    // If View Transitions API is not supported, just toggle normally
    if (!document.startViewTransition) {
      actualToggle();
      return;
    }

    // Get the click position, or default to the button's center if event is missing
    const x = event?.clientX ?? window.innerWidth / 2;
    const y = event?.clientY ?? window.innerHeight / 2;

    // Calculate distance to the farthest corner
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // Create the transition
    const transition = document.startViewTransition(() => {
      document.documentElement.classList.add('theme-transitioning');
      actualToggle();
    });

    transition.finished.finally(() => {
      document.documentElement.classList.remove('theme-transitioning');
    });

    // Wait for the transition to be ready
    transition.ready.then(() => {
      const clipPath = [
        `circle(0px at ${x}px ${y}px)`,
        `circle(${endRadius}px at ${x}px ${y}px)`,
      ];

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 400,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    });
  }

  // --- Initialise on load ---
  applyTheme(getPreferredTheme());

  // Listen for system theme changes (when no localStorage override)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  // Expose toggle for the header button
  window.toggleTheme = toggleTheme;
})();
