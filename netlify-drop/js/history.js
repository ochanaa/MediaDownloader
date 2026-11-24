/**
 * Local Download History & Storage Manager
 * Stores downloaded items securely in browser localStorage with zero external server tracking.
 */

export const HistoryManager = {
  STORAGE_KEY: 'mediadrop_history_v1',
  MAX_ITEMS: 50,

  /**
   * Retrieves all history items sorted newest first
   */
  getAll() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return [];
      const items = JSON.parse(raw);
      return Array.isArray(items) ? items : [];
    } catch (err) {
      console.warn('Failed to parse history from localStorage:', err);
      return [];
    }
  },

  /**
   * Adds or updates an item in the history
   */
  add(item) {
    if (!item || !item.title) return null;

    const list = this.getAll();
    const entry = {
      id: item.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: item.title,
      author: item.author || '—',
      format: (item.format || 'mp3').toLowerCase(),
      platform: item.platform || 'youtube',
      thumbnail: item.thumbnail || '',
      downloadUrl: item.downloadUrl || '',
      fileName: item.fileName || `${item.title}.${item.format || 'mp3'}`,
      timestamp: Date.now()
    };

    // Remove duplicates with identical downloadUrl or title
    const filtered = list.filter(i => i.title !== entry.title || i.format !== entry.format);
    filtered.unshift(entry);

    // Limit maximum stored items
    if (filtered.length > this.MAX_ITEMS) {
      filtered.length = this.MAX_ITEMS;
    }

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent('mediadrop:history-updated'));
    } catch (err) {
      console.warn('LocalStorage full or restricted:', err);
    }

    return entry;
  },

  /**
   * Removes a single item by ID
   */
  remove(id) {
    const list = this.getAll().filter(i => i.id !== id);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new CustomEvent('mediadrop:history-updated'));
    } catch (err) {
      console.warn('Failed to remove item from history:', err);
    }
  },

  /**
   * Clears the entire history
   */
  clear() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('mediadrop:history-updated'));
    } catch (err) {
      console.warn('Failed to clear history:', err);
    }
  },

  /**
   * Formats a unix timestamp into relative Hebrew time
   */
  formatRelativeTime(ts) {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000); // in seconds
    if (diff < 60) return 'ממש עכשיו';
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`;
    if (diff < 86400) return `לפני ${Math.floor(diff / 3600)} שעות`;
    return `לפני ${Math.floor(diff / 86400)} ימים`;
  }
};
