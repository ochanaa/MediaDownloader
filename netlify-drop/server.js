/**
 * MediaDrop Universal Cloud & Local Server (ES Module)
 * Dual-Engine: Uses native yt-dlp if available, with automatic fallback to pure @distube/ytdl-core.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { Ytdl, chooseFormat } from '@distube/ytdl-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

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

const server = http.createServer(async (req, res) => {
  // CORS headers for all origins
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = reqUrl.pathname;

  // 1. Health check
  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', engine: 'hybrid-cloud', local: true }));
    return;
  }

  // 2. Direct Download Stream Endpoint
  if (pathname === '/api/download') {
    const targetUrl = reqUrl.searchParams.get('url');
    const format = (reqUrl.searchParams.get('format') || 'mp3').toLowerCase();
    const quality = reqUrl.searchParams.get('quality') || 'max';
    const rawTitle = reqUrl.searchParams.get('title') || 'media';

    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing url parameter' }));
      return;
    }

    console.log(`[MediaDrop Cloud] Stream Request for: ${targetUrl} (${format})`);

    const safeTitle = rawTitle.replace(/[\\/:*?"<>|]/g, '-').trim() || 'media';
    const fileExt = format === 'mp3' ? 'mp3' : 'mp4';
    const filename = `${safeTitle}.${fileExt}`;
    const encodedFilename = encodeURIComponent(filename);

    let processUrl = targetUrl;
    if (targetUrl.includes('spotify.com')) {
      const query = `${rawTitle} ${reqUrl.searchParams.get('author') || ''}`.trim();
      processUrl = `ytsearch1:${query || targetUrl}`;
    }

    // Attempt Engine 1: yt-dlp binary (works on Docker & Local)
    try {
      let formatArgs = [];
      if (format === 'mp3') {
        formatArgs = ['-f', 'ba/b'];
      } else {
        if (quality === '1080') formatArgs = ['-f', 'bv*[height<=1080]+ba/b[height<=1080]/b'];
        else if (quality === '720') formatArgs = ['-f', 'bv*[height<=720]+ba/b[height<=720]/b'];
        else if (quality === '480') formatArgs = ['-f', 'bv*[height<=480]+ba/b[height<=480]/b'];
        else formatArgs = ['-f', 'ba/b[height<=1080]/b'];
      }

      res.writeHead(200, {
        'Content-Type': format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
        'Content-Disposition': `attachment; filename="${safeTitle}.${fileExt}"; filename*=UTF-8''${encodedFilename}`,
        'Transfer-Encoding': 'chunked'
      });

      const ytdlArgs = [
        ...formatArgs,
        '--no-playlist',
        '--no-update',
        '-o', '-',
        processUrl
      ];

      const child = spawn('yt-dlp', ytdlArgs);
      let started = false;

      child.stdout.on('data', (chunk) => {
        started = true;
        res.write(chunk);
      });

      child.stdout.on('end', () => {
        res.end();
      });

      child.on('error', async (err) => {
        console.warn('[yt-dlp not available, falling back to @distube/ytdl-core]:', err.message);
        if (!started) {
          await fallbackToDistube(targetUrl, format, res);
        }
      });

      req.on('close', () => {
        child.kill();
      });

    } catch (e) {
      console.warn('[Engine 1 error, running Engine 2]:', e.message);
      await fallbackToDistube(targetUrl, format, res);
    }

    return;
  }

  // 3. Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
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
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

async function fallbackToDistube(url, format, res) {
  try {
    const ytdl = new Ytdl();
    const info = await ytdl.getInfo(url);
    const filter = format === 'mp3' ? f => f.hasAudio && !f.hasVideo : f => f.hasVideo;
    const stream = await ytdl.download(url, { filter });
    stream.pipe(res);
  } catch (err) {
    console.error('All engines failed for url:', url, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    } else {
      res.destroy();
    }
  }
}

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 MediaDrop Universal Server is running!`);
  console.log(`  🔗 Port: ${PORT}`);
  console.log(`  ⚡ Multi-Engine Active (yt-dlp + @distube/ytdl-core)`);
  console.log(`======================================================\n`);
});
