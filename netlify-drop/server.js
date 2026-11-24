/**
 * MediaDrop Universal Cloud & Local Server (v2.0 - Bulletproof Multi-Engine)
 * Engines:
 *  1. @distube/ytdl-core (VisionOS/TV/WebEmbedded + BotGuard PO Token) + ffmpeg-static muxing/transcoding
 *  2. Standalone yt-dlp (--js-runtimes node + ejs:github + optional cookies)
 *  3. Pure-Node Guest Scrapers for Spotify Embed (__NEXT_DATA__), Instagram & Facebook
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { Ytdl, Client } from '@distube/ytdl-core';
import ffmpegStatic from 'ffmpeg-static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;
const JOB_TTL_MS = 10 * 60 * 1000;
const MAX_JOBS = 100;

// Prevent unhandled async stream rejections from crashing Render/Node process
process.on('uncaughtException', (err) => {
  console.error('[MediaDrop UncaughtException]:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MediaDrop UnhandledRejection]:', reason);
});

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// -------------------- Binary & Cookie Setup --------------------

function detectFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {}
  if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
    return ffmpegStatic;
  }
  return null;
}

let cachedYtDlpPath = null;
let cachedYtDlpVersion = null;
let ytDlpDownloading = false;

function detectYtDlp() {
  const candidates = [
    path.join(__dirname, 'yt-dlp'),
    path.join(os.tmpdir(), 'yt-dlp')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).size > 1024 * 1024) {
      try { fs.chmodSync(c, 0o755); } catch {}
      return c;
    }
  }
  try {
    const out = execSync('yt-dlp --version', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (out) {
      cachedYtDlpVersion = out;
      return 'yt-dlp';
    }
  } catch {}
  return null;
}

async function ensureYtDlpRuntime() {
  cachedYtDlpPath = detectYtDlp();
  if (cachedYtDlpPath) {
    if (!cachedYtDlpVersion) {
      try {
        cachedYtDlpVersion = execSync(`"${cachedYtDlpPath}" --version`, {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'ignore']
        }).trim();
      } catch {
        cachedYtDlpVersion = 'unknown';
      }
    }
    return cachedYtDlpPath;
  }

  if (process.platform !== 'linux' || ytDlpDownloading) return null;
  ytDlpDownloading = true;
  try {
    const isMusl = fs.existsSync('/etc/alpine-release');
    const asset = isMusl ? 'yt-dlp_musllinux' : 'yt-dlp_linux';
    const dest = path.join(os.tmpdir(), 'yt-dlp');
    console.log(`[MediaDrop] Auto-fetching ${asset} into ${dest}...`);
    const res = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/latest/download/${asset}`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(120000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    fs.chmodSync(dest, 0o755);
    cachedYtDlpPath = dest;
    cachedYtDlpVersion = 'downloaded';
    console.log('[MediaDrop] Standalone yt-dlp ready at:', dest);
    return dest;
  } catch (err) {
    console.warn('[MediaDrop] Runtime yt-dlp download failed:', err.message);
    return null;
  } finally {
    ytDlpDownloading = false;
  }
}

function getCookiesFile() {
  const raw = process.env.YOUTUBE_COOKIES || process.env.COOKIES_TXT || '';
  if (!raw.trim()) return null;
  const target = path.join(os.tmpdir(), 'mediadrop-cookies.txt');
  try {
    fs.writeFileSync(target, raw, 'utf8');
    return target;
  } catch {
    return null;
  }
}

const FFMPEG_BIN = detectFfmpeg();
ensureYtDlpRuntime();

// Shared Ytdl singleton preserves BotGuard PO-token & visitor session
const sharedYtdl = new Ytdl({
  clients: [Client.VisionOS, Client.Tv, Client.WebEmbedded, Client.Mweb],
  ...(process.env.YOUTUBE_COOKIES ? { cookie: process.env.YOUTUBE_COOKIES } : {})
});

// Resolved download job cache
const resolvedJobs = new Map();

function saveJob(job) {
  const token = crypto.randomBytes(10).toString('hex');
  job.createdAt = Date.now();
  resolvedJobs.set(token, job);
  // Evict expired or overflow entries
  const now = Date.now();
  for (const [k, v] of resolvedJobs.entries()) {
    if (now - v.createdAt > JOB_TTL_MS || resolvedJobs.size > MAX_JOBS) {
      resolvedJobs.delete(k);
    }
  }
  return token;
}

// -------------------- Utility Helpers --------------------

function sendJson(res, status, payload) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sanitizeTitle(raw, fallback = 'media') {
  if (!raw || typeof raw !== 'string') return fallback;
  const cleaned = raw
    .replace(/[\\/:*?"<>|\r\n\t]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || fallback).slice(0, 120);
}

/**
 * Safe RFC 5987 Content-Disposition header.
 * Never throws ERR_INVALID_CHAR on Hebrew / Arabic / non-ASCII titles!
 */
function buildContentDisposition(title, ext) {
  const safe = sanitizeTitle(title, 'media');
  const fullName = `${safe}.${ext}`;
  const asciiFallback =
    fullName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\;]/g, '')
      .replace(/_+/g, '_')
      .trim() || `mediadrop.${ext}`;
  const utf8Encoded = encodeURIComponent(fullName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;
}

function formatDurationMs(ms) {
  if (!ms || isNaN(ms)) return '—';
  const totalSec = Math.floor(ms / 1000);
  return formatDurationSec(totalSec);
}

