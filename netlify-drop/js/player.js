/**
 * Integrated Audio Waveform & Video Player Module
 * Seamless in-browser playback for downloaded MP3 and MP4 media.
 */

export const MediaPlayer = {
  audioEl: null,
  videoEl: null,
  videoModal: null,
  currentTrack: null,
  isPlaying: false,
  playbackRates: [1.0, 1.25, 1.5, 2.0],
  currentRateIndex: 0,
  visualizerInterval: null,

  /**
   * Initializes player elements and event listeners
   */
  init() {
    this.audioEl = document.getElementById('global-audio-element');
    this.videoEl = document.getElementById('modal-video-element');
    this.videoModal = document.getElementById('video-modal');

    if (this.audioEl) {
      this._bindAudioEvents();
    }
  },

  /**
   * Loads and plays an audio track
   */
  playAudio(track) {
    if (!this.audioEl) this.init();
    if (!this.audioEl || !track || !track.downloadUrl) return;

    this.currentTrack = track;
    this.audioEl.src = track.downloadUrl;
    this.audioEl.playbackRate = this.playbackRates[this.currentRateIndex];

    const playerContainer = document.getElementById('audio-player-bar');
    if (playerContainer) {
      playerContainer.classList.remove('hidden');
    }

    // Update track metadata UI
    const titleEl = document.getElementById('player-track-title');
    const authorEl = document.getElementById('player-track-author');
    const thumbEl = document.getElementById('player-track-thumb');

    if (titleEl) titleEl.textContent = track.title || 'אודיו';
    if (authorEl) authorEl.textContent = track.author || '—';
    if (thumbEl && track.thumbnail) thumbEl.src = track.thumbnail;

    this.audioEl.play().catch(err => {
      console.warn('Autoplay prevented by browser:', err);
    });

    this._startVisualizerAnimation();
  },

  /**
   * Opens and plays an MP4 video in the video modal
   */
  playVideo(videoItem) {
    if (!this.videoModal || !this.videoEl) this.init();
    if (!this.videoModal || !this.videoEl) return;

    // Pause audio if playing
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
    }

    this.videoEl.src = videoItem.downloadUrl;
    const titleEl = document.getElementById('video-modal-title');
    if (titleEl) titleEl.textContent = videoItem.title || 'וידאו';

    this.videoModal.classList.remove('hidden');
    this.videoModal.setAttribute('aria-hidden', 'false');

    this.videoEl.play().catch(err => {
      console.warn('Video autoplay prevented:', err);
    });
  },

  /**
   * Closes the video modal
   */
  closeVideo() {
    if (!this.videoModal || !this.videoEl) return;
    this.videoEl.pause();
    this.videoEl.src = '';
    this.videoModal.classList.add('hidden');
    this.videoModal.setAttribute('aria-hidden', 'true');
  },

  /**
   * Toggles play/pause for the audio player
   */
  togglePlayPause() {
    if (!this.audioEl) return;
    if (this.audioEl.paused) {
      this.audioEl.play();
    } else {
      this.audioEl.pause();
    }
  },

  /**
   * Cycles through playback speed rates
   */
  cycleSpeed() {
    if (!this.audioEl) return;
    this.currentRateIndex = (this.currentRateIndex + 1) % this.playbackRates.length;
    const newRate = this.playbackRates[this.currentRateIndex];
    this.audioEl.playbackRate = newRate;

    const speedBtn = document.getElementById('player-speed-btn');
    if (speedBtn) {
      speedBtn.textContent = `${newRate}x`;
    }
  },

  /**
   * Seeks audio to target percentage (0 - 100)
   */
  seekAudio(percent) {
    if (!this.audioEl || isNaN(this.audioEl.duration)) return;
    const targetTime = (percent / 100) * this.audioEl.duration;
    this.audioEl.currentTime = targetTime;
  },

  /**
   * Binds audio events for timeline and play state synchronization
   */
  _bindAudioEvents() {
    const playBtn = document.getElementById('player-play-btn');
    const playIcon = document.getElementById('player-play-icon');
    const pauseIcon = document.getElementById('player-pause-icon');
    const progressFill = document.getElementById('player-progress-fill');
    const progressSlider = document.getElementById('player-progress-slider');
    const timeCurrent = document.getElementById('player-time-current');
    const timeTotal = document.getElementById('player-time-total');

    this.audioEl.addEventListener('play', () => {
      this.isPlaying = true;
      if (playIcon) playIcon.classList.add('hidden');
      if (pauseIcon) pauseIcon.classList.remove('hidden');
      this._startVisualizerAnimation();
    });

    this.audioEl.addEventListener('pause', () => {
      this.isPlaying = false;
      if (playIcon) playIcon.classList.remove('hidden');
      if (pauseIcon) pauseIcon.classList.add('hidden');
      this._stopVisualizerAnimation();
    });

    this.audioEl.addEventListener('ended', () => {
      this.isPlaying = false;
      if (playIcon) playIcon.classList.remove('hidden');
      if (pauseIcon) pauseIcon.classList.add('hidden');
      this._stopVisualizerAnimation();
    });

    this.audioEl.addEventListener('timeupdate', () => {
      if (isNaN(this.audioEl.duration)) return;
      const current = this.audioEl.currentTime;
      const duration = this.audioEl.duration;
      const percent = (current / duration) * 100;

      if (progressFill) progressFill.style.width = `${percent}%`;
      if (progressSlider) progressSlider.value = percent;
      if (timeCurrent) timeCurrent.textContent = this._formatTime(current);
      if (timeTotal) timeTotal.textContent = this._formatTime(duration);
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      if (timeTotal && !isNaN(this.audioEl.duration)) {
        timeTotal.textContent = this._formatTime(this.audioEl.duration);
      }
    });

    if (progressSlider) {
      progressSlider.addEventListener('input', (e) => {
        this.seekAudio(parseFloat(e.target.value));
      });
    }

    if (playBtn) {
      playBtn.addEventListener('click', () => this.togglePlayPause());
    }

    const speedBtn = document.getElementById('player-speed-btn');
    if (speedBtn) {
      speedBtn.addEventListener('click', () => this.cycleSpeed());
    }

    const closeBtn = document.getElementById('player-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (this.audioEl) this.audioEl.pause();
        const bar = document.getElementById('audio-player-bar');
        if (bar) bar.classList.add('hidden');
      });
    }

    // Video modal close events
    const videoCloseBtn = document.getElementById('video-modal-close');
    if (videoCloseBtn) {
      videoCloseBtn.addEventListener('click', () => this.closeVideo());
    }
    const videoBackdrop = document.getElementById('video-modal-backdrop');
    if (videoBackdrop) {
      videoBackdrop.addEventListener('click', () => this.closeVideo());
    }
  },

  /**
   * Animated audio waveform visualizer bars
   */
  _startVisualizerAnimation() {
    this._stopVisualizerAnimation();
    const bars = document.querySelectorAll('.waveform-bar');
    if (!bars.length) return;

    this.visualizerInterval = setInterval(() => {
      if (!this.isPlaying) return;
      bars.forEach(bar => {
        const height = Math.floor(Math.random() * 26) + 6;
        bar.style.height = `${height}px`;
      });
    }, 120);
  },

  _stopVisualizerAnimation() {
    if (this.visualizerInterval) {
      clearInterval(this.visualizerInterval);
      this.visualizerInterval = null;
    }
    const bars = document.querySelectorAll('.waveform-bar');
    bars.forEach(bar => {
      bar.style.height = '6px';
    });
  },

  /**
   * Helper to format seconds into mm:ss
   */
  _formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const s = Math.floor(seconds);
    const mins = Math.floor(s / 60);
    const remainder = s % 60;
    return `${mins}:${remainder < 10 ? '0' : ''}${remainder}`;
  }
};
