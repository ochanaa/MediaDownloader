/**
 * Playlist & Batch Packaging Module (v2.0)
 * Fetches real YouTube & Spotify playlists from server /api/playlist and bundles selected tracks into numbered ZIP.
 */

import { Security } from './security.js';
import { MediaEngine } from './engine.js';

export const PlaylistManager = {
  /**
   * Fetches playlist tracks from YouTube or Spotify via our server API
   */
  async fetchPlaylist(url, onProgress = () => {}) {
    const cleanUrl = Security.sanitizeUrl(url);
    const platform = Security.detectPlatform(cleanUrl);

    if (platform !== 'youtube' && platform !== 'spotify') {
      throw new Error('רשימות השמעה נתמכות ביוטיוב ובספוטיפיי בלבד.');
    }

    onProgress('סורק ומאחזר את כל שירי הפלייליסט...');
    const base = await MediaEngine.getApiBase();

    const res = await fetch(`${base}/api/playlist?url=${encodeURIComponent(cleanUrl)}`, {
      signal: AbortSignal.timeout(30000)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('השרת החזיר תשובה שגויה בעת טעינת הפלייליסט.');
    }

    const json = await res.json();
    if (!res.ok || !json.ok || !json.data) {
      throw new Error(json.error || 'לא ניתן היה לטעון את רשימת ההשמעה.');
    }

    const data = json.data;
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('לא נמצאו רצועות זמינות בפלייליסט.');
    }

    return data;
  },

  /**
   * Downloads selected tracks and bundles them into an organized numbered ZIP file.
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
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const track = selectedTracks[i];
      const trackNumber = String(i + 1).padStart(2, '0');
      const safeTitle = Security.sanitizeFileName(track.title);
      const fileName = `${trackNumber} - ${safeTitle}.${format}`;

      onProgress(i + 1, total, track.title, Math.round((i / total) * 100));

      try {
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

        const response = await fetch(downloadData.downloadUrl, { signal: AbortSignal.timeout(90000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const resType = response.headers.get('content-type') || '';
        if (resType.includes('text/html') || resType.includes('application/json')) {
          throw new Error('התקבלה תגובת שגיאה במקום קובץ מדיה');
        }

        const blob = await response.blob();
        if (blob.size < 1024) throw new Error('הקובץ שהתקבל ריק');

        folder.file(fileName, blob);
        successCount++;
      } catch (trackError) {
        console.warn(`Failed to package track ${track.title}:`, trackError);
        folder.file(`${fileName}.error.txt`, `שגיאה בהורדת הרצועה: ${trackError.message}\nקישור מקורי: ${track.url}`);
      }
    }

    if (successCount === 0) {
      throw new Error('לא ניתן היה להוריד אף רצועה מהרשימה. בדוק חיבור לשרת.');
    }

    onProgress(total, total, 'מייצר קובץ ZIP סופי...', 98);

    const zipBlob = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const zipFileName = `${folderName}.zip`;
    const zipUrl = URL.createObjectURL(zipBlob);

    MediaEngine.triggerBrowserDownload(zipUrl, zipFileName, false, zipBlob);

    setTimeout(() => URL.revokeObjectURL(zipUrl), 30000);

    onProgress(total, total, 'הורדת קובץ ה-ZIP הושלמה בהצלחה!', 100);

    return {
      fileName: zipFileName,
      size: zipBlob.size,
      trackCount: successCount
    };
  }
};
