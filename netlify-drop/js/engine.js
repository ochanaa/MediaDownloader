/**
 * MediaDrop Multi-Engine Media Extraction & Download Engine
 * Connects to 24/7 Cloud Netlify Functions, Custom Cloud Server, or Local High-Speed Engine.
 * 100% self-contained direct downloads — zero external website redirects.
 */

import { Security } from './security.js';

export const MediaEngine = {
  LOCAL_SERVER_URL: 'http://localhost:3000',
  NETLIFY_FUNCTION_URL: '/.netlify/functions/download',
  isLocalServerActive: null,
  isNetlifyActive: null,

  /**
   * Probes whether the local high-speed yt-dlp server is running
   */
  async checkLocalServer() {
    try {
      const res = await fetch(`${this.LOCAL_SERVER_URL}/api/health`, {
        signal: AbortSignal.timeout(1000)
      });
      if (res.ok) {
        const data = await res.json();
        this.isLocalServerActive = data.status === 'ok';
        return this.isLocalServerActive;
      }
    } catch {
      this.isLocalServerActive = false;
    }
    return false;
  },

  /**
   * Checks whether Netlify Functions are available on current host
   */
  async checkNetlifyFunctions() {
    if (window.location.protocol === 'file:') return false;
    try {
      const res = await fetch(`${this.NETLIFY_FUNCTION_URL}`, {
        method: 'OPTIONS',
        signal: AbortSignal.timeout(1500)
      });
      this.isNetlifyActive = res.status === 204 || res.status === 200 || res.status === 400;
      return this.isNetlifyActive;
    } catch {
      this.isNetlifyActive = false;
      return false;
    }
  },

  /**
   * Fetches metadata for preview (title, author, thumbnail, duration)
   */
  async fetchMetadata(url, onProgress = () => {}) {
    const cleanUrl = Security.sanitizeUrl(url);
    const platform = Security.detectPlatform(cleanUrl);

    if (!platform) {
      throw new Error('כתובת לא נתמכת. יש להזין קישור מיוטיוב, ספוטיפיי, אינסטגרם או פייסבוק.');
    }

    onProgress('מזהה פלטפורמה ומנתח פרטי מדיה...');

    try {
      if (platform === 'youtube') {
        return await this._fetchYouTubeMetadata(cleanUrl);
      } else if (platform === 'spotify') {
        return await this._fetchSpotifyMetadata(cleanUrl);
      } else if (platform === 'instagram') {
        return await this._fetchInstagramMetadata(cleanUrl);
      } else if (platform === 'facebook') {
        return await this._fetchFacebookMetadata(cleanUrl);
      }
    } catch (err) {
      console.warn('Metadata fetch error, falling back to basic preview:', err);
      return {
        title: `מדיה מ-${this.getPlatformHebrew(platform)}`,
        author: this.getPlatformHebrew(platform),
        thumbnail: this._getDefaultThumbnail(platform),
        duration: '—',
        platform,
        url: cleanUrl,
        isPlaylist: Security.isPlaylist(cleanUrl)
      };
    }
  },

  /**
   * YouTube Metadata via official oEmbed
   */
  async _fetchYouTubeMetadata(url) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('לא ניתן לאחזר פרטים מיוטיוב');
    const data = await res.json();

    const videoIdMatch = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([\w\-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    const thumbnail = videoId
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : (data.thumbnail_url || this._getDefaultThumbnail('youtube'));

    return {
      title: data.title || 'סרטון יוטיוב',
      author: data.author_name || 'YouTube',
      thumbnail,
      duration: 'וידאו / אודיו',
      platform: 'youtube',
      url,
      isPlaylist: Security.isPlaylist(url)
    };
  },

  /**
   * Spotify Metadata via official oEmbed
   */
  async _fetchSpotifyMetadata(url) {
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('לא ניתן לאחזר פרטים מספוטיפיי');
    const data = await res.json();

    return {
      title: data.title || 'שיר בספוטיפיי',
      author: data.author_name || 'Spotify',
      thumbnail: data.thumbnail_url || this._getDefaultThumbnail('spotify'),
      duration: 'רצועת אודיו',
      platform: 'spotify',
      url,
      isPlaylist: Security.isPlaylist(url)
    };
  },

  /**
   * Instagram Metadata
   */
  async _fetchInstagramMetadata(url) {
    return {
      title: 'סרטון / רילס מאינסטגרם',
      author: 'Instagram',
      thumbnail: this._getDefaultThumbnail('instagram'),
      duration: 'וידאו',
      platform: 'instagram',
      url,
      isPlaylist: false
    };
  },

  /**
   * Facebook Metadata
   */
  async _fetchFacebookMetadata(url) {
    return {
      title: 'סרטון מפייסבוק',
      author: 'Facebook Video',
      thumbnail: this._getDefaultThumbnail('facebook'),
      duration: 'וידאו',
      platform: 'facebook',
      url,
      isPlaylist: false
    };
  },

  /**
   * Primary Download Processor
   * Dispatches direct streaming from:
   * 1. 24/7 Cloud Netlify Functions (on live site)
   * 2. Local yt-dlp Engine (if running on local machine)
   * 3. Prevents invalid relative file:// paths that cause Chrome "Site wasn't available" errors
   */
  async requestDownload(mediaInfo, format = 'mp3', quality = 'max', onProgress = () => {}) {
    const cleanUrl = Security.sanitizeUrl(mediaInfo.url);
    const platform = mediaInfo.platform || Security.detectPlatform(cleanUrl);
    const safeTitle = Security.sanitizeFileName(`${mediaInfo.title}.${format}`);

    onProgress('מכין הורדה ישירה...');

    const isFileProtocol = window.location.protocol === 'file:';
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // 1. If running locally or on file:// protocol, route directly to local server
    if (isFileProtocol || isLocalhost) {
      onProgress('מחובר למנוע ההורדות המקומי...');
      const endpoint = `${this.LOCAL_SERVER_URL}/api/download?url=${encodeURIComponent(cleanUrl)}&format=${format}&quality=${quality}&title=${encodeURIComponent(mediaInfo.title)}&author=${encodeURIComponent(mediaInfo.author)}`;
      return {
        downloadUrl: endpoint,
        fileName: safeTitle,
        format,
        platform,
        title: mediaInfo.title,
        author: mediaInfo.author,
        thumbnail: mediaInfo.thumbnail
      };
    }

    // 2. Check if running on Netlify Cloud
    const isNetlify = await this.checkNetlifyFunctions();
    if (isNetlify) {
      onProgress('מעבד הורדה דרך שרתי הענן של האתר...');
      const endpoint = `${this.NETLIFY_FUNCTION_URL}?url=${encodeURIComponent(cleanUrl)}&format=${format}&quality=${quality}&title=${encodeURIComponent(mediaInfo.title)}&author=${encodeURIComponent(mediaInfo.author)}`;
      return {
        downloadUrl: endpoint,
        fileName: safeTitle,
        format,
        platform,
        title: mediaInfo.title,
        author: mediaInfo.author,
        thumbnail: mediaInfo.thumbnail
      };
    }

    // 3. Fallback for deployed domains with /api/download redirect
    const endpoint = `/api/download?url=${encodeURIComponent(cleanUrl)}&format=${format}&quality=${quality}&title=${encodeURIComponent(mediaInfo.title)}&author=${encodeURIComponent(mediaInfo.author)}`;
    return {
      downloadUrl: endpoint,
      fileName: safeTitle,
      format,
      platform,
      title: mediaInfo.title,
      author: mediaInfo.author,
      thumbnail: mediaInfo.thumbnail
    };
  },

  /**
   * Triggers the direct browser file download cleanly without blank tab glitch
   */
  triggerBrowserDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    // No target="_blank" so Chrome downloads smoothly in the same tab
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 1000);
  },

  getPlatformHebrew(platform) {
    switch (platform) {
      case 'youtube': return 'YouTube';
      case 'spotify': return 'Spotify';
      case 'instagram': return 'Instagram';
      case 'facebook': return 'Facebook';
      default: return 'מדיה';
    }
  },

  _getDefaultThumbnail(platform) {
    const colors = {
      youtube: '#ff0000',
      spotify: '#1db954',
      instagram: '#e1306c',
      facebook: '#1877f2'
    };
    const color = colors[platform] || '#6366f1';
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
        <rect width="100%" height="100%" fill="#111827"/>
        <circle cx="240" cy="135" r="54" fill="${color}" opacity="0.85"/>
        <polygon points="230,115 260,135 230,155" fill="#ffffff"/>
      </svg>
    `.trim();
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
};