function formatDurationSec(sec) {
  if (!sec || isNaN(sec)) return '—';
  const s = Math.floor(sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem < 10 ? '0' : ''}${rem}`;
}

function detectPlatformServer(url) {
  const u = (url || '').toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('spotify.com')) return 'spotify';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.watch')) return 'facebook';
  return null;
}

function parseMaxHeight(quality) {
  const q = String(quality || 'max').toLowerCase();
  if (q === '1080') return 1080;
  if (q === '720') return 720;
  if (q === '480') return 480;
  if (q === '360') return 360;
  return 2160;
}

// -------------------- Platform Metadata & Extraction --------------------

async function fetchSpotifyDetails(url) {
  const m = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|playlist|album)\/([a-zA-Z0-9]+)/i);
  if (!m) throw new Error('קישור ספוטיפיי לא תקין');
  const [, type, id] = m;

  // Fetch Spotify Embed page containing __NEXT_DATA__ with real artist & track list
  try {
    const embedRes = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(8000)
    });
    if (embedRes.ok) {
      const html = await embedRes.text();
      const idx = html.indexOf('__NEXT_DATA__');
      if (idx > -1) {
        const start = html.indexOf('>', idx) + 1;
        const end = html.indexOf('</script>', start);
        const json = JSON.parse(html.slice(start, end));
        const entity = json?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          const images = entity.visualIdentity?.image || [];
          const thumb = images[images.length - 1]?.url || images[0]?.url || '';
          if (type === 'track') {
            const artists = Array.isArray(entity.artists)
              ? entity.artists.map((a) => a.name).filter(Boolean).join(', ')
              : entity.subtitle || '';
            return {
              type: 'track',
              title: entity.name || entity.title || 'שיר מספוטיפיי',
              author: artists || 'Spotify',
              thumbnail: thumb,
              duration: formatDurationMs(entity.duration),
              platform: 'spotify',
              url,
              isPlaylist: false
            };
          } else {
            const trackList = Array.isArray(entity.trackList) ? entity.trackList : [];
            const items = trackList.map((t, i) => {
              const uriParts = String(t.uri || '').split(':');
              const trackId = uriParts[2] || t.uid || String(i);
              return {
                index: i + 1,
                id: trackId,
                title: t.title || `רצועה ${i + 1}`,
                author: (t.subtitle || '').replace(/\u00a0/g, ' ') || entity.name || 'Spotify',
                duration: formatDurationMs(t.duration),
                thumbnail: thumb,
                url: uriParts[2] ? `https://open.spotify.com/track/${uriParts[2]}` : url,
                platform: 'spotify',
                selected: true
              };
            });
            return {
              type,
              title: entity.name || entity.title || 'פלייליסט ספוטיפיי',
              author: (entity.subtitle || 'Spotify Playlist').replace(/\u00a0/g, ' '),
              thumbnail: thumb,
              itemCount: items.length,
              platform: 'spotify',
              url,
              isPlaylist: true,
              items
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Spotify Embed parse note]:', err.message);
  }

  // Fallback to Spotify oEmbed
  const oe = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(6000)
  });
  if (!oe.ok) throw new Error('לא ניתן לאחזר פרטי שיר מספוטיפיי');
  const d = await oe.json();
  return {
    type,
    title: d.title || 'שיר מספוטיפיי',
    author: d.author_name || 'Spotify',
    thumbnail: d.thumbnail_url || '',
    duration: 'אודיו',
    platform: 'spotify',
    url,
    isPlaylist: type !== 'track',
    items:
      type !== 'track'
        ? [
            {
              index: 1,
              id,
              title: d.title || 'רשימה',
              author: d.author_name || 'Spotify',
              duration: 'אודיו',
              thumbnail: d.thumbnail_url || '',
              url,
              platform: 'spotify',
              selected: true
            }
          ]
        : []
  };
}

function unescapeSocialUrl(str) {
  return str
    .replace(/\\u0026/g, '&')
    .replace(/\\u003C/gi, '<')
    .replace(/\\u003E/gi, '>')
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&');
}

function extractMetaTag(html, property) {
  const re1 = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? unescapeSocialUrl(m[1]) : '';
}

async function fetchSocialGuestDetails(url) {
  const platform = detectPlatformServer(url);
  const urlsToTry = [url];
  if (platform === 'instagram') {
    const clean = url.split('?')[0].replace(/\/+$/, '');
    urlsToTry.push(`${clean}/embed/captioned/`, `${clean}/embed/`);
  }

  let bestTitle = '';
  let bestThumb = '';
  let directVideoUrl = '';

  for (const target of urlsToTry) {
    try {
      const res = await fetch(target, {
        redirect: 'follow',
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Sec-Fetch-Mode': 'navigate'
        },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) continue;
      const html = await res.text();

      if (!bestTitle) bestTitle = extractMetaTag(html, 'og:title') || extractMetaTag(html, 'twitter:title');
      if (!bestThumb) bestThumb = extractMetaTag(html, 'og:image');

      const candidates = [
        extractMetaTag(html, 'og:video:secure_url'),
        extractMetaTag(html, 'og:video')
      ];
      for (const regex of [
        /"playable_url_quality_hd"\s*:\s*"([^"]+)"/,
        /"browser_native_hd_url"\s*:\s*"([^"]+)"/,
        /"playable_url"\s*:\s*"([^"]+)"/,
        /"browser_native_sd_url"\s*:\s*"([^"]+)"/,
        /"video_url"\s*:\s*"([^"]+)"/
      ]) {
        const m = html.match(regex);
        if (m && m[1]) candidates.push(unescapeSocialUrl(m[1]));
      }

      for (const c of candidates) {
        if (c && c.startsWith('http')) {
          directVideoUrl = c;
          break;
        }
      }
      if (directVideoUrl) break;
    } catch {}
  }

  return {
    title: bestTitle || (platform === 'instagram' ? 'סרטון מאינסטגרם' : 'סרטון מפייסבוק'),
    author: platform === 'instagram' ? 'Instagram' : 'Facebook',
    thumbnail: bestThumb,
    directVideoUrl,
    platform
  };
}

