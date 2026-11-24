/**
 * MediaDrop Main Controller & State Coordinator
 * Orchestrates navigation, UI state transitions, URL handling, Web Share Target processing, and downloads.
 */

import { Security } from './security.js';
import { MediaEngine } from './engine.js';
import { PlaylistManager } from './playlist.js';
import { HistoryManager } from './history.js';
import { MediaPlayer } from './player.js';

class MediaDropApp {
  constructor() {
    this.currentMedia = null;
    this.currentPlaylist = null;
    this.activeTab = 'direct'; // 'direct' | 'playlist' | 'history'
    this.selectedQuality = 'max';
  }

  init() {
    // Initialize components
    MediaPlayer.init();

    // Cache DOM Elements
    this.urlInput = document.getElementById('url-input');
    this.pasteBtn = document.getElementById('paste-btn');
    this.clearBtn = document.getElementById('clear-btn');
    this.analyzeBtn = document.getElementById('analyze-btn');
    this.statusAura = document.getElementById('status-aura');
    this.statusText = document.getElementById('status-text');

    this.mediaCard = document.getElementById('media-card');
    this.mediaThumbnail = document.getElementById('media-thumb');
    this.mediaTitle = document.getElementById('media-title');
    this.mediaAuthor = document.getElementById('media-author');
    this.mediaDuration = document.getElementById('media-duration');
    this.mediaBadge = document.getElementById('media-platform-badge');

    this.downloadMp3Btn = document.getElementById('download-mp3-btn');
    this.downloadMp4Btn = document.getElementById('download-mp4-btn');
    this.qualitySelect = document.getElementById('quality-select');
    this.advancedToggle = document.getElementById('advanced-toggle');
    this.advancedPanel = document.getElementById('advanced-panel');

    this.playlistCard = document.getElementById('playlist-card');
    this.playlistTracksList = document.getElementById('playlist-tracks-list');
    this.playlistDownloadZipBtn = document.getElementById('playlist-download-zip-btn');
    this.playlistSelectAllBtn = document.getElementById('playlist-select-all');
    this.playlistDeselectAllBtn = document.getElementById('playlist-deselect-all');
    this.playlistProgressBar = document.getElementById('playlist-progress-bar');
    this.playlistProgressFill = document.getElementById('playlist-progress-fill');
    this.playlistProgressText = document.getElementById('playlist-progress-text');

    this.historyList = document.getElementById('history-list');
    this.historyEmpty = document.getElementById('history-empty');
    this.clearHistoryBtn = document.getElementById('clear-history-btn');

    this.quickShareModal = document.getElementById('quick-share-modal');
    this.quickShareTitle = document.getElementById('quick-share-title');
    this.quickShareThumb = document.getElementById('quick-share-thumb');
    this.quickShareMp3Btn = document.getElementById('quick-share-mp3');
    this.quickShareMp4Btn = document.getElementById('quick-share-mp4');
    this.quickShareCloseBtn = document.getElementById('quick-share-close');

    // Bind Event Handlers
    this._bindEvents();

    // Render initial history
    this._renderHistory();

    // Check for Web Share Target or query params
    this._checkShareTargetParams();

    if (window.location.protocol === 'file:') {
      this.showToast('מומלץ לפתוח דרך http://localhost:3000 (או להפעיל את start.bat) להורדות מושלמות', 'info');
    }
  }

