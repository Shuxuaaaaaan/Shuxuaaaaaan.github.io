/**
 * renderer.js — Markdown fetcher & renderer for post.html
 *
 * Reads `?path=<relative-path-to-md>` from URL params,
 * fetches the .md file, strips frontmatter, and renders with marked.js.
 * Resolves relative image/link paths based on the md file's directory.
 */

(function () {
    'use strict';

    var CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
        const match = text.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]*([\s\S]*)$/);
        if (!match) return { meta: {}, body: text };

        const meta = {};
        match[1].split(/\r?\n/).forEach(function (line) {
            const idx = line.indexOf(':');
            if (idx > 0) {
                let key = line.slice(0, idx).trim();
                let val = line.slice(idx + 1).trim();
                // Remove optional quotes
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                meta[key] = val;
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
            // Simplified fetch: everything is now relative to the site root
            var rawBase = './';
            var rawUrl = rawBase + mdPath;
            rawUrl += '?t=' + Date.now();

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

            // Access control
            if (meta.publish !== 'yes') {
                showError('找不到该文章，或是该文章尚未发布。');
                return;
            }

            // Update page title (frontmatter title > H1 > default)
            const heading = meta.title || extractTitle(body);
            if (heading) {
                titleEl.textContent = heading + ' — Shuxuan';
            }

            // Update metadata
            const metaContainer = document.getElementById('post-meta');
            if (metaContainer) {
                if (meta.date || meta.tag) {
                    let metaHTML = [];
                    if (meta.date) metaHTML.push('<span class="meta-date">' + meta.date + '</span>');
                    if (meta.tag) metaHTML.push('<span class="meta-tag">' + meta.tag + '</span>');
                    metaContainer.innerHTML = metaHTML.join('<span class="meta-divider">·</span>');
                } else {
                    metaContainer.style.display = 'none';
                }
            }

            // Enable extensions if available
            if (typeof markedFootnote === 'function') {
                marked.use(markedFootnote());
            }

            // Enable KaTeX extension
            if (typeof markedKatex !== 'undefined') {
                const katexExt = (typeof markedKatex === 'function') ? markedKatex : markedKatex.default;
                if (katexExt) {
                    marked.use(katexExt({
                        throwOnError: false,
                        nonStandard: true
                    }));
                }
            }

            // Custom renderer instance (traditional way)
            const renderer = new marked.Renderer();
            renderer.image = function (token) {
                var src = resolveUrl(token.href, rawDir);
                var alt = token.text || '';
                var titleAttr = token.title ? ' title="' + token.title + '"' : '';
                return '<img src="' + src + '" alt="' + alt + '"' + titleAttr + ' />';
            };

            renderer.link = function (token) {
                // Only resolve links that look like relative file paths
                if (token.href && !token.href.startsWith('#') && !/^https?:\/\//.test(token.href) && !token.href.startsWith('//')) {
                    token.href = resolveUrl(token.href, rawDir);
                }
                
                // Fallback to original link renderer if possible, or reconstruct
                try {
                    return marked.Renderer.prototype.link.call(this, token);
                } catch (e) {
                    return '<a href="' + token.href + '"' + (token.title ? ' title="' + token.title + '"' : '') + '>' + token.text + '</a>';
                }
            };

            // Render markdown (without frontmatter)
            var finalBody = body;
            
            // Handle Obsidian image syntax ![[...]] -> ![...](<...>)
            finalBody = finalBody.replace(/!\[\[(.*?)\]\]/g, function(match, p1) {
                return '![' + p1 + '](' + p1.replace(/\s/g, '%20') + ')';
            });

            // Prepend frontmatter title as H1 if no H1 exists in the body
            if (meta.title && !extractTitle(body)) {
                finalBody = '# ' + meta.title + '\n\n' + finalBody;
            }
            var htmlContent = marked.parse(finalBody, { renderer: renderer });

            // If it's a photo album, extract image-description pairs
            var isPhotoAlbum = mdPath.includes('/photos/');
            if (isPhotoAlbum) {
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = htmlContent;

                var photoPairs = [];
                var imgs = tempDiv.querySelectorAll('img');
                imgs.forEach(function (img) {
                    var pair = { src: img.src, alt: img.alt, desc: '' };
                    var next = img.nextElementSibling;
                    // If image is inside a p, check the p's next sibling or the p's remaining text
                    var parentP = img.parentElement.tagName === 'P' ? img.parentElement : null;
                    
                    if (parentP) {
                        // Extract text from parent p if it's just the image and some text
                        var clone = parentP.cloneNode(true);
                        clone.querySelectorAll('img').forEach(i => i.remove());
                        pair.desc = clone.textContent.trim();
                        
                        // If p is empty, look at next sibling
                        if (!pair.desc && parentP.nextElementSibling && parentP.nextElementSibling.tagName === 'P') {
                            pair.desc = parentP.nextElementSibling.textContent.trim();
                            parentP.nextElementSibling.classList.add('remove-me');
                        }
                        parentP.classList.add('remove-me');
                    } else {
                        if (img.nextElementSibling && img.nextElementSibling.tagName === 'P') {
                            pair.desc = img.nextElementSibling.textContent.trim();
                            img.nextElementSibling.classList.add('remove-me');
                        }
                        img.classList.add('remove-me');
                    }
                    photoPairs.push(pair);
                });

                // Remove the extracted elements
                tempDiv.querySelectorAll('.remove-me').forEach(el => el.remove());
                contentEl.innerHTML = tempDiv.innerHTML;

                // Build gallery
                if (photoPairs.length > 0) {
                    renderPhotoWall(photoPairs);
                }
            } else {
                contentEl.innerHTML = htmlContent;
            }

            // Fetch list and update navigation
            const topDir = mdPath.split('/')[1]; // paths are now posts/articles/...
            getArticleList(topDir).then(items => {
                if (!items || items.length === 0) return;

                const currentIndex = items.findIndex(item => item.path === mdPath);
                if (currentIndex === -1) return;

                const navContainer = document.getElementById('post-navigation');
                if (navContainer) {
                    navContainer.classList.remove('hidden');
                }

                if (currentIndex > 0) {
                    // Previous article (newer)
                    const prevItem = items[currentIndex - 1];
                    const prevLink = document.getElementById('nav-prev');
                    prevLink.href = './post.html?path=' + encodeURIComponent(prevItem.path);
                    document.getElementById('nav-prev-title').textContent = prevItem.title;
                    prevLink.classList.remove('hidden');
                }

                if (currentIndex < items.length - 1) {
                    // Next article (older)
                    const nextItem = items[currentIndex + 1];
                    const nextLink = document.getElementById('nav-next');
                    nextLink.href = './post.html?path=' + encodeURIComponent(nextItem.path);
                    document.getElementById('nav-next-title').textContent = nextItem.title;
                    nextLink.classList.remove('hidden');
                }
            });

            // Back to Top Logic
            const backToTopBtn = document.getElementById('back-to-top');
            if (backToTopBtn) {
                window.addEventListener('scroll', function () {
                    if (window.scrollY > 400) {
                        backToTopBtn.classList.add('visible');
                    } else {
                        backToTopBtn.classList.remove('visible');
                    }
                });

                backToTopBtn.addEventListener('click', function () {
                    window.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                });
            }

        } catch (err) {
            console.error('Failed to load markdown:', err);
            showError('加载失败，请检查网络连接。');
        }
    }

    // ── Photo Wall & Lightbox Logic ─────────────────────────────
    function renderPhotoWall(pairs) {
        var wall = document.createElement('div');
        wall.className = 'photo-wall';
        
        // Determine number of columns based on screen width
        var width = window.innerWidth;
        var colCount = 1;
        if (width > 1100) colCount = 4;
        else if (width > 800) colCount = 3;
        else if (width > 500) colCount = 2;
        
        // Create column containers
        var cols = [];
        for (var i = 0; i < colCount; i++) {
            var col = document.createElement('div');
            col.className = 'photo-wall__column';
            wall.appendChild(col);
            cols.push(col);
        }
        
        pairs.forEach(function (pair, idx) {
            var item = document.createElement('div');
            item.className = 'photo-wall__item';
            item.dataset.idx = idx; // Tag with original index for sorted loading
            
            var img = document.createElement('img');
            img.src = pair.src;
            img.alt = pair.alt || '';
            img.loading = 'lazy';
            
            item.appendChild(img);
            
            if (pair.desc) {
                var desc = document.createElement('div');
                desc.className = 'photo-wall__desc';
                desc.textContent = pair.desc;
                item.appendChild(desc);
            }
            
            // Distribute items round-robin across vertical columns
            cols[idx % colCount].appendChild(item);
            
            item.onclick = function() {
                openLightbox(idx);
            };
        });
        
        contentEl.appendChild(wall);

        // Setup IntersectionObserver for sequential fade-in of photo items
        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function(entries, obs) {
                var intersecting = entries.filter(function(e) { return e.isIntersecting; });
                
                // Sort intersecting items by their original index to guarantee horizontal loading sequence
                intersecting.sort(function(a, b) {
                    return parseInt(a.target.dataset.idx) - parseInt(b.target.dataset.idx);
                });
                
                intersecting.forEach(function(entry, i) {
                    setTimeout(function() {
                        entry.target.classList.add('visible');
                    }, i * 100);
                    obs.unobserve(entry.target);
                });
            }, { rootMargin: '50px 0px', threshold: 0.01 });
            
            var items = wall.querySelectorAll('.photo-wall__item');
            items.forEach(function(item) {
                observer.observe(item);
            });
        } else {
            var items = wall.querySelectorAll('.photo-wall__item');
            items.forEach(function(item) { item.classList.add('visible'); });
        }

        // Build Lightbox Modal
        var lightbox = document.createElement('div');
        lightbox.className = 'lightbox';
        lightbox.innerHTML = `
            <div class="lightbox__overlay"></div>
            <button class="lightbox__close" aria-label="关闭">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <button class="lightbox__btn lightbox__btn--prev" aria-label="上一张">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <button class="lightbox__btn lightbox__btn--next" aria-label="下一张">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <div class="lightbox__content">
                <img class="lightbox__img" src="" alt="" />
                <div class="lightbox__caption"></div>
                <div class="lightbox__counter"></div>
            </div>
        `;
        document.body.appendChild(lightbox);
        
        var currentIdx = 0;
        var lbImg = lightbox.querySelector('.lightbox__img');
        var lbCaption = lightbox.querySelector('.lightbox__caption');
        var lbCounter = lightbox.querySelector('.lightbox__counter');
        
        function updateLightbox() {
            var pair = pairs[currentIdx];
            lbImg.src = pair.src;
            lbImg.alt = pair.alt || '';
            lbCaption.textContent = pair.desc || '';
            lbCounter.textContent = (currentIdx + 1) + ' / ' + pairs.length;
        }
        
        function openLightbox(idx) {
            currentIdx = idx;
            updateLightbox();
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
        function closeLightbox() {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
        }
        
        function nextImage(e) {
            if (e) e.stopPropagation();
            currentIdx = (currentIdx + 1) % pairs.length;
            updateLightbox();
        }
        
        function prevImage(e) {
            if (e) e.stopPropagation();
            currentIdx = (currentIdx - 1 + pairs.length) % pairs.length;
            updateLightbox();
        }
        
        // Close on any click outside the nav buttons
        lightbox.onclick = function(e) {
            if (!e.target.closest('.lightbox__btn')) {
                closeLightbox();
            }
        };
        
        lightbox.querySelector('.lightbox__btn--next').onclick = nextImage;
        lightbox.querySelector('.lightbox__btn--prev').onclick = prevImage;
        
        document.addEventListener('keydown', function(e) {
            if (!lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
        });
    }

    // ── Fetch article list and cache ────────────────────────────
    var postsPromise = null;
    async function getPosts() {
        if (!postsPromise) {
            postsPromise = (async function () {
                var cacheKey = 'all_posts_db_v4'; // Bump for structure change
                try {
                    var raw = sessionStorage.getItem(cacheKey);
                    if (raw) {
                        var obj = JSON.parse(raw);
                        if (Date.now() - obj.ts <= CACHE_TTL) {
                            return obj.data;
                        }
                    }
                } catch (e) { }

                try {
                    var res = await fetch('./content.json?t=' + Date.now());
                    if (!res.ok) throw new Error('Failed to load content.json');
                    var data = await res.json();
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data }));
                    } catch (e) { }
                    return data;
                } catch (e) {
                    console.error(e);
                    return [];
                }
            })();
        }
        return await postsPromise;
    }

    async function getArticleList(baseDir) {
        var allPosts = await getPosts();
        var items = allPosts.filter(p => p.dir === baseDir);
        // Date sorting is handled by generate_posts.py
        return items;
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();