function runYtDlpJson(targetUrl, extraArgs = [], timeoutMs = 25000) {
  return new Promise(async (resolve, reject) => {
    const bin = cachedYtDlpPath || (await ensureYtDlpRuntime());
    if (!bin) {
      return reject(new Error('yt-dlp binary not available'));
    }
    const args = [
      '--js-runtimes', `node:${process.execPath}`,
      '--remote-components', 'ejs:github',
      '--force-ipv4',
      '--no-update',
      '-J',
      '--no-warnings'
    ];
    const cookiesFile = getCookiesFile();
    if (cookiesFile) {
      args.push('--cookies', cookiesFile);
    }
    args.push(...extraArgs, targetUrl);

    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { child.kill('SIGKILL'); } catch {}
        reject(new Error('yt-dlp lookup timeout'));
      }
    }, timeoutMs);

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        try {
          resolve(JSON.parse(stdout));
        } catch (parseErr) {
          reject(new Error(`Invalid yt-dlp JSON: ${parseErr.message}`));
        }
      } else {
        const cleanErr = stderr.trim() || `yt-dlp exited with code ${code}`;
        reject(new Error(cleanErr));
      }
    });
  });
}

function classifyError(err) {
  const msg = String(err?.message || err || '');
  const lower = msg.toLowerCase();
  if (lower.includes('bot') || lower.includes('sign in to confirm') || err?.code === 'BOT_CHECK') {
    return {
      code: 'BOT_CHECK',
      message:
        'יוטיוב זיהה תעבורת ענן וביקש אימות רובוט. נסה שנית, הורד דרך השרת המקומי במחשב, או הוסף YOUTUBE_COOKIES בהגדרות Render.'
    };
  }
  if (lower.includes('login') || lower.includes('logged-in') || lower.includes('empty media response') || lower.includes('cookies')) {
    return {
      code: 'LOGIN_REQUIRED',
      message: 'הפלטפורמה דורשת התחברות לצפייה בסרטון זה (חשבון פרטי או חסימת אורח).'
    };
  }
  if (lower.includes('private') || lower.includes('unavailable') || lower.includes('not found') || err?.code === 'NOT_FOUND') {
    return {
      code: 'NOT_FOUND',
      message: 'הסרטון אינו זמין, פרטי או שהוסר.'
    };
  }
  if (lower.includes('age') || err?.code === 'AGE_RESTRICTED') {
    return {
      code: 'AGE_RESTRICTED',
      message: 'הסרטון מוגבל בגיל ודורש חשבון מחובר.'
    };
  }
  return {
    code: 'EXTRACTION_FAILED',
    message: msg.slice(0, 220) || 'כשל בעיבוד המדיה.'
  };
}

// -------------------- Core Media Resolver --------------------

