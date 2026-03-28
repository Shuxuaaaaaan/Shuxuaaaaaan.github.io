/**
 * uptime.js — Handles Unix timestamp and site uptime display.
 * 
 * Target: index.html elements #unix-timestamp and #site-uptime
 */

(function () {
    // Site creation: 2026-02-11 16:46:00 GMT+8
    const BIRTHDAY = new Date('2026-02-11T16:46:00+08:00');

    function updateStatus() {
        const now = new Date();

        // 1. Unix Timestamp
        const unixEl = document.getElementById('unix-timestamp');
        if (unixEl) {
            unixEl.textContent = Math.floor(now.getTime() / 1000);
        }

        // 2. Uptime Calculation
        const uptimeEl = document.getElementById('site-uptime');
        if (uptimeEl) {
            const diffMs = now - BIRTHDAY;
            if (diffMs < 0) {
                uptimeEl.textContent = 'Just started';
                return;
            }

            const diffSec = Math.floor(diffMs / 1000);
            const days = Math.floor(diffSec / 86400);
            const hours = Math.floor((diffSec % 86400) / 3600);
            const minutes = Math.floor((diffSec % 3600) / 60);
            const seconds = diffSec % 60;

            uptimeEl.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;
        }
    }

    // Update every second
    setInterval(updateStatus, 1000);

    // Initial call
    updateStatus();
})();
