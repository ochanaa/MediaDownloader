/**
 * Security & Input Validation Module
 * Enforces strict input validation, URL sanitization, XSS prevention, and platform detection.
 */

export const Security = {
  // Supported platform domains & regex patterns
  PLATTERNS: {
    youtube: /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|playlist\?list=)|youtu\.be\/)[\w\-]+/i,
    spotify: /^(https?:\/\/)?(open\.)?spotify\.com\/(track|playlist|album)\/[a-zA-Z0-9]+/i,
    instagram: /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/(p|reel|tv|stories)\/[\w\-]+/i,
    facebook: /^(https?:\/\/)?(www\.|m\.|web\.)?(facebook\.com\/(?:watch\/\?v=|.*\/videos\/)|fb\.watch\/)[\w\-]+/i
  },

  /**
   * Identifies the platform from a given URL string.
   * Returns 'youtube' | 'spotify' | 'instagram' | 'facebook' | null
   */
  detectPlatform(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    const cleanUrl = rawUrl.trim();

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
    if (clean.includes('youtube.com/playlist') || (clean.includes('youtu.be') && clean.includes('list='))) return true;
    if (clean.includes('spotify.com/playlist') || clean.includes('spotify.com/album')) return true;
    return false;
  },

  /**
   * Sanitizes and normalizes an input URL.
   * Ensures protocol and removes dangerous characters.
   */
  sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let cleaned = rawUrl.trim();

    // Check for javascript: or data: injection
    if (/^(javascript|data|vbscript|file):/i.test(cleaned)) {
      return '';
    }

    // Auto prepend https if missing
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = 'https://' + cleaned;
    }

    try {
      const parsed = new URL(cleaned);
      // Only permit http and https
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
    // Remove invalid filename characters: \ / : * ? " < > |
    let safe = name.replace(/[\\/:*?"<>|]/g, '-');
    // Collapse consecutive hyphens into single hyphen
    safe = safe.replace(/-{2,}/g, '-');
    // Collapse consecutive whitespace into single space
    safe = safe.replace(/\s+/g, ' ').trim();
    // Cap length to 120 chars
    if (safe.length > 120) {
      safe = safe.substring(0, 120).trim();
    }
    return safe || fallback;
  }
};