async function resolveMediaJob({ url, format = 'mp3', quality = 'max', title = '', author = '' }) {
  const platform = detectPlatformServer(url);
  if (!platform) throw new Error('קישור לא נתמך');

  let finalTitle = title && !title.startsWith('מדיה מ-') && title !== 'מדיה משותפת' ? title : '';
  let finalAuthor = author && author !== 'Spotify' ? author : '';
  let targetVideoUrl = url;

  // Step 1: Resolve Spotify track -> real metadata -> YouTube watch URL
  if (platform === 'spotify') {
    try {
      const sp = await fetchSpotifyDetails(url);
      if (sp.title && !finalTitle) finalTitle = sp.title;
      if (sp.author && sp.author !== 'Spotify') finalAuthor = sp.author;
    } catch {}

    const searchQuery = `${finalTitle || url} ${finalAuthor}`.trim();
    try {
      const results = await sharedYtdl.search(searchQuery, { limit: 3 });
      if (results?.length) {
        targetVideoUrl = results[0].url;
        if (!finalTitle) finalTitle = results[0].title;
        if (!finalAuthor) finalAuthor = results[0].author?.name || '';
      }
    } catch {
      // yt-dlp fallback search handled below
      targetVideoUrl = `ytsearch1:${searchQuery}`;
    }
  }

  // Step 2: YouTube / Spotify-on-YouTube extraction
  if (platform === 'youtube' || platform === 'spotify') {
    let lastErr = null;

    // Engine A: @distube/ytdl-core (fast in-process VisionOS/clients + PO Token)
    if (targetVideoUrl.startsWith('http')) {
      try {
        const info = await sharedYtdl.getInfo(targetVideoUrl);
        if (!finalTitle) finalTitle = info.videoDetails?.title || 'media';
        if (!finalAuthor) finalAuthor = info.videoDetails?.author?.name || 'YouTube';

        const maxH = parseMaxHeight(quality);
        // Pick best audio format (prefer m4a itag 140 / opus 251)
        const audioFormats = info.formats.filter((f) => f.hasAudio && !f.isLive && !f.isDrm && f.url);
        audioFormats.sort((a, b) => {
          if (a.itag === 140) return -1;
          if (b.itag === 140) return 1;
          return (b.audioBitrate || 0) - (a.audioBitrate || 0);
        });
        const audioFmt = audioFormats[0];

        if (format === 'mp3') {
          if (!audioFmt) throw new Error('לא נמצא ערוץ שמע זמין');
          // Verify CDN stream doesn't 403 before returning token
          await probeYtdlFormat(info, audioFmt);
          return {
            mode: 'ytdl',
            format: 'mp3',
            info,
            audioFmt,
            title: finalTitle,
            author: finalAuthor,
            fileName: `${sanitizeTitle(finalTitle)}.mp3`
          };
        }

        // MP4: Check progressive MP4 first, else best H.264 (avc1) video + audio mux
        const progressive = info.formats
          .filter((f) => f.hasVideo && f.hasAudio && f.container === 'mp4' && !f.isDrm && f.url && (f.height || 0) <= maxH)
          .sort((a, b) => (b.height || 0) - (a.height || 0))[0];

        if (progressive && (maxH <= 360 || !FFMPEG_BIN)) {
          await probeYtdlFormat(info, progressive);
          return {
            mode: 'ytdl',
            format: 'mp4',
            info,
            progressiveFmt: progressive,
            title: finalTitle,
            author: finalAuthor,
            fileName: `${sanitizeTitle(finalTitle)}.mp4`
          };
        }

        const videoCandidates = info.formats
          .filter((f) => f.hasVideo && !f.hasAudio && !f.isDrm && f.url && (f.height || 0) <= maxH)
          .sort((a, b) => {
            // Prefer H.264 (avc1) up to requested height for 100% compatibility across Android/iOS/Windows
            const aAvc = String(a.videoCodec || '').startsWith('avc1') ? 1 : 0;
            const bAvc = String(b.videoCodec || '').startsWith('avc1') ? 1 : 0;
            const hDiff = (b.height || 0) - (a.height || 0);
            if (Math.abs(hDiff) > 0 && (aAvc === bAvc || quality === 'max')) return bAvc - aAvc || hDiff;
            return bAvc - aAvc || hDiff || (b.bitrate || 0) - (a.bitrate || 0);
          });

        const videoFmt = videoCandidates[0];
        if (videoFmt && audioFmt && FFMPEG_BIN) {
          await probeYtdlFormat(info, videoFmt);
          return {
            mode: 'ytdl',
            format: 'mp4',
            info,
            videoFmt,
            audioFmt,
            title: finalTitle,
            author: finalAuthor,
            fileName: `${sanitizeTitle(finalTitle)}.mp4`
          };
        }
        if (progressive) {
          await probeYtdlFormat(info, progressive);
          return {
            mode: 'ytdl',
            format: 'mp4',
            info,
            progressiveFmt: progressive,
            title: finalTitle,
            author: finalAuthor,
            fileName: `${sanitizeTitle(finalTitle)}.mp4`
          };
        }
      } catch (err) {
        lastErr = err;
        console.warn('[Engine A ytdl-core note]:', err.message);
      }
    }

    // Engine B: Standalone yt-dlp (with --js-runtimes node & remote ejs)
    try {
      const json = await runYtDlpJson(targetVideoUrl, ['--no-playlist']);
      const entry = Array.isArray(json.entries) ? json.entries[0] : json;
      if (!entry) throw new Error('לא נמצאו תוצאות להורדה');
      if (!finalTitle) finalTitle = entry.title || 'media';
      if (!finalAuthor) finalAuthor = entry.channel || entry.uploader || 'YouTube';

      return {
        mode: 'ytdlp',
        format,
        quality,
        targetUrl: entry.webpage_url || targetVideoUrl,
        title: finalTitle,
        author: finalAuthor,
        fileName: `${sanitizeTitle(finalTitle)}.${format}`
      };
    } catch (ytDlpErr) {
      console.warn('[Engine B yt-dlp note]:', ytDlpErr.message);
      const classified = classifyError(lastErr || ytDlpErr);
      const e = new Error(classified.message);
      e.code = classified.code;
      throw e;
    }
  }

  // Step 3: Instagram & Facebook extraction
  let socialErr = null;
  try {
    const json = await runYtDlpJson(url, ['--no-playlist', '--user-agent', BROWSER_UA], 20000);
    const entry = Array.isArray(json.entries) ? json.entries[0] : json;
    if (entry) {
      if (!finalTitle) finalTitle = entry.title || `${platform} video`;
      return {
        mode: 'ytdlp',
        format,
        quality,
        targetUrl: url,
        title: finalTitle,
        author: entry.uploader || platform,
        fileName: `${sanitizeTitle(finalTitle)}.${format}`
      };
    }
  } catch (err) {
    socialErr = err;
    console.warn(`[${platform} yt-dlp note]:`, err.message);
  }

  // Pure-Node fallback scraper for IG/FB
  const guest = await fetchSocialGuestDetails(url);
  if (guest.directVideoUrl) {
    const t = finalTitle || guest.title;
    return {
      mode: 'direct-url',
      format,
      directUrl: guest.directVideoUrl,
      title: t,
      author: guest.author,
      fileName: `${sanitizeTitle(t)}.${format}`
    };
  }

  const classified = classifyError(socialErr || new Error('Empty social media response'));
  const e = new Error(classified.message);
  e.code = classified.code;
  throw e;
}

/**
 * Probes first 1KB from CDN via ytdl.download to detect 403 / BOT_CHECK immediately in /api/resolve.
 */
