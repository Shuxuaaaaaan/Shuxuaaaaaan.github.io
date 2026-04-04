/**
 * cards.js — Auto-discover markdown files via GitHub API & render cards
 */

(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────
    var CACHE_TTL = 60 * 60 * 1000; // 1 hour (Increased for performance)
    var VERSION = window.SITE_VERSION || Date.now();

    var SECTIONS = [
        { dir: 'articles', trackId: 'articles-track', sectionId: 'articles', btnText: '更多文章' },
        { dir: 'works', trackId: 'projects-track', sectionId: 'projects', btnText: '更多作品' },
        { dir: 'photos', trackId: 'photos-track', sectionId: 'photos', btnText: '更多相册' }
    ];

    // ── Pagination States ─────────────────────────────────────
    var sectionStates = {
        articles: { items: [], currentIndex: 0, chunkSize: 4 },
        works: { items: [], currentIndex: 0, chunkSize: 4 },
        photos: { items: [], currentIndex: 0, chunkSize: 4 }
    };

    // --- Version Check & Global Cache Clear ---
    (function checkVersion() {
        const LAST_VERSION_KEY = 'site_version_tag';
        const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
        if (lastVersion !== VERSION) {
            console.log('Site version updated:', lastVersion, '->', VERSION, '- Clearing session cache');
            sessionStorage.clear();
            localStorage.setItem(LAST_VERSION_KEY, VERSION);
        }
    })();

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
        } catch (e) { }
    }

    function buildCard(item, sectionId, isPriority) {
        var a = document.createElement('a');
        var href = './?path=' + encodeURIComponent(item.path);
        if (sectionId) {
            href += '&fromSection=' + sectionId;
        }
        a.href = href;

        a.onclick = function (e) {
            e.preventDefault();
            if (window.openArticleModal) {
                window.openArticleModal(item.path);
                window.history.pushState({ path: item.path }, '', href);
            } else {
                window.location.href = href; // fallback
            }
        };

        a.className = 'card';
        if (item.dir === 'photos') a.classList.add('card--photo');

        if (item.cover) {
            var coverDiv = document.createElement('div');
            coverDiv.className = 'card__cover';
            var img = document.createElement('img');
            img.src = item.cover;
            img.loading = isPriority ? 'eager' : 'lazy';
            if (isPriority) {
                img.setAttribute('fetchpriority', 'high');
            }
            coverDiv.appendChild(img);
            a.appendChild(coverDiv);
        }

        var content = document.createElement('div');
        content.className = 'card__content';

        var tag = document.createElement('span');
        tag.className = 'card__tag';
        tag.textContent = item.tag || '未分类';

        var title = document.createElement('h3');
        title.className = 'card__title';
        title.textContent = item.title || '无标题';

        var desc = document.createElement('p');
        desc.className = 'card__desc';
        desc.textContent = item.description || '';

        var date = document.createElement('span');
        date.className = 'card__date';
        date.textContent = item.date || '';

        content.appendChild(tag);
        content.appendChild(title);
        content.appendChild(desc);
        content.appendChild(date);

        a.appendChild(content);

        return a;
    }

    // ── Rendering Logic ───────────────────────────────────────
    function renderSectionChunk(dir, trackId) {
        var state = sectionStates[dir];
        var track = document.getElementById(trackId);
        if (!track || !state) return;

        if (state.currentIndex === 0) {
            track.innerHTML = '';
            if (state.items.length === 0) {
                var empty = document.createElement('p');
                empty.style.color = 'var(--text-secondary)';
                empty.style.fontSize = '0.92rem';
                empty.textContent = '暂无内容';
                track.appendChild(empty);
                return;
            }
        }

        var nextItems = state.items.slice(state.currentIndex, state.currentIndex + state.chunkSize);
        if (nextItems.length === 0) return;

        var sectionInfo = SECTIONS.find(function (s) { return s.dir === dir; });
        var sectionId = sectionInfo ? sectionInfo.sectionId : '';

        var isFirstChunk = (state.currentIndex === 0);
        var newCards = [];
        nextItems.forEach(function (item) {
            var card = buildCard(item, sectionId, isFirstChunk);
            if (isFirstChunk) {
                card.classList.add('card--instant', 'visible');
            }
            track.appendChild(card);
            newCards.push(card);
        });

        if (!isFirstChunk) {
            // For "Load More", fade in all 4 cards together
            requestAnimationFrame(function () {
                newCards.forEach(function (card) {
                    card.classList.add('visible');
                });
            });
        } else {
            // For the first chunk, they are already visible via card--instant
        }

        state.currentIndex += state.chunkSize;
        updateLoadMoreButton(dir);
    }

    function updateLoadMoreButton(dir) {
        var sectionInfo = SECTIONS.find(s => s.dir === dir);
        if (!sectionInfo) return;

        var section = document.getElementById(sectionInfo.sectionId);
        if (!section) return;

        var state = sectionStates[dir];
        var btnId = 'load-more-' + dir;
        var btn = document.getElementById(btnId);

        if (state.currentIndex >= state.items.length) {
            if (btn) btn.remove();
        } else {
            if (!btn) {
                btn = document.createElement('button');
                btn.id = btnId;
                btn.className = 'load-more-btn';
                btn.textContent = sectionInfo.btnText;
                btn.onclick = function () { renderSectionChunk(dir, sectionInfo.trackId); };
                var container = section.querySelector('.container');
                if (container) container.appendChild(btn);
            }
        }
    }

    // Removed: observeCards (Dead code)

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

    // ── Data Fetching & Preloading ───────────────────────────
    function preloadPriorityImages(allPosts) {
        SECTIONS.forEach(function (sec) {
            // Skip preloading for 'photos' section as requested
            if (sec.dir === 'photos') return;

            var items = allPosts.filter(p => p.dir === sec.dir).slice(0, 4);
            items.forEach(function (item) {
                if (item.cover) {
                    var img = new Image();
                    img.src = item.cover;
                }
            });
        });
    }

    var postsPromise = (async function () {
        var cacheKey = 'all_posts_db_' + VERSION;
        var cached = cacheGet(cacheKey);
        if (cached) return cached;

        try {
            var res = await fetch('./content.json?v=' + VERSION);
            if (!res.ok) throw new Error('Failed to load content.json');
            var data = await res.json();
            preloadPriorityImages(data);
            cacheSet(cacheKey, data);
            return data;
        } catch (e) {
            console.error('Failed to load content.json:', e);
            // Fallback for local file access or network failure
            if (window.location.protocol === 'file:') {
                console.error('Note: Fetch is generally blocked on file:// protocol by browsers.');
            }
            return [];
        }
    })();
    // Export for loader sync
    window.contentLoadedPromise = postsPromise;

    async function getPosts() {
        return await postsPromise;
    }

    async function fetchSection(dir, trackId) {
        var state = sectionStates[dir];
        var cacheKey = 'cards_' + dir + '_' + VERSION;
        var cached = cacheGet(cacheKey);

        if (cached) {
            state.items = cached;
            state.currentIndex = 0;
            renderSectionChunk(dir, trackId);
            return;
        }

        showTrackLoading(trackId);

        try {
            var allPosts = await getPosts();
            var items = allPosts.filter(p => p.dir === dir && p.publish !== 'no');

            cacheSet(cacheKey, items);
            state.items = items;
            state.currentIndex = 0;
            renderSectionChunk(dir, trackId);

        } catch (err) {
            console.error('Failed to load ' + dir + ':', err);
            var track = document.getElementById(trackId);
            if (track) {
                track.innerHTML = '<p style="color:var(--text-secondary);font-size:0.92rem">加载失败，请稍后刷新重试</p>';
            }
        }
    }

    function init() {
        SECTIONS.forEach(function (s) {
            fetchSection(s.dir, s.trackId);
        });

        // Static animations
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
