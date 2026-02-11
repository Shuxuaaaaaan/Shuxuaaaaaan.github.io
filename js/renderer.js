/**
 * renderer.js — Markdown fetcher & renderer for post.html
 *
 * Reads `?path=<relative-path-to-md>` from URL params,
 * fetches the .md file, strips frontmatter, and renders with marked.js.
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
     * Parse and strip YAML-like frontmatter (--- delimited block).
     * Returns { meta: {key: value}, body: "remaining markdown" }
     */
    function parseFrontmatter(text) {
        const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
        if (!match) return { meta: {}, body: text };

        const meta = {};
        match[1].split(/\r?\n/).forEach(function (line) {
            const idx = line.indexOf(':');
            if (idx > 0) {
                meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
            }
        });

        return { meta: meta, body: match[2] };
    }

    /**
     * Extract an H1 title from markdown text (fallback).
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

            // Parse frontmatter & strip it from body
            const { meta, body } = parseFrontmatter(mdText);

            // Update page title (frontmatter title > H1 > default)
            const heading = meta.title || extractTitle(body);
            if (heading) {
                titleEl.textContent = heading + ' — Shuxuan';
            }

            // Render markdown (without frontmatter)
            contentEl.innerHTML = marked.parse(body);

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
