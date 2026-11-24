/**
 * Playlist & Batch Packaging Module
 * Handles YouTube & Spotify playlist item parsing, selection, and client-side ZIP packaging using bundled JSZip.
 */

import { Security } from './security.js';
import { MediaEngine } from './engine.js';

export const PlaylistManager = {
  // Invidious instances for playlist parsing
  PLAYLIST_APIS: [
    'https://inv.tux.pizza',
    'https://invidious.nerdvpn.de',
    'https://vid.puffyan.us'
  ],

  /**
   * Fetches playlist tracks from a YouTube or Spotify playlist URL
   */
  async fetchPlaylist(url, onProgress = () => {}) {
    const cleanUrl = Security.sanitizeUrl(url);
    const platform = Security.detectPlatform(cleanUrl);

    onProgress('מנתח את רשימת השירים בפלייליסט...');

    if (platform === 'youtube') {
      return await this._fetchYouTubePlaylist(cleanUrl, onProgress);
    } else if (platform === 'spotify') {
      return await this._fetchSpotifyPlaylist(cleanUrl, onProgress);
    } else {
      throw new Error('רשימות השמעה נתמכות כרגע ביוטיוב ובספוטיפיי בלבד.');
    }
  },

  /**
   * YouTube Playlist fetching via Invidious playlist endpoint
   */
  async _fetchYouTubePlaylist(url, onProgress) {
    const listMatch = url.match(/[?&]list=([\w\-]+)/);
    if (!listMatch) {
      throw new Error('לא זוהה מזהה פלייליסט (list=) בקישור שהוזן.');
    }
    const playlistId = listMatch[1];

    let lastError = null;
    for (const host of this.PLAYLIST_APIS) {
      try {
        onProgress(`סורק רשימת שירים (שרת ${host.replace('https://', '')})...`);
        const res = await fetch(`${host}/api/v1/playlists/${playlistId}`, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const data = await res.json();

        if (Array.isArray(data.videos) && data.videos.length > 0) {
          const items = data.videos.map((v, idx) => ({
            index: idx + 1,
            id: v.videoId,
            title: v.title || `רצועה ${idx + 1}`,
            author: v.author || data.author || 'YouTube',
            duration: this._formatSeconds(v.lengthSeconds),
            thumbnail: v.videoThumbnails?.[0]?.url || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            selected: true
          }));

          return {
            title: data.title || 'פלייליסט יוטיוב',
            author: data.author || 'YouTube Playlist',
            itemCount: items.length,
            platform: 'youtube',
            items
          };
        }
      } catch (err) {
        lastError = err;
      }
    }

    throw new Error(lastError?.message || 'לא ניתן היה לטעון את רשימת ההשמעה. ייתכן שהפלייליסט פרטי או חסום.');
  },

  /**
   * Spotify Playlist parsing via Spotify oEmbed and metadata
   */
  async _fetchSpotifyPlaylist(url, onProgress) {
    onProgress('מזהה פלייליסט מספוטיפיי...');
    const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error('לא ניתן לגשת לפלייליסט בספוטיפיי');
    const data = await res.json();

    // Since Spotify oEmbed returns the title, thumbnail, and author:
    return {
      title: data.title || 'פלייליסט ספוטיפיי',
      author: data.author_name || 'Spotify',
      itemCount: 1,
      platform: 'spotify',
      items: [
        {
          index: 1,
          id: 'sp-1',
          title: data.title,
          author: data.author_name,
          duration: 'אודיו',
          thumbnail: data.thumbnail_url || MediaEngine._getDefaultThumbnail('spotify'),
          url: url,
          selected: true
        }
      ]
    };
  },

  /**
   * Downloads selected tracks and bundles them into an organized ZIP file.
   * onProgress: callback(current, total, trackTitle, percent)
   */
  async bundleSelectedToZip(playlistTitle, selectedTracks, format = 'mp3', onProgress = () => {}) {
    if (!window.JSZip) {
      throw new Error('ספריית יצירת ה-ZIP חסרה. אנא רענן את העמוד.');
    }

    if (!selectedTracks || selectedTracks.length === 0) {
      throw new Error('יש לבחור לפחות שיר אחד להורדה.');
    }

    const zip = new window.JSZip();
    const folderName = Security.sanitizeFileName(playlistTitle, 'Playlist');
    const folder = zip.folder(folderName);
    const total = selectedTracks.length;

    for (let i = 0; i < total; i++) {
      const track = selectedTracks[i];
      const trackNumber = String(i + 1).padStart(2, '0');
      const safeTitle = Security.sanitizeFileName(track.title);
      const fileName = `${trackNumber} - ${safeTitle}.${format}`;

      onProgress(i + 1, total, track.title, Math.round(((i) / total) * 100));

      try {
        // Request download link from engine
        const downloadData = await MediaEngine.requestDownload(
          {
            title: track.title,
            author: track.author,
            url: track.url,
            platform: track.platform || 'youtube',
            thumbnail: track.thumbnail
          },
          format,
          'max'
        );

        // Fetch the raw stream bytes for bundling into ZIP
        const response = await fetch(downloadData.downloadUrl, { mode: 'cors' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();

        folder.file(fileName, blob);
      } catch (trackError) {
        console.warn(`Failed to package track ${track.title}:`, trackError);
        // Add a text note in the zip for any track that failed
        folder.file(`${fileName}.error.txt`, `שגיאה בהורדת הרצועה: ${trackError.message}\nקישור מקורי: ${track.url}`);
      }
    }

    onProgress(total, total, 'מייצר קובץ ZIP סופי...', 98);

    // Generate the final ZIP blob
    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFileName = `${folderName}.zip`;
    const zipUrl = URL.createObjectURL(zipBlob);

    // Trigger browser download of the complete zip
    MediaEngine.triggerBrowserDownload(zipUrl, zipFileName);

    // Revoke object URL after delay
    setTimeout(() => URL.revokeObjectURL(zipUrl), 30000);

    onProgress(total, total, 'הורדת קובץ ה-ZIP הושלמה בהצלחה!', 100);

    return {
      fileName: zipFileName,
      size: zipBlob.size,
      trackCount: total
    };
  },

  /**
   * Helper to format seconds into mm:ss
   */
  _formatSeconds(sec) {
    if (!sec || isNaN(sec)) return '—';
    const s = parseInt(sec, 10);
    const mins = Math.floor(s / 60);
    const remainder = s % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  }
};
