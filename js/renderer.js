/**
 * renderer.js — Markdown fetcher & renderer for post.html
 *
 * Reads `?path=<relative-path-to-md>` from URL params,
 * fetches the .md file, and renders it with marked.js.
 */

(function () {
    'use strict';

    const contentEl = document.getElementById('post-content');
    const titleEl = document.querySelector('title');

    /**
     * Show friendly 404 state.
     */
    function showError(message) {
        contentEl.innerHTML = `
      <div class="error-state">
        <div class="error-state__code">404</div>
        <p class="error-state__message">${message}</p>
        <a href="./index.html" class="error-state__link">← 返回首页</a>
      </div>
    `;
    }

    /**
     * Show loading skeleton.
     */
    function showLoading() {
        contentEl.innerHTML = `
      <div class="loading-skeleton">
        <div class="skel-line"></div>
        <div class="skel-line"></div>
        <div class="skel-line"></div>
        <div class="skel-line"></div>
        <div class="skel-line"></div>
      </div>
    `;
    }

    /**
     * Extract an H1 title from markdown text.
     */
    function extractTitle(md) {
        const match = md.match(/^#\s+(.+)$/m);
        return match ? match[1] : null;
    }

    /**
     * Main entry — fetch and render.
     */
    async function init() {
        const params = new URLSearchParams(window.location.search);
        const mdPath = params.get('path');

        if (!mdPath) {
            showError('未指定文章路径。');
            return;
        }

        showLoading();

        try {
            const response = await fetch(mdPath);

            if (!response.ok) {
                showError('找不到该文章，请检查链接是否正确。');
                return;
            }

            const mdText = await response.text();

            // Update page title
            const heading = extractTitle(mdText);
            if (heading) {
                titleEl.textContent = heading + ' — Shuxuan';
            }

            // Render markdown
            contentEl.innerHTML = marked.parse(mdText);

        } catch (err) {
            console.error('Failed to load markdown:', err);
            showError('加载失败，请检查网络连接。');
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
