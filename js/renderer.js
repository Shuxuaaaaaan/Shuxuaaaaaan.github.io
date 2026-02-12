/**
 * renderer.js — Markdown fetcher & renderer for post.html
 *
 * Reads `?path=<relative-path-to-md>` from URL params,
 * fetches the .md file, strips frontmatter, and renders with marked.js.
 * Resolves relative image/link paths based on the md file's directory.
 */

(function () {
    'use strict';

    var OWNER = 'Shuxuaaaaaan';
    var REPO = 'Shuxuaaaaaan.github.io';
    var BRANCH = 'main';

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
     * Resolve a potentially relative URL against the md file's raw directory.
     */
    function resolveUrl(href, baseDir) {
        // Already absolute
        if (/^https?:\/\//.test(href) || href.startsWith('//')) return href;
        // Data URIs
        if (href.startsWith('data:')) return href;
        // Resolve relative path
        return baseDir + '/' + href.replace(/^\.\//, '');
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
            // Build raw URL and base directory for relative path resolution
            var rawBase = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/';
            var rawUrl = rawBase + mdPath;
            // Directory containing the md file (for resolving relative images)
            var pathParts = mdPath.split('/');
            pathParts.pop(); // remove filename
            var rawDir = rawBase + pathParts.join('/');

            const response = await fetch(rawUrl);

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

            // Custom renderer to resolve relative image/link paths
            const renderer = new marked.Renderer();
            renderer.image = function (token) {
                var src = resolveUrl(token.href, rawDir);
                var alt = token.text || '';
                var titleAttr = token.title ? ' title="' + token.title + '"' : '';
                return '<img src="' + src + '" alt="' + alt + '"' + titleAttr + ' />';
            };

            var originalLink = new marked.Renderer().link;
            renderer.link = function (token) {
                // Only resolve links that look like relative file paths
                if (token.href && !token.href.startsWith('#') && !/^https?:\/\//.test(token.href) && !token.href.startsWith('//')) {
                    token.href = resolveUrl(token.href, rawDir);
                }
                return originalLink.call(this, token);
            };

            // Render markdown (without frontmatter)
            contentEl.innerHTML = marked.parse(body, { renderer: renderer });

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

