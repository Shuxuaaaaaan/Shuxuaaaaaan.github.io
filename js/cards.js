/**
 * cards.js — Auto-discover markdown files via GitHub API & render cards
 */

(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────
    var CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    var SECTIONS = [
        { dir: 'articles', trackId: 'articles-track', sectionId: 'articles', btnText: '加载更多文章' },
        { dir: 'works', trackId: 'projects-track', sectionId: 'projects', btnText: '加载更多作品' },
        { dir: 'photos', trackId: 'photos-track', sectionId: 'photos', btnText: '加载更多相册' }
    ];

    // ── Pagination States ─────────────────────────────────────
    var sectionStates = {
        articles: { items: [], currentIndex: 0, chunkSize: 4 },
        works: { items: [], currentIndex: 0, chunkSize: 4 },
        photos: { items: [], currentIndex: 0, chunkSize: 4 }
    };

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

    // ── Card HTML builder ─────────────────────────────────────
    function buildCard(item) {
        var a = document.createElement('a');
        a.href = './post.html?path=' + encodeURIComponent(item.path);
        a.className = 'card';
        if (item.dir === 'photos') a.classList.add('card--photo');

        // Cover Image
        if (item.cover) {
            var coverDiv = document.createElement('div');
            coverDiv.className = 'card__cover';
            var img = document.createElement('img');
            img.src = item.cover;
            img.loading = 'lazy';
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

        nextItems.forEach(function (item) {
            track.appendChild(buildCard(item));
        });

        observeCards(track);
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
                btn.onclick = function() { renderSectionChunk(dir, sectionInfo.trackId); };
                var container = section.querySelector('.container');
                if (container) container.appendChild(btn);
            }
        }
    }

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

    // ── Data Fetching ─────────────────────────────────────────
    var postsPromise = null;
    async function getPosts() {
        if (!postsPromise) {
            postsPromise = (async function () {
                var cacheKey = 'all_posts_db_v4'; // Bump for structure change
                var cached = cacheGet(cacheKey);
                if (cached) return cached;

                try {
                    var res = await fetch('./content.json?t=' + Date.now());
                    if (!res.ok) throw new Error('Failed to load content.json');
                    var data = await res.json();
                    cacheSet(cacheKey, data);
                    return data;
                } catch (e) {
                    console.error(e);
                    return [];
                }
            })();
        }
        return await postsPromise;
    }

    async function fetchSection(dir, trackId) {
        var state = sectionStates[dir];
        var cacheKey = 'cards_' + dir + '_v4'; // Bump version
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
            var items = allPosts.filter(p => p.dir === dir);

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
