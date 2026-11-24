/**
 * Security & Input Validation Module
 * Enforces strict input validation, URL sanitization, XSS prevention, and platform detection.
 */

export const Security = {
  PLATTERNS: {
    youtube: /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com\/(watch\?|shorts\/|live\/|playlist\?|embed\/)|youtu\.be\/)[\w\-?=&/%]+/i,
    spotify: /^(https?:\/\/)?(open\.)?spotify\.com\/(intl-[a-z-]+\/)?(track|playlist|album)\/[a-zA-Z0-9]+/i,
    instagram: /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/(p|reel|reels|tv|stories|share)\/[\w\-/%]+/i,
    facebook: /^(https?:\/\/)?(www\.|m\.|web\.|l\.)?(facebook\.com\/(watch|reel|share|.*\/videos\/)|fb\.watch\/)[\w\-?=&/%]+/i
  },

  /**
   * Identifies the platform from a given URL string.
   * Returns 'youtube' | 'spotify' | 'instagram' | 'facebook' | null
   */
  detectPlatform(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const cleanUrl = rawUrl.trim();
    if (!cleanUrl || /^(javascript|data|vbscript|file):/i.test(cleanUrl)) return null;

    try {
      const normalized = /^https?:\/\//i.test(cleanUrl) ? cleanUrl : `https://${cleanUrl}`;
      const parsed = new URL(normalized);
      const host = parsed.hostname.toLowerCase();
      const pathAndQuery = parsed.pathname + parsed.search;

      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        return parsed.pathname.length > 1 ? 'youtube' : null;
      }
      if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
        if (/^\/(watch|shorts\/|live\/|playlist|embed\/)/i.test(parsed.pathname)) {
          if (parsed.pathname === '/watch' && !parsed.searchParams.get('v')) return null;
          return 'youtube';
        }
      }
      if (host === 'open.spotify.com' || host === 'spotify.com') {
        if (/^\/(intl-[a-z-]+\/)?(track|playlist|album)\/[a-zA-Z0-9]+/i.test(parsed.pathname)) {
          return 'spotify';
        }
      }
      if (host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am') {
        if (/^\/(p|reel|reels|tv|stories|share)\/[\w\-]+/i.test(pathAndQuery)) {
          return 'instagram';
        }
      }
      if (host === 'fb.watch' || host === 'facebook.com' || host.endsWith('.facebook.com')) {
        if (/^\/(watch|reel\/|share\/|.*\/videos\/)/i.test(parsed.pathname) || host === 'fb.watch') {
          return 'facebook';
        }
      }
    } catch {}

    if (this.PLATTERNS.youtube.test(cleanUrl)) return 'youtube';
    if (this.PLATTERNS.spotify.test(cleanUrl)) return 'spotify';
    if (this.PLATTERNS.instagram.test(cleanUrl)) return 'instagram';
    if (this.PLATTERNS.facebook.test(cleanUrl)) return 'facebook';

    return null;
  },

  /**
   * Checks whether the given URL is a playlist or album.
   */
  isPlaylist(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return false;
    const clean = rawUrl.trim();
    if (/youtube\.com\/playlist/i.test(clean)) return true;
    try {
      const parsed = new URL(/^https?:\/\//i.test(clean) ? clean : `https://${clean}`);
      if (parsed.hostname.includes('youtu.be') && parsed.searchParams.has('list')) return true;
      if (parsed.hostname.includes('youtube.com') && parsed.searchParams.has('list') && !parsed.searchParams.has('v')) return true;
      if (/spotify\.com\/(intl-[a-z-]+\/)?(playlist|album)\//i.test(parsed.pathname + parsed.hostname)) return true;
    } catch {}
    if (/spotify\.com\/(intl-[a-z-]+\/)?(playlist|album)\//i.test(clean)) return true;
    return false;
  },

  /**
   * Sanitizes and normalizes an input URL.
   */
  sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let cleaned = rawUrl.trim();

    if (/^(javascript|data|vbscript|file):/i.test(cleaned)) {
      return '';
    }

    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = 'https://' + cleaned;
    }

    try {
      const parsed = new URL(cleaned);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return '';
      }
      return parsed.toString();
    } catch {
      return '';
    }
  },

  /**
   * Safe HTML string escaping to prevent XSS in rendering.
   */
  escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  /**
   * Sanitizes a string for use as a file name across Windows, Linux, Android.
   */
  sanitizeFileName(name, fallback = 'download') {
    if (!name || typeof name !== 'string') return fallback;
    let safe = name.replace(/[\\/:*?"<>|]/g, '-');
    safe = safe.replace(/-{2,}/g, '-');
    safe = safe.replace(/\s+/g, ' ').trim();
    if (safe.length > 120) {
      safe = safe.substring(0, 120).trim();
    }
    return safe || fallback;
  }
};
