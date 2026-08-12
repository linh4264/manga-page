window.ReaderComponent = class ReaderComponent {
  constructor(appState) {
    this.state = appState;
    this.currentManga = null;
    this.currentChapter = null;
    this.currentPageIndex = 0;
    this.readingMode = 'webtoon'; // 'webtoon' | 'single' | 'double'
    this.zoomLevel = 'default'; // 'default' | 'wide' | 'full'
    this.autoScrollActive = false;
    this.autoScrollSpeed = 2; // px per tick
    this.autoScrollTimer = null;
    this.controlsVisible = true;
    
    this.initDOMReferences();
  }

  initDOMReferences() {
    this.readerWrapper = document.getElementById('reader-wrapper');
    this.readerCanvas = document.getElementById('reader-canvas');
    this.readerHeader = document.getElementById('reader-header');
    this.readerControls = document.getElementById('reader-controls');
    this.readerMangaTitle = document.getElementById('reader-manga-title');
    this.readerChapterSelect = document.getElementById('reader-chapter-select');
    this.pageCounter = document.getElementById('page-counter');
    this.progressBar = document.getElementById('reader-progress-bar');
    
    // Bind Controls
    document.getElementById('btn-close-reader')?.addEventListener('click', () => this.close());
    document.getElementById('btn-prev-chapter')?.addEventListener('click', () => this.prevChapter());
    document.getElementById('btn-next-chapter')?.addEventListener('click', () => this.nextChapter());
    document.getElementById('btn-toggle-autoscroll')?.addEventListener('click', () => this.toggleAutoScroll());
    document.getElementById('btn-toggle-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('select-reading-mode')?.addEventListener('change', (e) => this.setReadingMode(e.target.value));
    document.getElementById('select-zoom-level')?.addEventListener('change', (e) => this.setZoomLevel(e.target.value));
    
    this.readerChapterSelect?.addEventListener('change', (e) => {
      this.loadChapter(e.target.value);
    });

    // Handle Keyboard Hotkeys
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Handle Scroll for Webtoon Progress & Autohide Controls
    this.readerWrapper?.addEventListener('scroll', () => this.handleScroll());
    
    // Toggle controls on canvas click
    this.readerCanvas?.addEventListener('click', (e) => {
      // Ignore click on images if user is selecting text
      if (e.target.tagName === 'IMG') return;
      this.toggleControls();
    });
  }

  open(manga, chapterId) {
    this.currentManga = manga;
    this.readerMangaTitle.textContent = manga.title;
    
    // Populate chapter select dropdown
    this.readerChapterSelect.innerHTML = '';
    manga.chapters.forEach(ch => {
      const opt = document.createElement('option');
      opt.value = ch.id;
      opt.textContent = ch.title;
      this.readerChapterSelect.appendChild(opt);
    });

    this.loadChapter(chapterId);
    this.readerWrapper.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Lock background scroll
  }

  close() {
    this.stopAutoScroll();
    this.readerWrapper.classList.add('hidden');
    document.body.style.overflow = '';
  }

  loadChapter(chapterId) {
    this.stopAutoScroll();
    const chapter = this.currentManga.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    this.currentChapter = chapter;
    this.readerChapterSelect.value = chapterId;
    this.currentPageIndex = 0;

    // Render Canvas Pages
    this.renderPages();

    // Update Progress History in localStorage
    this.saveProgress();
    
    // Reset scroll position to top
    this.readerWrapper.scrollTop = 0;
    this.updateProgressUI();
  }

  renderPages() {
    this.readerCanvas.innerHTML = '';
    this.readerCanvas.className = `reader-canvas ${this.zoomLevel}`;

    const pages = this.currentChapter.pages || [];
    
    if (pages.length === 0) {
      this.readerCanvas.innerHTML = `
        <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>Chương này chưa có ảnh hoặc link Google Drive không khả dụng.</p>
        </div>
      `;
      return;
    }

    pages.forEach((pageItem, index) => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'reader-page-item';
      pageDiv.dataset.pageIndex = index;

      const img = document.createElement('img');
      img.alt = `Trang ${index + 1}`;
      img.loading = index < 3 ? 'eager' : 'lazy';

      // Check if pageItem is a Google Drive link / ID or full URL
      const fileId = DriveHelper.extractFileId(pageItem);
      if (fileId) {
        DriveHelper.attachImageFallback(img, fileId);
      } else {
        img.src = pageItem;
        img.onerror = () => {
          img.classList.add('img-load-error');
          img.alt = 'Không thể tải ảnh.';
        };
      }

      pageDiv.appendChild(img);
      this.readerCanvas.appendChild(pageDiv);
    });

    this.updateProgressUI();
  }

  handleScroll() {
    if (this.readerWrapper.classList.contains('hidden')) return;

    const scrollTop = this.readerWrapper.scrollTop;
    const scrollHeight = this.readerWrapper.scrollHeight - this.readerWrapper.clientHeight;
    
    if (scrollHeight <= 0) return;

    const progressPercent = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
    if (this.progressBar) {
      this.progressBar.style.width = `${progressPercent}%`;
    }

    // Determine currently visible page index in Webtoon view
    const pageElements = this.readerCanvas.querySelectorAll('.reader-page-item');
    let currentIdx = 0;
    const wrapperCenter = scrollTop + this.readerWrapper.clientHeight / 2;

    pageElements.forEach((el, idx) => {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (wrapperCenter >= top && wrapperCenter <= bottom) {
        currentIdx = idx;
      }
    });

    this.currentPageIndex = currentIdx;
    this.updatePageCounter();
  }

  updateProgressUI() {
    this.updatePageCounter();
  }

  updatePageCounter() {
    const total = this.currentChapter?.pages?.length || 0;
    if (this.pageCounter) {
      this.pageCounter.textContent = `${this.currentPageIndex + 1} / ${total}`;
    }
  }

  saveProgress() {
    if (!this.currentManga || !this.currentChapter) return;
    const history = JSON.parse(localStorage.getItem('manga_history') || '{}');
    history[this.currentManga.id] = {
      chapterId: this.currentChapter.id,
      chapterTitle: this.currentChapter.title,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('manga_history', JSON.stringify(history));
  }

  prevChapter() {
    const chapters = this.currentManga.chapters;
    const idx = chapters.findIndex(c => c.id === this.currentChapter.id);
    if (idx > 0) {
      this.loadChapter(chapters[idx - 1].id);
    }
  }

  nextChapter() {
    const chapters = this.currentManga.chapters;
    const idx = chapters.findIndex(c => c.id === this.currentChapter.id);
    if (idx !== -1 && idx < chapters.length - 1) {
      this.loadChapter(chapters[idx + 1].id);
    }
  }

  toggleAutoScroll() {
    if (this.autoScrollActive) {
      this.stopAutoScroll();
    } else {
      this.startAutoScroll();
    }
  }

  startAutoScroll() {
    this.autoScrollActive = true;
    const btn = document.getElementById('btn-toggle-autoscroll');
    if (btn) {
      btn.style.color = '#818cf8';
      btn.innerHTML = '<i class="fas fa-pause"></i>';
    }
    
    this.autoScrollTimer = setInterval(() => {
      this.readerWrapper.scrollTop += this.autoScrollSpeed;
      if (this.readerWrapper.scrollTop + this.readerWrapper.clientHeight >= this.readerWrapper.scrollHeight - 5) {
        this.stopAutoScroll();
      }
    }, 30);
  }

  stopAutoScroll() {
    this.autoScrollActive = false;
    if (this.autoScrollTimer) {
      clearInterval(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
    const btn = document.getElementById('btn-toggle-autoscroll');
    if (btn) {
      btn.style.color = '';
      btn.innerHTML = '<i class="fas fa-play"></i>';
    }
  }

  setZoomLevel(level) {
    this.zoomLevel = level;
    if (this.readerCanvas) {
      this.readerCanvas.className = `reader-canvas ${level}`;
    }
  }

  setReadingMode(mode) {
    this.readingMode = mode;
    this.renderPages();
  }

  toggleControls() {
    this.controlsVisible = !this.controlsVisible;
    this.readerHeader?.classList.toggle('autohide', !this.controlsVisible);
    this.readerControls?.classList.toggle('autohide', !this.controlsVisible);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.readerWrapper.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  }

  handleKeyDown(e) {
    if (this.readerWrapper.classList.contains('hidden')) return;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        this.readerWrapper.scrollTop += 120;
        break;
      case 'ArrowUp':
      case 'k':
        this.readerWrapper.scrollTop -= 120;
        break;
      case ' ':
        e.preventDefault();
        this.readerWrapper.scrollTop += window.innerHeight * 0.8;
        break;
      case 'f':
      case 'F':
        this.toggleFullscreen();
        break;
      case 'h':
      case 'H':
        this.toggleControls();
        break;
    }
  }
}
