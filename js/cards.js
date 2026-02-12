/**
 * cards.js — Auto-discover markdown files via GitHub API & render cards
 *
 * Flow:
 *   1. Call GitHub Trees API (recursive) to list all .md files
 *   2. Fetch raw content from raw.githubusercontent.com
 *   3. Parse YAML-like frontmatter (title, description, tag, date)
 *   4. Render cards into scroll tracks, sorted by date descending
 *   5. Cache results in sessionStorage (5 min TTL)
 */

(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────
    var OWNER = 'Shuxuaaaaaan';
    var REPO = 'Shuxuaaaaaan.github.io';
    var BRANCH = 'main';
    var CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    var SECTIONS = [
        { dir: 'articles', trackId: 'articles-track' },
        { dir: 'works', trackId: 'projects-track' }
    ];

    // ── Frontmatter parser ────────────────────────────────────
    function parseFrontmatter(text) {
        var match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!match) return {};
        var meta = {};
        match[1].split(/\r?\n/).forEach(function (line) {
            var idx = line.indexOf(':');
            if (idx > 0) {
                var key = line.slice(0, idx).trim();
                var val = line.slice(idx + 1).trim();
                meta[key] = val;
            }
        });
        return meta;
    }

    // ── Cache helpers ─────────────────────────────────────────
    function cacheGet(key) {
        try {
            var raw = sessionStorage.getItem(key);
            if (!raw) return null;
            var obj = JSON.parse(raw);
            if (Date.now() - obj.ts > CACHE_TTL) {
                sessionStorage.removeItem(key);
                return null;
            }
            return obj.data;
        } catch (e) { return null; }
    }

    function cacheSet(key, data) {
        try {
            sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
        } catch (e) { /* quota exceeded, ignore */ }
    }

    // ── Card HTML builder ─────────────────────────────────────
    function buildCard(item) {
        var a = document.createElement('a');
        a.href = './post.html?path=' + encodeURIComponent(item.path);
        a.className = 'card';

        var tag = document.createElement('span');
        tag.className = 'card__tag';
        tag.textContent = item.tag || '未分类';

        var title = document.createElement('h3');
        title.className = 'card__title';
        title.textContent = item.title || '无标题';

        var desc = document.createElement('p');
        desc.className = 'card__desc';
        desc.textContent = item.description || '';

        // Date element
        var date = document.createElement('span');
        date.className = 'card__date';
        date.textContent = item.date || '';

        a.appendChild(tag);
        a.appendChild(title);
        a.appendChild(desc);
        a.appendChild(date);

        return a;
    }

    // ── Render cards into a track ─────────────────────────────
    function renderCards(trackId, items) {
        var track = document.getElementById(trackId);
        if (!track) return;

        // Clear loading skeleton
        track.innerHTML = '';

        if (items.length === 0) {
            var empty = document.createElement('p');
            empty.style.color = 'var(--text-secondary)';
            empty.style.fontSize = '0.92rem';
            empty.textContent = '暂无内容';
            track.appendChild(empty);
            return;
        }

        // Sort by date descending (newest first)
        items.sort(function (a, b) {
            return (b.date || '').localeCompare(a.date || '');
        });

        items.forEach(function (item) {
            var card = buildCard(item);
            track.appendChild(card);
        });

        // Trigger fade-in animation via IntersectionObserver
        observeCards(track);
    }

    // ── IntersectionObserver for card animations ──────────────
    function observeCards(container) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        container.querySelectorAll('.card').forEach(function (card) {
            observer.observe(card);
        });
    }

    // ── Loading skeleton ──────────────────────────────────────
    function showTrackLoading(trackId) {
        var track = document.getElementById(trackId);
        if (!track) return;
        track.innerHTML = '';
        for (var i = 0; i < 3; i++) {
            var skel = document.createElement('div');
            skel.className = 'card card-skeleton';
            skel.style.opacity = '1';
            skel.style.transform = 'none';
            skel.innerHTML =
                '<div class="skel-bar" style="width:40%;height:14px;background:var(--tag-bg);border-radius:6px;margin-bottom:12px"></div>' +
                '<div class="skel-bar" style="width:70%;height:18px;background:var(--tag-bg);border-radius:6px;margin-bottom:12px"></div>' +
                '<div class="skel-bar" style="width:90%;height:14px;background:var(--tag-bg);border-radius:6px"></div>';
            track.appendChild(skel);
        }
    }

    // ── Shared tree cache (one API call for all sections) ─────
    var _treePromise = null;

    function getRepoTree() {
        if (_treePromise) return _treePromise;

        _treePromise = fetch(
            'https://api.github.com/repos/' + OWNER + '/' + REPO + '/git/trees/' + BRANCH + '?recursive=1'
        )
            .then(function (res) {
                if (!res.ok) throw new Error('Tree API ' + res.status);
                return res.json();
            })
            .then(function (data) {
                return data.tree || [];
            });

        return _treePromise;
    }

    // ── Fetch a single section ────────────────────────────────
    async function fetchSection(dir, trackId) {
        var cacheKey = 'cards_' + dir;
        var cached = cacheGet(cacheKey);

        if (cached) {
            renderCards(trackId, cached);
            return;
        }

        showTrackLoading(trackId);

        try {
            // 1. Get full repo tree (recursive) and filter .md files under dir/
            var tree = await getRepoTree();
            var prefix = dir + '/';
            var mdFiles = tree.filter(function (node) {
                return node.type === 'blob' && node.path.startsWith(prefix) && node.path.endsWith('.md');
            });

            // 2. Fetch raw content & parse frontmatter (in parallel)
            var items = await Promise.all(mdFiles.map(async function (f) {
                var rawUrl = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + f.path;
                var rawRes = await fetch(rawUrl);
                var text = await rawRes.text();
                var meta = parseFrontmatter(text);
                return {
                    title: meta.title || f.path.split('/').pop().replace('.md', ''),
                    description: meta.description || '',
                    tag: meta.tag || '',
                    date: meta.date || '',
                    path: f.path
                };
            }));

            cacheSet(cacheKey, items);
            renderCards(trackId, items);

        } catch (err) {
            console.error('Failed to load ' + dir + ':', err);
            var track = document.getElementById(trackId);
            if (track) {
                track.innerHTML = '<p style="color:var(--text-secondary);font-size:0.92rem">加载失败，请稍后刷新重试</p>';
            }
        }
    }

    // ── Init ──────────────────────────────────────────────────
    function init() {
        SECTIONS.forEach(function (s) {
            fetchSection(s.dir, s.trackId);
        });

        // Also observe static fade-up elements
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        document.querySelectorAll('.fade-up').forEach(function (el) {
            observer.observe(el);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
