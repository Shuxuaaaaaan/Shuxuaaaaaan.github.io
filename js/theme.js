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
  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
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
