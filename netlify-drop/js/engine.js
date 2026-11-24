/**
 * MediaDrop Multi-Engine Media Client Controller (v2.0)
 * Pre-verifies streams via /api/resolve so broken HTML error files are impossible.
 */

import { Security } from './security.js';

export const MediaEngine = {
  LOCAL_SERVER_URL: 'http://localhost:3000',

  getCloudServerUrl() {
    try {
      return (localStorage.getItem('mediadrop_cloud_url') || '').trim().replace(/\/+$/, '');
    } catch {
      return '';
    }
  },

  isNativeAndroid() {
    return typeof window !== 'undefined' && (!!window.AndroidBridge || navigator.userAgent.includes('MediaDropApp'));
  },

  async checkServerHealth(baseUrl = '') {
    try {
      const prefix = baseUrl.replace(/\/+$/, '');
      const res = await fetch(`${prefix}/api/health`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.status === 'ok' ? data : null;
    } catch {
      return null;
    }
  },

  /**
   * Resolves active API base URL:
   * - Custom Render/Cloud URL if configured in Settings
   * - Same-origin '' if served from Render / Node server
   * - Localhost:3000 on local Windows desktop
   * - Prompts clearly if on static Netlify Drop or unconfigured Android APK
   */
  async getApiBase() {
    const customCloud = this.getCloudServerUrl();
    if (customCloud) return customCloud;

    const isFile = window.location.protocol === 'file:';
    const isNetlifyHost = window.location.hostname.endsWith('netlify.app');

    if (this.isNativeAndroid() && isFile) {
      throw new Error('יש להזין את כתובת שרת הענן (Render) באפשרויות המתקדמות כדי להוריד מהאפליקציה.');
    }

    if (isFile) {
      const health = await this.checkServerHealth(this.LOCAL_SERVER_URL);
      if (health) return this.LOCAL_SERVER_URL;
      throw new Error('פתח את האתר דרך http://localhost:3000 (באמצעות start.bat) או הזן כתובת Render.');
    }

    if (isNetlifyHost) {
      throw new Error('Netlify אינה מריצה שרת הורדות. היכנס דרך הקישור של Render או הזן אותו באפשרויות המתקדמות.');
    }

    // Hosted directly on Render / localhost / Node server
    return '';
  },

  /**
   * Fetches rich metadata (uses server /api/metadata for Spotify real artists & IG/FB, with oEmbed fallback)
   */
  async fetchMetadata(url, onProgress = () => {}) {
    const cleanUrl = Security.sanitizeUrl(url);
    const platform = Security.detectPlatform(cleanUrl);

    if (!platform) {
      throw new Error('כתובת לא נתמכת. יש להזין קישור תקין מיוטיוב, ספוטיפיי, אינסטגרם או פייסבוק.');
    }

    onProgress('מזהה פלטפורמה ומאחזר פרטי מדיה...');

    try {
      const base = await this.getApiBase();
      const res = await fetch(`${base}/api/metadata?url=${encodeURIComponent(cleanUrl)}`, {
        signal: AbortSignal.timeout(12000)
      });
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json.data) {
          return {
            ...json.data,
            thumbnail: json.data.thumbnail || this._getDefaultThumbnail(platform),
            url: cleanUrl
          };
        }
      }
    } catch (err) {
      console.warn('Backend metadata fallback note:', err.message);
    }

    // Fallback: direct browser oEmbed for YouTube / Spotify
    try {
      if (platform === 'youtube') return await this._fetchYouTubeMetadata(cleanUrl);
      if (platform === 'spotify') return await this._fetchSpotifyOEmbed(cleanUrl);
    } catch {}

    return {
      title: `מדיה מ-${this.getPlatformHebrew(platform)}`,
      author: this.getPlatformHebrew(platform),
      thumbnail: this._getDefaultThumbnail(platform),
      duration: '—',
      platform,
      url: cleanUrl,
      isPlaylist: Security.isPlaylist(cleanUrl)
    };
  },

  async _fetchYouTubeMetadata(url) {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('לא ניתן לאחזר פרטים מיוטיוב');
    const data = await res.json();
    const videoIdMatch = url.match(/(?:v=|\/shorts\/|\/live\/|youtu\.be\/)([\w\-]{11})/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;
    return {
      title: data.title || 'סרטון יוטיוב',
      author: data.author_name || 'YouTube',
      thumbnail: videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : (data.thumbnail_url || this._getDefaultThumbnail('youtube')),
      duration: 'וידאו / אודיו',
      platform: 'youtube',
      url,
      isPlaylist: Security.isPlaylist(url)
    };
  },

  async _fetchSpotifyOEmbed(url) {
    const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
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
   * Pre-Flight Verified Download Processor:
   * Calls /api/resolve FIRST so errors throw cleanly in UI and never save .html files!
   */
  async requestDownload(mediaInfo, format = 'mp3', quality = 'max', onProgress = () => {}) {
    const cleanUrl = Security.sanitizeUrl(mediaInfo.url);
    const platform = mediaInfo.platform || Security.detectPlatform(cleanUrl);
    const base = await this.getApiBase();

    onProgress('מאמת ומכין את הקובץ להורדה ישירה...');

    const params = new URLSearchParams({
      url: cleanUrl,
      format,
      quality,
      title: mediaInfo.title || '',
      author: mediaInfo.author || ''
    });

    const res = await fetch(`${base}/api/resolve?${params.toString()}`, {
      signal: AbortSignal.timeout(45000)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('שרת ההורדות אינו זמין או החזיר תגובה שגויה (בדוק את כתובת Render).');
    }

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'השרת לא הצליח להכין את ההורדה.');
    }

    return {
      downloadUrl: `${base}${data.downloadUrl}`,
      fileName: data.fileName || Security.sanitizeFileName(`${mediaInfo.title}.${format}`),
      format,
      platform,
      title: data.title || mediaInfo.title,
      author: data.author || mediaInfo.author,
      thumbnail: mediaInfo.thumbnail || this._getDefaultThumbnail(platform)
    };
  },

  /**
   * Triggers native browser file download or Android Blob bridge
   */
  triggerBrowserDownload(url, filename, _isGateway = false, blobData = null) {
    if (this.isNativeAndroid() && window.AndroidBridge?.saveBase64File && blobData instanceof Blob) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = String(reader.result || '').split(',')[1] || '';
        if (base64) {
          window.AndroidBridge.saveBase64File(base64, filename || 'playlist.zip', blobData.type || 'application/zip');
        }
      };
      reader.readAsDataURL(blobData);
      return;
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
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