function probeYtdlFormat(info, format) {
  return new Promise((resolve, reject) => {
    let done = false;
    const stream = sharedYtdl.download(info, { format, range: { start: 0, end: 1024 } });
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        try { stream.destroy(); } catch {}
        resolve(true); // slow start doesn't mean 403
      }
    }, 5000);

    stream.on('data', () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        try { stream.destroy(); } catch {}
        resolve(true);
      }
    });
    stream.on('error', (err) => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    stream.on('end', () => {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(true);
      }
    });
  });
}

// -------------------- Stream Dispatchers --------------------

async function streamResolvedJob(job, req, res) {
  const ext = job.format === 'mp3' ? 'mp3' : 'mp4';
  const headers = {
    'Content-Type': ext === 'mp3' ? 'audio/mpeg' : 'video/mp4',
    'Content-Disposition': buildContentDisposition(job.title, ext),
    'Cache-Control': 'no-store'
  };

  let headersSent = false;
  let aborted = false;
  const cleanups = [];

  const cleanupAll = () => {
    for (const fn of cleanups) {
      try { fn(); } catch {}
    }
  };

  req.on('close', () => {
    if (!res.writableEnded) {
      aborted = true;
      cleanupAll();
    }
  });

  const writeChunkSafe = (chunk) => {
    if (aborted || res.writableEnded) return;
    if (!headersSent) {
      headersSent = true;
      res.writeHead(200, headers);
    }
    res.write(chunk);
  };

  const failStream = (err) => {
    cleanupAll();
    console.error('[Stream Error]:', err?.message || err);
    if (!headersSent && !res.headersSent) {
      sendJson(res, 500, { ok: false, error: err?.message || 'שגיאה בהזרמת הקובץ' });
    } else if (!res.writableEnded) {
      try { res.destroy(); } catch {}
    }
  };

  // Mode 1: @distube/ytdl-core
  if (job.mode === 'ytdl') {
    if (job.format === 'mp3') {
      const audioStream = sharedYtdl.download(job.info, { format: job.audioFmt });
      cleanups.push(() => audioStream.destroy());

      if (FFMPEG_BIN) {
        const ff = spawn(FFMPEG_BIN, [
          '-y',
          '-i', 'pipe:0',
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-f', 'mp3',
          'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        cleanups.push(() => {
          try { ff.kill('SIGKILL'); } catch {}
        });

        audioStream.on('error', (err) => {
          if (!headersSent) failStream(err);
        });
        ff.stdin.on('error', () => {});
        audioStream.pipe(ff.stdin);

        ff.stdout.on('data', writeChunkSafe);
        ff.on('error', failStream);
        ff.on('close', (code) => {
          cleanupAll();
          if (!headersSent && !aborted) {
            failStream(new Error(`ffmpeg exited with code ${code}`));
          } else if (!res.writableEnded) {
            res.end();
          }
        });
        return;
      }

      // Raw fallback if ffmpeg ever unavailable
      audioStream.on('data', writeChunkSafe);
      audioStream.on('error', failStream);
      audioStream.on('end', () => {
        cleanupAll();
        if (!res.writableEnded) res.end();
      });
      return;
    }

    // MP4 progressive
    if (job.progressiveFmt) {
      const stream = sharedYtdl.download(job.info, { format: job.progressiveFmt });
      cleanups.push(() => stream.destroy());
      stream.on('data', writeChunkSafe);
      stream.on('error', failStream);
      stream.on('end', () => {
        cleanupAll();
        if (!res.writableEnded) res.end();
      });
      return;
    }

    // MP4 DASH muxing via 127.0.0.1 loopback + ffmpeg-static (fast & zero audio-loss!)
    const vStream = sharedYtdl.download(job.info, { format: job.videoFmt });
    const aStream = sharedYtdl.download(job.info, { format: job.audioFmt });
    vStream.on('error', (err) => {
      if (!headersSent) failStream(err);
    });
    aStream.on('error', (err) => {
      if (!headersSent) failStream(err);
    });

    const muxServer = http.createServer((mReq, mRes) => {
      if (mReq.url === '/v') {
        mRes.writeHead(200, { 'Content-Type': 'video/mp4' });
        vStream.pipe(mRes);
        mRes.on('close', () => { try { vStream.destroy(); } catch {} });
      } else if (mReq.url === '/a') {
        mRes.writeHead(200, { 'Content-Type': 'audio/mp4' });
        aStream.pipe(mRes);
        mRes.on('close', () => { try { aStream.destroy(); } catch {} });
      } else {
        mRes.writeHead(404);
        mRes.end();
      }
    });

    cleanups.push(() => {
      try { vStream.destroy(); } catch {}
      try { aStream.destroy(); } catch {}
      try { muxServer.close(); } catch {}
    });

    await new Promise((resolve) => muxServer.listen(0, '127.0.0.1', resolve));
    const muxPort = muxServer.address().port;

    const ff = spawn(FFMPEG_BIN, [
      '-y',
      '-i', `http://127.0.0.1:${muxPort}/v`,
      '-i', `http://127.0.0.1:${muxPort}/a`,
      '-c', 'copy',
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    cleanups.push(() => {
      try { ff.kill('SIGKILL'); } catch {}
    });

    let ffStderr = '';
    ff.stderr.on('data', (d) => (ffStderr += d.toString().slice(-300)));
    ff.stdout.on('data', writeChunkSafe);
    ff.on('error', failStream);
    ff.on('close', (code) => {
      cleanupAll();
      if (!headersSent && !aborted) {
        failStream(new Error(`MP4 mux failed (${code}): ${ffStderr}`));
      } else if (!res.writableEnded) {
        res.end();
      }
    });
    return;
  }

  // Mode 2: yt-dlp binary
  if (job.mode === 'ytdlp') {
    const bin = cachedYtDlpPath || (await ensureYtDlpRuntime());
    if (!bin) return failStream(new Error('yt-dlp unavailable'));

    const cookiesFile = getCookiesFile();
    const baseArgs = [
      '--js-runtimes', `node:${process.execPath}`,
      '--remote-components', 'ejs:github',
      '--force-ipv4',
      '--no-playlist',
      '--no-update',
      ...(cookiesFile ? ['--cookies', cookiesFile] : [])
    ];

    if (job.format === 'mp3') {
      const ytdlProc = spawn(bin, [...baseArgs, '-f', 'ba/b', '-o', '-', job.targetUrl], {
        stdio: ['ignore', 'pipe', 'pipe']
      });
      cleanups.push(() => { try { ytdlProc.kill('SIGKILL'); } catch {} });

      if (FFMPEG_BIN) {
        const ff = spawn(FFMPEG_BIN, [
          '-y',
          '-i', 'pipe:0',
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-f', 'mp3',
          'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        cleanups.push(() => { try { ff.kill('SIGKILL'); } catch {} });

        ytdlProc.on('error', (err) => { if (!headersSent) failStream(err); });
        ff.stdin.on('error', () => {});
        ytdlProc.stdout.pipe(ff.stdin);

        ff.stdout.on('data', writeChunkSafe);
        ff.on('error', failStream);
        ff.on('close', (code) => {
          cleanupAll();
          if (!headersSent && !aborted) failStream(new Error(`yt-dlp+ffmpeg exited ${code}`));
          else if (!res.writableEnded) res.end();
        });
        return;
      }

      ytdlProc.stdout.on('data', writeChunkSafe);
      ytdlProc.on('error', failStream);
      ytdlProc.on('close', (code) => {
        cleanupAll();
        if (!headersSent && !aborted) failStream(new Error(`yt-dlp exited ${code}`));
        else if (!res.writableEnded) res.end();
      });
      return;
    }

    // MP4 via yt-dlp: prefer progressive H.264/MP4 or merge into fragmented MP4 in temp file if needed
    const maxH = parseMaxHeight(job.quality);
    const fmtExpr =
      `bv*[vcodec^=avc1][height<=${maxH}]+ba[ext=m4a]/bv*[ext=mp4][height<=${maxH}]+ba[ext=m4a]/b[ext=mp4]/b`;

    if (FFMPEG_BIN) {
      // Download & remux safely to temp file when merging 2 DASH streams with yt-dlp, OR direct progressive stdout for IG/FB
      const tmpOut = path.join(os.tmpdir(), `md_${crypto.randomBytes(6).toString('hex')}.mp4`);
      cleanups.push(() => { try { fs.unlinkSync(tmpOut); } catch {} });

      const ytdlArgs = [
        ...baseArgs,
        '--ffmpeg-location', FFMPEG_BIN,
        '-f', fmtExpr,
        '--merge-output-format', 'mp4',
        '-o', tmpOut,
        job.targetUrl
      ];

      // Send status keepalive? Actually wait until complete or stream progressive for non-YouTube
      const isYoutube = detectPlatformServer(job.targetUrl) === 'youtube' || job.targetUrl.startsWith('ytsearch');
      if (!isYoutube) {
        const ytdlProc = spawn(bin, [...baseArgs, '-f', 'b[ext=mp4]/b', '-o', '-', job.targetUrl], {
          stdio: ['ignore', 'pipe', 'pipe']
        });
        cleanups.push(() => { try { ytdlProc.kill('SIGKILL'); } catch {} });
        ytdlProc.stdout.on('data', writeChunkSafe);
        ytdlProc.on('error', failStream);
        ytdlProc.on('close', (code) => {
          if (!headersSent && !aborted) failStream(new Error(`yt-dlp exited ${code}`));
          else if (!res.writableEnded) res.end();
        });
        return;
      }

      const ytdlProc = spawn(bin, ytdlArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      cleanups.push(() => { try { ytdlProc.kill('SIGKILL'); } catch {} });
      let yErr = '';
      ytdlProc.stderr.on('data', (d) => (yErr += d.toString().slice(-400)));
      ytdlProc.on('error', failStream);
      ytdlProc.on('close', (code) => {
        if (aborted) return cleanupAll();
        if (code === 0 && fs.existsSync(tmpOut)) {
          const stat = fs.statSync(tmpOut);
          headersSent = true;
          res.writeHead(200, { ...headers, 'Content-Length': stat.size });
          const rs = fs.createReadStream(tmpOut);
          cleanups.push(() => rs.destroy());
          rs.on('error', failStream);
          rs.on('end', cleanupAll);
          rs.pipe(res);
        } else {
          failStream(new Error(yErr || `yt-dlp mp4 exited ${code}`));
        }
      });
      return;
    }

    const ytdlProc = spawn(bin, [...baseArgs, '-f', 'b[ext=mp4]/b', '-o', '-', job.targetUrl], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    cleanups.push(() => { try { ytdlProc.kill('SIGKILL'); } catch {} });
    ytdlProc.stdout.on('data', writeChunkSafe);
    ytdlProc.on('error', failStream);
    ytdlProc.on('close', (code) => {
      cleanupAll();
      if (!headersSent && !aborted) failStream(new Error(`yt-dlp exited ${code}`));
      else if (!res.writableEnded) res.end();
    });
    return;
  }

  // Mode 3: Direct Social URL (IG / FB pure-Node fallback)
  if (job.mode === 'direct-url') {
    try {
      const upstream = await fetch(job.directUrl, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(30000)
      });
      if (!upstream.ok || !upstream.body) {
        return failStream(new Error(`Direct media HTTP ${upstream.status}`));
      }
      const nodeStream = Readable.fromWeb(upstream.body);
      cleanups.push(() => nodeStream.destroy());

      if (job.format === 'mp3' && FFMPEG_BIN) {
        const ff = spawn(FFMPEG_BIN, [
          '-y', '-i', 'pipe:0', '-vn', '-c:a', 'libmp3lame', '-b:a', '192k', '-f', 'mp3', 'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'pipe'] });
        cleanups.push(() => { try { ff.kill('SIGKILL'); } catch {} });
        nodeStream.on('error', () => {});
        ff.stdin.on('error', () => {});
        nodeStream.pipe(ff.stdin);
        ff.stdout.on('data', writeChunkSafe);
        ff.on('error', failStream);
        ff.on('close', () => {
          cleanupAll();
          if (!res.writableEnded) res.end();
        });
        return;
      }

      nodeStream.on('data', writeChunkSafe);
      nodeStream.on('error', failStream);
      nodeStream.on('end', () => {
        cleanupAll();
        if (!res.writableEnded) res.end();
      });
    } catch (err) {
      failStream(err);
    }
  }
}

// -------------------- HTTP Server Routes --------------------

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqUrl;
  try {
    reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  } catch {
    return sendJson(res, 400, { error: 'Invalid request URL' });
  }
  const pathname = reqUrl.pathname;

  // 1. Health & Diagnostics
  if (pathname === '/api/health') {
    return sendJson(res, 200, {
      status: 'ok',
      engine: 'hybrid-cloud-v2',
      platform: process.platform,
      arch: process.arch,
      node: process.version,
      ytDlp: { available: !!cachedYtDlpPath, version: cachedYtDlpVersion },
      ffmpeg: { available: !!FFMPEG_BIN },
      hasCookies: !!(process.env.YOUTUBE_COOKIES || process.env.COOKIES_TXT)
    });
  }

  // 2. Metadata Endpoint (/api/metadata?url=...)
  if (pathname === '/api/metadata') {
    const targetUrl = reqUrl.searchParams.get('url');
    if (!targetUrl) return sendJson(res, 400, { ok: false, error: 'Missing url parameter' });
    const platform = detectPlatformServer(targetUrl);
    if (!platform) return sendJson(res, 400, { ok: false, error: 'Unsupported platform' });

    try {
      if (platform === 'spotify') {
        const sp = await fetchSpotifyDetails(targetUrl);
        return sendJson(res, 200, { ok: true, data: sp });
      }
      if (platform === 'youtube') {
        try {
          const oe = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`, {
            signal: AbortSignal.timeout(5000)
          });
          if (oe.ok) {
            const d = await oe.json();
            const vidMatch = targetUrl.match(/(?:v=|\/shorts\/|\/live\/|youtu\.be\/)([\w\-]{11})/);
            const vid = vidMatch ? vidMatch[1] : null;
            return sendJson(res, 200, {
              ok: true,
              data: {
                title: d.title || 'סרטון יוטיוב',
                author: d.author_name || 'YouTube',
                thumbnail: vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : d.thumbnail_url || '',
                duration: 'וידאו / אודיו',
                platform: 'youtube',
                url: targetUrl,
                isPlaylist: false
              }
            });
          }
        } catch {}
        const info = await sharedYtdl.getInfo(targetUrl);
        return sendJson(res, 200, {
          ok: true,
          data: {
            title: info.videoDetails?.title || 'סרטון יוטיוב',
            author: info.videoDetails?.author?.name || 'YouTube',
            thumbnail: info.videoDetails?.thumbnails?.[0]?.url || '',
            duration: formatDurationSec(info.videoDetails?.lengthSeconds),
            platform: 'youtube',
            url: targetUrl,
            isPlaylist: false
          }
        });
      }
      // Instagram / Facebook
      const social = await fetchSocialGuestDetails(targetUrl);
      return sendJson(res, 200, {
        ok: true,
        data: {
          title: social.title,
          author: social.author,
          thumbnail: social.thumbnail,
          duration: 'וידאו',
          platform,
          url: targetUrl,
          isPlaylist: false
        }
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message });
    }
  }

  // 3. Playlist Endpoint (/api/playlist?url=...)
  if (pathname === '/api/playlist') {
    const targetUrl = reqUrl.searchParams.get('url');
    if (!targetUrl) return sendJson(res, 400, { ok: false, error: 'Missing url parameter' });
    const platform = detectPlatformServer(targetUrl);

    try {
      if (platform === 'spotify') {
        const sp = await fetchSpotifyDetails(targetUrl);
        return sendJson(res, 200, { ok: true, data: sp });
      }
      if (platform === 'youtube') {
        try {
          const pl = await sharedYtdl.getPlaylist(targetUrl, { limit: 60 });
          const videos = Array.isArray(pl.videos) ? pl.videos : [];
          if (videos.length > 0) {
            const items = videos.map((v, idx) => ({
              index: idx + 1,
              id: v.id,
              title: v.title || `רצועה ${idx + 1}`,
              author: v.author?.name || pl.author?.name || 'YouTube',
              duration: formatDurationSec(v.lengthSeconds),
              thumbnail: v.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
              url: v.url || `https://www.youtube.com/watch?v=${v.id}`,
              platform: 'youtube',
              selected: true
            }));
            return sendJson(res, 200, {
              ok: true,
              data: {
                title: pl.title || 'פלייליסט יוטיוב',
                author: pl.author?.name || 'YouTube Playlist',
                itemCount: items.length,
                platform: 'youtube',
                items
              }
            });
          }
        } catch (err) {
          console.warn('[Playlist ytdl fallback -> yt-dlp]:', err.message);
        }

        const json = await runYtDlpJson(targetUrl, ['--flat-playlist', '--playlist-end', '60']);
        const entries = Array.isArray(json.entries) ? json.entries : [];
        if (!entries.length) throw new Error('לא נמצאו סרטונים בפלייליסט או שהפלייליסט פרטי.');
        const items = entries.map((e, idx) => ({
          index: idx + 1,
          id: e.id || String(idx),
          title: e.title || `רצועה ${idx + 1}`,
          author: e.channel || e.uploader || json.uploader || 'YouTube',
          duration: formatDurationSec(e.duration),
          thumbnail: e.thumbnails?.[0]?.url || (e.id ? `https://img.youtube.com/vi/${e.id}/hqdefault.jpg` : ''),
          url: e.url?.startsWith('http') ? e.url : `https://www.youtube.com/watch?v=${e.id}`,
          platform: 'youtube',
          selected: true
        }));
        return sendJson(res, 200, {
          ok: true,
          data: {
            title: json.title || 'פלייליסט יוטיוב',
            author: json.uploader || 'YouTube Playlist',
            itemCount: items.length,
            platform: 'youtube',
            items
          }
        });
      }
      return sendJson(res, 400, { ok: false, error: 'רשימות השמעה נתמכות ביוטיוב ובספוטיפיי בלבד.' });
    } catch (err) {
      return sendJson(res, 422, { ok: false, error: err.message || 'שגיאה בטעינת פלייליסט' });
    }
  }

  // 4. Pre-Flight Resolve Endpoint (/api/resolve?url=...&format=mp3|mp4&quality=...)
  if (pathname === '/api/resolve') {
    const targetUrl = reqUrl.searchParams.get('url');
    const format = (reqUrl.searchParams.get('format') || 'mp3').toLowerCase() === 'mp4' ? 'mp4' : 'mp3';
    const quality = reqUrl.searchParams.get('quality') || 'max';
    const title = reqUrl.searchParams.get('title') || '';
    const author = reqUrl.searchParams.get('author') || '';

    if (!targetUrl) {
      return sendJson(res, 400, { ok: false, error: 'Missing url parameter' });
    }

    try {
      const job = await resolveMediaJob({ url: targetUrl, format, quality, title, author });
      const token = saveJob(job);
      const streamUrl = `/api/stream?token=${encodeURIComponent(token)}&title=${encodeURIComponent(job.title)}&format=${format}`;
      return sendJson(res, 200, {
        ok: true,
        token,
        downloadUrl: streamUrl,
        fileName: job.fileName,
        title: job.title,
        author: job.author,
        format,
        engine: job.mode
      });
    } catch (err) {
      return sendJson(res, 422, {
        ok: false,
        code: err.code || 'RESOLVE_FAILED',
        error: err.message || 'ההורדה נכשלה'
      });
    }
  }

  // 5. Token Stream Endpoint (/api/stream?token=...)
  if (pathname === '/api/stream') {
    const token = reqUrl.searchParams.get('token');
    const job = token ? resolvedJobs.get(token) : null;
    if (!job) {
      return sendJson(res, 404, { ok: false, error: 'קישור ההורדה פג תוקף. נא ללחוץ על הורדה שוב.' });
    }
    return streamResolvedJob(job, req, res);
  }

  // 6. Direct Download Endpoint (/api/download or Netlify path) - resolves + streams cleanly
  if (pathname === '/api/download' || pathname === '/.netlify/functions/download') {
    const targetUrl = reqUrl.searchParams.get('url');
    const format = (reqUrl.searchParams.get('format') || 'mp3').toLowerCase() === 'mp4' ? 'mp4' : 'mp3';
    const quality = reqUrl.searchParams.get('quality') || 'max';
    const title = reqUrl.searchParams.get('title') || '';
    const author = reqUrl.searchParams.get('author') || '';

    if (!targetUrl) {
      return sendJson(res, 400, { ok: false, error: 'Missing url parameter' });
    }

    try {
      const job = await resolveMediaJob({ url: targetUrl, format, quality, title, author });
      return streamResolvedJob(job, req, res);
    } catch (err) {
      return sendJson(res, 422, { ok: false, code: err.code || 'DOWNLOAD_FAILED', error: err.message });
    }
  }

  // 7. Static File Serving (STRICT: never return index.html for missing /api/ or missing JS/CSS!)
  if (pathname.startsWith('/api/') || pathname.startsWith('/.netlify/')) {
    return sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
  }

  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const ext = path.extname(pathname).toLowerCase();
      if (ext && ext !== '.html') {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404);
        res.end('File Not Found');
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300'
      });
      res.end(content);
    });
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  MediaDrop Cloud & Local Server v2.0 Running!`);
  console.log(`  Port: ${PORT}`);
  console.log(`  FFmpeg: ${FFMPEG_BIN || 'not found (raw mode)'}`);
  console.log(`  yt-dlp: ${cachedYtDlpPath || 'pending/unavailable'}`);
  console.log(`======================================================\n`);
});
