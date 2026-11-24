/**
 * MediaDrop Cross-Platform Postinstall Setup
 * Ensures standalone yt-dlp binary (on Linux/Render) and ffmpeg-static binary are ready.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function hasCommand(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function ensureFfmpeg() {
  if (hasCommand('ffmpeg')) {
    console.log('[MediaDrop Setup] System ffmpeg found in PATH.');
    return;
  }
  try {
    const mod = await import('ffmpeg-static');
    const binPath = mod.default;
    if (binPath && fs.existsSync(binPath)) {
      console.log('[MediaDrop Setup] ffmpeg-static ready:', binPath);
      return;
    }
    const installer = path.join(__dirname, 'node_modules', 'ffmpeg-static', 'install.js');
    if (fs.existsSync(installer)) {
      console.log('[MediaDrop Setup] Downloading ffmpeg-static binary...');
      execSync(`"${process.execPath}" "${installer}"`, { stdio: 'inherit' });
    }
  } catch (err) {
    console.warn('[MediaDrop Setup] ffmpeg-static note:', err.message);
  }
}

async function ensureYtDlpLinux() {
  if (hasCommand('yt-dlp')) {
    console.log('[MediaDrop Setup] System yt-dlp found in PATH.');
    return;
  }
  if (process.platform !== 'linux') {
    console.log('[MediaDrop Setup] Non-Linux environment; skipping Linux yt-dlp binary download.');
    return;
  }

  const dest = path.join(__dirname, 'yt-dlp');
  if (fs.existsSync(dest) && fs.statSync(dest).size > 5 * 1024 * 1024) {
    try { fs.chmodSync(dest, 0o755); } catch {}
    console.log('[MediaDrop Setup] Local yt-dlp Linux binary already present.');
    return;
  }

  const isMusl = fs.existsSync('/etc/alpine-release');
  const assetName = isMusl ? 'yt-dlp_musllinux' : 'yt-dlp_linux';
  const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;

  console.log(`[MediaDrop Setup] Downloading standalone ${assetName} from GitHub...`);
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    fs.chmodSync(dest, 0o755);
    console.log(`[MediaDrop Setup] ${assetName} installed (${(buf.length / 1024 / 1024).toFixed(1)} MB).`);
  } catch (err) {
    console.warn('[MediaDrop Setup] Failed to download standalone yt-dlp:', err.message);
  }
}

await ensureFfmpeg();
await ensureYtDlpLinux();