  _bindEvents() {
    // Tab Switching
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Paste & Go Button
    if (this.pasteBtn) {
      this.pasteBtn.addEventListener('click', () => this.handlePaste());
    }

    // Clear Input Button
    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => {
        this.urlInput.value = '';
        this.handleInputChange();
        this.urlInput.focus();
      });
    }

    // Input changes & real-time validation
    if (this.urlInput) {
      this.urlInput.addEventListener('input', () => this.handleInputChange());
      this.urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleAnalyze();
        }
      });
    }

    // Analyze Button
    if (this.analyzeBtn) {
      this.analyzeBtn.addEventListener('click', () => this.handleAnalyze());
    }

    // Download MP3 Button
    if (this.downloadMp3Btn) {
      this.downloadMp3Btn.addEventListener('click', () => this.executeDownload('mp3'));
    }

    // Download MP4 Button
    if (this.downloadMp4Btn) {
      this.downloadMp4Btn.addEventListener('click', () => this.executeDownload('mp4'));
    }

    // Advanced toggle
    if (this.advancedToggle && this.advancedPanel) {
      this.advancedToggle.addEventListener('click', () => {
        const isHidden = this.advancedPanel.classList.toggle('hidden');
        this.advancedToggle.setAttribute('aria-expanded', !isHidden);
      });
    }

    // Quality selection
    if (this.qualitySelect) {
      this.qualitySelect.addEventListener('change', (e) => {
        this.selectedQuality = e.target.value;
      });
    }

    // Playlist Controls
    if (this.playlistSelectAllBtn) {
      this.playlistSelectAllBtn.addEventListener('click', () => this._setPlaylistSelection(true));
    }
    if (this.playlistDeselectAllBtn) {
      this.playlistDeselectAllBtn.addEventListener('click', () => this._setPlaylistSelection(false));
    }
    if (this.playlistDownloadZipBtn) {
      this.playlistDownloadZipBtn.addEventListener('click', () => this.executePlaylistZipDownload());
    }

    // History Updates & Clear
    window.addEventListener('mediadrop:history-updated', () => this._renderHistory());
    if (this.clearHistoryBtn) {
      this.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('האם אתה בטוח שברצונך למחוק את כל היסטוריית ההורדות?')) {
          HistoryManager.clear();
        }
      });
    }

    // Quick Share Modal Events
    if (this.quickShareCloseBtn) {
      this.quickShareCloseBtn.addEventListener('click', () => this._closeQuickShareModal());
    }
    if (this.quickShareMp3Btn) {
      this.quickShareMp3Btn.addEventListener('click', () => {
        this._closeQuickShareModal();
        this.executeDownload('mp3');
      });
    }
    if (this.quickShareMp4Btn) {
      this.quickShareMp4Btn.addEventListener('click', () => {
        this._closeQuickShareModal();
        this.executeDownload('mp4');
      });
    }
  }

  /**
   * Switches the active interface tab
   */
  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('[data-tab]').forEach(btn => {
      const isCurrent = btn.getAttribute('data-tab') === tab;
      btn.classList.toggle('active-tab', isCurrent);
      btn.setAttribute('aria-selected', isCurrent);
    });

    const directSec = document.getElementById('tab-section-direct');
    const playlistSec = document.getElementById('tab-section-playlist');
    const historySec = document.getElementById('tab-section-history');

    if (directSec) directSec.classList.toggle('hidden', tab !== 'direct');
    if (playlistSec) playlistSec.classList.toggle('hidden', tab !== 'playlist');
    if (historySec) historySec.classList.toggle('hidden', tab !== 'history');

    if (tab === 'history') {
      this._renderHistory();
    }
  }

  /**
   * One-click clipboard paste handler
   */
  async handlePaste() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        this.showToast('אין גישה ללוח ההעתקה בדפדפן זה. הדבק ידנית.', 'warning');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        this.showToast('לוח ההעתקה ריק. העתק קישור תחילה.', 'info');
        return;
      }
      this.urlInput.value = text.trim();
      this.handleInputChange();
      this.showToast('הקישור הודבק בהצלחה!', 'success');
      // Automatically trigger analysis
      this.handleAnalyze();
    } catch (err) {
      this.showToast('לא התקבלה הרשאה לקריאת הלוח.', 'warning');
    }
  }

  /**
   * Real-time input change & platform indicator detection
   */
  handleInputChange() {
    const raw = this.urlInput.value.trim();
    if (this.clearBtn) {
      this.clearBtn.classList.toggle('hidden', !raw);
    }

    const platform = Security.detectPlatform(raw);
    this._highlightPlatformBadge(platform);

    if (platform) {
      this._updateStatus('ready', `זוהה קישור מ-${MediaEngine.getPlatformHebrew(platform)}`);
    } else if (raw) {
      this._updateStatus('validating', 'בודק תקינות קישור...');
    } else {
      this._updateStatus('idle', 'מוכן להדבקת קישור');
    }
  }

  /**
   * Primary Analyze Handler
   */
  async handleAnalyze() {
    const rawUrl = this.urlInput.value.trim();
    const cleanUrl = Security.sanitizeUrl(rawUrl);
    const platform = Security.detectPlatform(cleanUrl);

    if (!cleanUrl || !platform) {
      this.showToast('נא להזין קישור תקין מיוטיוב, ספוטיפיי, אינסטגרם או פייסבוק.', 'error');
      this.urlInput.focus();
      return;
    }

    const isPlaylist = Security.isPlaylist(cleanUrl);

    this._setLoading(true, 'מנתח קישור ומאחזר פרטי מדיה...');

    try {
      if (isPlaylist && this.activeTab !== 'playlist') {
        // Auto-switch to playlist tab if user pasted a playlist in direct mode
        this.switchTab('playlist');
      }

      if (this.activeTab === 'playlist' || isPlaylist) {
        // Fetch playlist items
        this.currentPlaylist = await PlaylistManager.fetchPlaylist(cleanUrl, (msg) => {
          this._updateStatus('loading', msg);
        });
        this._renderPlaylistView(this.currentPlaylist);
        this.showToast(`נטענו ${this.currentPlaylist.itemCount} שירים מהפלייליסט!`, 'success');
      } else {
        // Fetch single media info
        this.currentMedia = await MediaEngine.fetchMetadata(cleanUrl, (msg) => {
          this._updateStatus('loading', msg);
        });
        this._renderMediaCard(this.currentMedia);
        this.showToast('פרטי המדיה אומתו בהצלחה!', 'success');
      }

      this._updateStatus('ready', 'המדיה מוכנה להורדה');
    } catch (err) {
      console.error('Analyze failed:', err);
      this._updateStatus('error', err.message || 'שגיאה באחזור פרטי המדיה');
      this.showToast(err.message || 'שגיאה באחזור פרטי המדיה. נסה שוב.', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  /**
   * Executes download for single media
   */
  async executeDownload(format) {
    if (!this.currentMedia) {
      this.showToast('אנא נתח קישור לפני ביצוע הורדה.', 'warning');
      return;
    }

    const btn = format === 'mp3' ? this.downloadMp3Btn : this.downloadMp4Btn;
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> מכין קובץ...`;
    }

    this._updateStatus('loading', `מעבד קובץ ${format.toUpperCase()}...`);

    try {
      const result = await MediaEngine.requestDownload(
        this.currentMedia,
        format,
        this.selectedQuality,
        (msg) => this._updateStatus('loading', msg)
      );

      // Save to local history
      HistoryManager.add({
        title: result.title,
        author: result.author,
        format: result.format,
        platform: result.platform,
        thumbnail: result.thumbnail,
        downloadUrl: result.downloadUrl,
        fileName: result.fileName
      });

      // Trigger file download in browser
      MediaEngine.triggerBrowserDownload(result.downloadUrl, result.fileName, result.isGateway);

      if (result.isGateway) {
        this.showToast('ערוץ ההורדה הישיר נפתח בלשונית חדשה!', 'info');
        this._updateStatus('ready', 'נפתח ערוץ הורדה ישיר');
      } else {
        this.showToast(`הורדת ${result.fileName} החלה בהצלחה!`, 'success');
        this._updateStatus('ready', 'ההורדה הושלמה בהצלחה');
      }
    } catch (err) {
      console.error('Download execution failed:', err);
      this.showToast(err.message || 'ההורדה נכשלה. נסה שוב או נסה שרת חלופי.', 'error');
      this._updateStatus('error', 'הורדה נכשלה');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  /**
   * Executes batch download for selected playlist tracks to ZIP
   */
  async executePlaylistZipDownload() {
    if (!this.currentPlaylist || !this.currentPlaylist.items) return;

    const selected = this.currentPlaylist.items.filter(item => item.selected);
    if (!selected.length) {
      this.showToast('נא לבחור לפחות שיר אחד להורדה מהרשימה.', 'warning');
      return;
    }

    this.playlistDownloadZipBtn.disabled = true;
    if (this.playlistProgressBar) this.playlistProgressBar.classList.remove('hidden');

    try {
      await PlaylistManager.bundleSelectedToZip(
        this.currentPlaylist.title,
        selected,
        'mp3',
        (curr, total, title, percent) => {
          if (this.playlistProgressFill) this.playlistProgressFill.style.width = `${percent}%`;
          if (this.playlistProgressText) {
            this.playlistProgressText.textContent = `מעבד שיר ${curr} מתוך ${total}: ${title} (${percent}%)`;
          }
        }
      );

      this.showToast('קובץ ה-ZIP הוכן והורד בהצלחה למחשב שלך!', 'success');
    } catch (err) {
      console.error('Zip bundle failed:', err);
      this.showToast(`שגיאה ביצירת קובץ ה-ZIP: ${err.message}`, 'error');
    } finally {
      this.playlistDownloadZipBtn.disabled = false;
      setTimeout(() => {
        if (this.playlistProgressBar) this.playlistProgressBar.classList.add('hidden');
      }, 5000);
    }
  }

  /**
   * Renders the single media preview card
   */
  _renderMediaCard(media) {
    if (!this.mediaCard) return;

    this.mediaThumbnail.src = media.thumbnail;
    this.mediaTitle.textContent = media.title;
    this.mediaAuthor.textContent = media.author;
    this.mediaDuration.textContent = media.duration || '';

    this.mediaBadge.textContent = MediaEngine.getPlatformHebrew(media.platform);
    this.mediaBadge.className = `platform-pill ${media.platform}-pill`;

    this.mediaCard.classList.remove('hidden');
    this.mediaCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /**
   * Renders playlist items list
   */
  _renderPlaylistView(playlist) {
    if (!this.playlistCard || !this.playlistTracksList) return;

    const titleEl = document.getElementById('playlist-header-title');
    const authorEl = document.getElementById('playlist-header-author');
    const countEl = document.getElementById('playlist-header-count');

    if (titleEl) titleEl.textContent = playlist.title;
    if (authorEl) authorEl.textContent = playlist.author;
    if (countEl) countEl.textContent = `${playlist.items.length} רצועות`;

    this.playlistTracksList.innerHTML = '';

    playlist.items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'playlist-track-item';
      li.innerHTML = `
        <label class="track-checkbox-label">
          <input type="checkbox" class="track-checkbox" data-index="${item.index}" ${item.selected ? 'checked' : ''}>
          <span class="custom-checkbox"></span>
        </label>
        <span class="track-index">${item.index}</span>
        <img src="${item.thumbnail}" alt="" class="track-thumb" loading="lazy">
        <div class="track-info">
          <h4 class="track-title">${Security.escapeHtml(item.title)}</h4>
          <span class="track-author">${Security.escapeHtml(item.author)}</span>
        </div>
        <span class="track-duration">${item.duration}</span>
      `;

      const checkbox = li.querySelector('.track-checkbox');
      checkbox.addEventListener('change', (e) => {
        item.selected = e.target.checked;
        this._updatePlaylistSelectedCount();
      });

      this.playlistTracksList.appendChild(li);
    });

    this._updatePlaylistSelectedCount();
    this.playlistCard.classList.remove('hidden');
  }

  _setPlaylistSelection(isSelected) {
    if (!this.currentPlaylist || !this.currentPlaylist.items) return;
    this.currentPlaylist.items.forEach(i => i.selected = isSelected);
    const checkboxes = this.playlistTracksList.querySelectorAll('.track-checkbox');
    checkboxes.forEach(cb => cb.checked = isSelected);
    this._updatePlaylistSelectedCount();
  }

  _updatePlaylistSelectedCount() {
    if (!this.currentPlaylist) return;
    const count = this.currentPlaylist.items.filter(i => i.selected).length;
    if (this.playlistDownloadZipBtn) {
      this.playlistDownloadZipBtn.textContent = `הורד ${count} שירים נבחרים (קובץ ZIP)`;
      this.playlistDownloadZipBtn.disabled = count === 0;
    }
  }

  /**
   * Renders the local history list
   */
  _renderHistory() {
    if (!this.historyList) return;
    const items = HistoryManager.getAll();

    if (!items.length) {
      this.historyList.innerHTML = '';
      if (this.historyEmpty) this.historyEmpty.classList.remove('hidden');
      if (this.clearHistoryBtn) this.clearHistoryBtn.classList.add('hidden');
      return;
    }

    if (this.historyEmpty) this.historyEmpty.classList.add('hidden');
    if (this.clearHistoryBtn) this.clearHistoryBtn.classList.remove('hidden');

    this.historyList.innerHTML = '';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-item-card';
      const isAudio = item.format === 'mp3';

      card.innerHTML = `
        <img src="${item.thumbnail}" alt="" class="history-thumb" loading="lazy">
        <div class="history-content">
          <div class="history-header">
            <span class="history-format-tag ${isAudio ? 'audio-tag' : 'video-tag'}">${item.format.toUpperCase()}</span>
            <span class="history-time">${HistoryManager.formatRelativeTime(item.timestamp)}</span>
          </div>
          <h4 class="history-title" title="${Security.escapeHtml(item.title)}">${Security.escapeHtml(item.title)}</h4>
          <span class="history-author">${Security.escapeHtml(item.author)}</span>
        </div>
        <div class="history-actions">
          <button class="btn-history-play" title="הפעל בממשק">
            ${isAudio ? '▶ נגן' : '🎬 צפה'}
          </button>
          <button class="btn-history-download" title="הורד שוב">
            ⬇ הורד
          </button>
          <button class="btn-history-delete" title="מחק פריט">
            ✕
          </button>
        </div>
      `;

      card.querySelector('.btn-history-play').addEventListener('click', () => {
        if (isAudio) {
          MediaPlayer.playAudio(item);
        } else {
          MediaPlayer.playVideo(item);
        }
      });

      card.querySelector('.btn-history-download').addEventListener('click', () => {
        MediaEngine.triggerBrowserDownload(item.downloadUrl, item.fileName);
      });

      card.querySelector('.btn-history-delete').addEventListener('click', () => {
        HistoryManager.remove(item.id);
      });

      this.historyList.appendChild(card);
    });
  }

  /**
   * Checks Web Share Target params (?url=, ?text=, ?title=)
   */
  async _checkShareTargetParams() {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('url') || params.get('text') || params.get('title');

    if (!sharedUrl) return;

    // Extract first URL using regex
    const urlMatch = sharedUrl.match(/https?:\/\/[^\s]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : sharedUrl;

    const clean = Security.sanitizeUrl(targetUrl);
    const platform = Security.detectPlatform(clean);

    if (platform) {
      this.urlInput.value = clean;
      this.handleInputChange();

      // Show quick share modal immediately
      this._openQuickShareModal(clean, platform);
    }
  }

  async _openQuickShareModal(url, platform) {
    if (!this.quickShareModal) return;

    this.quickShareModal.classList.remove('hidden');
    this.quickShareModal.setAttribute('aria-hidden', 'false');

    if (this.quickShareTitle) this.quickShareTitle.textContent = `משתף מ-${MediaEngine.getPlatformHebrew(platform)}...`;

    try {
      const meta = await MediaEngine.fetchMetadata(url);
      this.currentMedia = meta;
      if (this.quickShareTitle) this.quickShareTitle.textContent = meta.title;
      if (this.quickShareThumb) this.quickShareThumb.src = meta.thumbnail;
    } catch {
      // Keep basic metadata
      this.currentMedia = { url, platform, title: 'מדיה משותפת', author: MediaEngine.getPlatformHebrew(platform) };
    }
  }

  _closeQuickShareModal() {
    if (!this.quickShareModal) return;
    this.quickShareModal.classList.add('hidden');
    this.quickShareModal.setAttribute('aria-hidden', 'true');
    // Clear URL query parameters from browser bar cleanly
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  _highlightPlatformBadge(platform) {
    document.querySelectorAll('.platform-badge').forEach(badge => {
      const match = badge.getAttribute('data-platform') === platform;
      badge.classList.toggle('active-badge', match);
    });
  }

  _updateStatus(state, message) {
    if (this.statusAura) {
      this.statusAura.className = `status-orb orb-${state}`;
    }
    if (this.statusText) {
      this.statusText.textContent = message;
    }
  }

  _setLoading(isLoading, message = 'טוען...') {
    if (this.analyzeBtn) {
      this.analyzeBtn.disabled = isLoading;
      this.analyzeBtn.innerHTML = isLoading
        ? `<span class="spinner"></span> <span>מעבד...</span>`
        : `<span>נתח קישור</span> <span class="arrow-icon">←</span>`;
    }
    if (isLoading) {
      this._updateStatus('loading', message);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => container.removeChild(toast), 300);
    }, 3800);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MediaDropApp();
  window.app.init();
});
