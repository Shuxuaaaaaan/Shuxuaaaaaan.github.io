/**
 * generate-rss.js — Generate RSS 2.0 feed from markdown files
 *
 * Scans articles/ and works/ directories (recursively),
 * parses frontmatter, and generates feed.xml for files with rss: yes.
 *
 * Usage: node generate-rss.js
 */

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────
const SITE_URL = 'https://shuxuaaaaaan.github.io';
const SITE_TITLE = 'Shuxuan';
const SITE_DESCRIPTION = 'Shuxuan的个人主页 — 文章、作品与简介。';
const DIRS = ['articles', 'works'];

// ── Frontmatter parser ────────────────────────────────────
function parseFrontmatter(text) {
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return {};
    const meta = {};
    match[1].split(/\r?\n/).forEach(line => {
        const idx = line.indexOf(':');
        if (idx > 0) {
            meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    });
    return meta;
}

// ── Recursively find all .md files ────────────────────────
function findMdFiles(dir, baseDir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findMdFiles(fullPath, baseDir));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            // Store relative path using forward slashes
            const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
            results.push({ fullPath, relPath });
        }
    }
    return results;
}

// ── XML escaping ──────────────────────────────────────────
function escXml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// ── Main ──────────────────────────────────────────────────
function main() {
    const rootDir = __dirname;
    const allItems = [];

    for (const dir of DIRS) {
        const dirPath = path.join(rootDir, dir);
        const mdFiles = findMdFiles(dirPath, rootDir);

        for (const { fullPath, relPath } of mdFiles) {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const meta = parseFrontmatter(content);

            // Only include items with rss: yes
            if (meta.rss && meta.rss.toLowerCase() === 'yes') {
                allItems.push({
                    title: meta.title || path.basename(relPath, '.md'),
                    description: meta.description || '',
                    date: meta.date || '',
                    link: SITE_URL + '/post.html?path=' + encodeURIComponent(relPath),
                    relPath
                });
            }
        }
    }

    // Sort by date descending
    allItems.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // Build RSS XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n';
    xml += '  <channel>\n';
    xml += '    <title>' + escXml(SITE_TITLE) + '</title>\n';
    xml += '    <link>' + escXml(SITE_URL) + '</link>\n';
    xml += '    <description>' + escXml(SITE_DESCRIPTION) + '</description>\n';
    xml += '    <language>zh-CN</language>\n';
    xml += '    <lastBuildDate>' + new Date().toUTCString() + '</lastBuildDate>\n';
    xml += '    <atom:link href="' + escXml(SITE_URL + '/feed.xml') + '" rel="self" type="application/rss+xml" />\n';

    for (const item of allItems) {
        const pubDate = item.date ? new Date(item.date + 'T00:00:00Z').toUTCString() : '';
        xml += '    <item>\n';
        xml += '      <title>' + escXml(item.title) + '</title>\n';
        xml += '      <link>' + escXml(item.link) + '</link>\n';
        xml += '      <description>' + escXml(item.description) + '</description>\n';
        if (pubDate) {
            xml += '      <pubDate>' + pubDate + '</pubDate>\n';
        }
        xml += '      <guid isPermaLink="true">' + escXml(item.link) + '</guid>\n';
        xml += '    </item>\n';
    }

    xml += '  </channel>\n';
    xml += '</rss>\n';

    const outputPath = path.join(rootDir, 'feed.xml');
    fs.writeFileSync(outputPath, xml, 'utf-8');
    console.log('✅ Generated feed.xml with ' + allItems.length + ' items');
}

main();
