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
    this.readerMainArea = document.getElementById('reader-main-area');
    this.readerCanvas = document.getElementById('reader-canvas');
    this.readerTopFloating = document.getElementById('reader-top-floating');
    this.readerMangaTitleTop = document.getElementById('reader-manga-title-top');
    this.sidebarMangaTitle = document.getElementById('sidebar-manga-title');
    this.sidebarChapterSubtitle = document.getElementById('sidebar-chapter-subtitle');
    this.readerChapterSelect = document.getElementById('reader-chapter-select');
    this.readerPageSelect = document.getElementById('reader-page-select');
    this.progressBar = document.getElementById('reader-progress-bar');
    
    // Bind Mobile Backdrop & Main Area outside click to close Sidebar
    const handleOutsideClick = () => {
      if (window.innerWidth <= 768 && this.readerWrapper && !this.readerWrapper.classList.contains('sidebar-collapsed')) {
        this.toggleSidebar(true);
      }
    };

    const backdropEl = document.getElementById('reader-sidebar-backdrop');
    if (backdropEl) {
      backdropEl.addEventListener('click', handleOutsideClick);
      backdropEl.addEventListener('touchstart', handleOutsideClick);
    }

    if (this.readerMainArea) {
      this.readerMainArea.addEventListener('click', handleOutsideClick);
    }

    // Bind Expand Sidebar Button (Support click & touch)
    const expandBtn = document.getElementById('btn-expand-sidebar');
    if (expandBtn) {
      const handleOpenSidebar = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        this.toggleSidebar(false); // false = open sidebar
      };
      expandBtn.onclick = handleOpenSidebar;
      expandBtn.ontouchstart = handleOpenSidebar;
    }

    // Bind General Action Controls
    document.getElementById('btn-close-reader')?.addEventListener('click', () => this.close());
    document.getElementById('btn-sidebar-home')?.addEventListener('click', () => this.close());
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('btn-collapse-sidebar')?.addEventListener('click', () => this.toggleSidebar());
    document.getElementById('btn-sidebar-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('btn-sidebar-bookmark')?.addEventListener('click', () => this.toggleBookmark());

    // Bind Chapter Navigation (|<, <, select, >, >|)
    document.getElementById('btn-first-chapter')?.addEventListener('click', () => this.goToChapterIndex(0));
    document.getElementById('btn-prev-chapter-side')?.addEventListener('click', () => this.prevChapter());
    document.getElementById('btn-next-chapter-side')?.addEventListener('click', () => this.nextChapter());
    document.getElementById('btn-last-chapter')?.addEventListener('click', () => this.goToChapterIndex((this.currentManga?.chapters?.length || 1) - 1));
    
    // Bind Page Navigation (<<, <, select 14/19, >, >>)
    document.getElementById('btn-first-page')?.addEventListener('click', () => this.scrollToPage(0));
    document.getElementById('btn-prev-page')?.addEventListener('click', () => this.scrollToPage(Math.max(0, this.currentPageIndex - 1)));
    document.getElementById('btn-next-page')?.addEventListener('click', () => this.scrollToPage(Math.min((this.currentChapter?.pages?.length || 1) - 1, this.currentPageIndex + 1)));
    document.getElementById('btn-last-page')?.addEventListener('click', () => this.scrollToPage((this.currentChapter?.pages?.length || 1) - 1));

    document.getElementById('btn-toggle-autoscroll')?.addEventListener('click', () => this.toggleAutoScroll());
    document.getElementById('select-reading-mode')?.addEventListener('change', (e) => this.setReadingMode(e.target.value));
    document.getElementById('select-zoom-level')?.addEventListener('change', (e) => this.setZoomLevel(e.target.value));
    
    this.readerChapterSelect?.addEventListener('change', (e) => {
      this.loadChapter(e.target.value);
    });

    this.readerPageSelect?.addEventListener('change', (e) => {
      this.scrollToPage(parseInt(e.target.value, 10));
    });

    // Bind Comments submission & Facebook Share
    document.getElementById('btn-submit-comment')?.addEventListener('click', () => this.submitComment());
    document.getElementById('btn-share-facebook-chapter')?.addEventListener('click', () => this.shareOnFacebook());
    document.getElementById('btn-share-fb-action')?.addEventListener('click', () => this.shareOnFacebook());

    // Handle Keyboard Hotkeys
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // Handle Scroll for Webtoon Progress & Page tracking
    this.readerMainArea?.addEventListener('scroll', () => this.handleScroll());
  }

  toggleSidebar(forceCollapse = null) {
    if (!this.readerWrapper) return;
    const backdrop = document.getElementById('reader-sidebar-backdrop');
    const expandBtn = document.getElementById('btn-expand-sidebar');
    const isCollapsed = this.readerWrapper.classList.contains('sidebar-collapsed');
    const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCollapsed;

    if (shouldCollapse) {
      this.readerWrapper.classList.add('sidebar-collapsed');
      if (backdrop) backdrop.classList.add('hidden');
      if (expandBtn) expandBtn.classList.remove('hidden'); // Hiện nút mở lại Sidebar khi thu gọn
    } else {
      this.readerWrapper.classList.remove('sidebar-collapsed');
      if (backdrop) backdrop.classList.remove('hidden');
      if (expandBtn) expandBtn.classList.add('hidden'); // Ẩn nút mở khi Sidebar đang mở
    }
  }

  open(manga, chapterId, pushState = true) {
    if (pushState && this.state?.router) {
      this.state.router.goChapter(manga.id, chapterId);
      return;
    }

    this.currentManga = manga;
    if (this.readerMangaTitleTop) this.readerMangaTitleTop.textContent = manga.title;
    if (this.sidebarMangaTitle) this.sidebarMangaTitle.textContent = manga.title;
    
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
    document.body.style.overflow = 'hidden'; // Chỉ ẩn thanh cuộn body ngoài khi ĐANG ĐỌC CHƯƠNG

    // Tự động thu gọn Sidebar trên điện thoại khi mở đọc chương
    if (window.innerWidth <= 768) {
      this.toggleSidebar(true);
    }
  }

  close() {
    this.stopAutoScroll();
    if (this.readerWrapper) {
      this.readerWrapper.classList.add('hidden');
      this.readerWrapper.classList.remove('is-pdf-active');
    }
    document.body.style.overflow = ''; // Mở lại thanh cuộn chính trang web khi thoát chế độ đọc
    const backdrop = document.getElementById('reader-sidebar-backdrop');
    if (backdrop) backdrop.classList.add('hidden');

    if (this.state?.router && this.currentManga) {
      this.state.router.goManga(this.currentManga.id);
    }
  }

  loadChapter(chapterId) {
    this.stopAutoScroll();
    const chapter = this.currentManga.chapters.find(c => c.id === chapterId);
    if (!chapter) return;

    this.currentChapter = chapter;
    this.readerChapterSelect.value = chapterId;
    this.currentPageIndex = 0;

    if (this.state?.router && this.currentManga) {
      this.state.router.pushRoute(`/${this.currentManga.id}/${chapterId}`);
    }

    // Render Canvas Pages
    this.renderPages();

    // Reset scroll position to top
    this.readerWrapper.scrollTop = 0;
    this.updateProgressUI();
    this.updateDisqusComments();

    // Tự động đóng Sidebar trên mobile khi đổi sang chương mới
    if (window.innerWidth <= 768) {
      setTimeout(() => this.toggleSidebar(true), 300);
    }
  }

  /**
   * Tải và reset hệ thống Bình luận Disqus theo từng chương.
   * Nếu mạng/AdBlocker của người dùng chặn domain Disqus (ERR_BLOCKED_BY_ADMINISTRATOR),
   * hệ thống sẽ tự động bắt lỗi và hiển thị giao diện thông báo dự phòng mượt mà.
   */
  updateDisqusComments() {
    const disqusThread = document.getElementById('disqus_thread');
    const disqusWrapper = document.getElementById('disqus-wrapper');
    if (!disqusThread || !this.currentManga || !this.currentChapter) return;

    const pageIdentifier = `${this.currentManga.id}_${this.currentChapter.id}`;
    const pageUrl = `https://drive-manga.pages.dev/#/${this.currentManga.id}/${this.currentChapter.id}`;
    const pageTitle = `${this.currentManga.title} - ${this.currentChapter.title}`;
    const shortname = window.DISQUS_SHORTNAME || 'drivemanga';

    const showFallbackUI = () => {
      if (disqusWrapper) {
        disqusWrapper.innerHTML = `
          <div style="text-align: center; padding: 1rem; color: var(--text-secondary);">
            <i class="fas fa-shield-alt" style="font-size: 2rem; margin-bottom: 0.5rem; color: #a855f7;"></i>
            <h4 style="font-size: 0.9rem; margin-bottom: 0.3rem; color: #ffffff;">Disqus Đang Bị Trình Duyệt / Mạng Chặn</h4>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.5rem;">Vui lòng tắt AdBlocker hoặc bạn có thể dùng khung Ghi chú & Bình luận bên dưới!</p>
          </div>
        `;
      }
    };

    if (window.DISQUS) {
      try {
        window.DISQUS.reset({
          reload: true,
          config: function () {
            this.page.identifier = pageIdentifier;
            this.page.url = pageUrl;
            this.page.title = pageTitle;
            this.language = 'vi';
          }
        });
      } catch (err) {
        showFallbackUI();
      }
    } else {
      window.disqus_config = function () {
        this.page.identifier = pageIdentifier;
        this.page.url = pageUrl;
        this.page.title = pageTitle;
        this.language = 'vi';
      };

      const d = document, s = d.createElement('script');
      s.src = `https://${shortname}.disqus.com/embed.js`;
      s.setAttribute('data-timestamp', +new Date());
      s.onerror = showFallbackUI;
      (d.head || d.body).appendChild(s);
    }
  }

  renderPages() {
    this.readerCanvas.innerHTML = '';
    this.readerCanvas.className = `reader-canvas ${this.zoomLevel}`;

    const pages = this.currentChapter.pages || [];
    const pdfSource = this.currentChapter.pdfUrl || (pages[0] && window.PdfHelper.isPdfSource(pages[0]) ? pages[0] : null);

    // If Chapter source is a PDF file
    if (pdfSource || this.currentChapter.isPdf) {
      if (this.readerWrapper) this.readerWrapper.classList.add('is-pdf-active');
      this.readerCanvas.className = `reader-canvas ${this.zoomLevel} is-pdf-mode`;
      const source = pdfSource || pages[0];
      window.PdfHelper.renderPdfToContainer(source, this.readerCanvas, (totalPdfPages) => {
        if (!this.currentChapter.pages || this.currentChapter.pages.length !== totalPdfPages) {
          this.currentChapter.pages = Array.from({ length: totalPdfPages }, (_, i) => `PDF Page ${i + 1}`);
        }
        this.updateProgressUI();
      });
      return;
    } else {
      if (this.readerWrapper) this.readerWrapper.classList.remove('is-pdf-active');
    }
    
    if (pages.length === 0) {
      this.readerCanvas.innerHTML = `
        <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>Chương này chưa có ảnh/PDF hoặc link Google Drive không khả dụng.</p>
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
      img.loading = index < 4 ? 'eager' : 'lazy';
      img.decoding = 'async';

      // Check if pageItem is a Google Drive link / ID or full URL
      const fileId = window.DriveHelper.extractFileId(pageItem);
      if (fileId) {
        window.DriveHelper.attachImageFallback(img, fileId);
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

    this.preloadNextChapter();
    this.updateProgressUI();
  }

  preloadNextChapter() {
    if (!this.currentManga || !this.currentChapter) return;
    const chapters = this.currentManga.chapters || [];
    const currentIdx = chapters.findIndex(c => c.id === this.currentChapter.id);
    if (currentIdx !== -1 && currentIdx < chapters.length - 1) {
      const nextChap = chapters[currentIdx + 1];
      const nextPages = nextChap.pages || [];
      nextPages.slice(0, 3).forEach(pageItem => {
        const fileId = window.DriveHelper.extractFileId(pageItem);
        const url = fileId ? window.DriveHelper.getImageUrls(fileId).primary : pageItem;
        if (url) {
          const img = new Image();
          img.src = url;
        }
      });
    }
  }

  toggleSidebar() {
    this.readerWrapper.classList.toggle('sidebar-collapsed');
    const isCollapsed = this.readerWrapper.classList.contains('sidebar-collapsed');
    const expandBtn = document.getElementById('btn-expand-sidebar');
    if (expandBtn) {
      if (isCollapsed) {
        expandBtn.classList.remove('hidden');
      } else {
        expandBtn.classList.add('hidden');
      }
    }
  }

  goToChapterIndex(index) {
    const chapters = this.currentManga?.chapters || [];
    if (index >= 0 && index < chapters.length) {
      this.loadChapter(chapters[index].id);
    }
  }

  scrollToPage(pageIdx) {
    const pageElements = this.readerCanvas.querySelectorAll('.reader-page-item');
    if (pageElements[pageIdx]) {
      const targetY = pageElements[pageIdx].offsetTop - 20;
      this.readerMainArea.scrollTo({ top: targetY, behavior: 'smooth' });
      this.currentPageIndex = pageIdx;
      this.updatePageCounter();
    }
  }

  handleScroll() {
    if (this.readerWrapper.classList.contains('hidden') || !this.readerMainArea) return;

    const scrollTop = this.readerMainArea.scrollTop;
    const scrollHeight = this.readerMainArea.scrollHeight - this.readerMainArea.clientHeight;
    
    if (scrollHeight <= 0) return;

    const progressPercent = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
    if (this.progressBar) {
      this.progressBar.style.width = `${progressPercent}%`;
    }

    // Determine currently visible page index in Webtoon view
    const pageElements = this.readerCanvas.querySelectorAll('.reader-page-item');
    let currentIdx = 0;
    const wrapperCenter = scrollTop + this.readerMainArea.clientHeight / 2;

    pageElements.forEach((el, idx) => {
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (wrapperCenter >= top && wrapperCenter <= bottom) {
        currentIdx = idx;
      }
    });

    if (this.currentPageIndex !== currentIdx) {
      this.currentPageIndex = currentIdx;
      this.updatePageCounter();
    }
  }

  updateProgressUI() {
    if (this.sidebarChapterSubtitle && this.currentChapter) {
      this.sidebarChapterSubtitle.textContent = this.currentChapter.title;
    }
    this.populatePageDropdown();
    this.updatePageCounter();
    this.renderComments();
  }

  populatePageDropdown() {
    if (!this.readerPageSelect) return;
    const total = this.currentChapter?.pages?.length || 0;
    this.readerPageSelect.innerHTML = '';
    
    for (let i = 0; i < total; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `${i + 1} / ${total}`;
      this.readerPageSelect.appendChild(opt);
    }
  }

  updatePageCounter() {
    if (this.readerPageSelect) {
      this.readerPageSelect.value = this.currentPageIndex;
    }
  }

  renderComments() {
    if (!this.currentManga || !this.currentChapter) return;
    const feed = document.getElementById('comments-feed-list');
    if (!feed) return;

    const key = `notes_${this.currentManga.id}_${this.currentChapter.id}`;
    const notes = JSON.parse(localStorage.getItem(key) || '[]');

    if (notes.length === 0) {
      feed.innerHTML = `<div class="empty-feed">Chưa có bình luận nào. Hãy là người đầu tiên để lại cảm nhận!</div>`;
      return;
    }

    feed.innerHTML = notes.map((c) => `
      <div class="comment-card-item" style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--bg-glass-border); border-radius: var(--radius-sm); padding: 8px 10px; margin-bottom: 8px;">
        <div class="comment-card-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span class="comment-card-author" style="font-weight: 700; font-size: 0.82rem; color: #a5b4fc;">
            <i class="far fa-user-circle"></i> ${c.author || 'Độc giả'}
          </span>
          <span class="comment-card-time" style="font-size: 0.72rem; color: var(--text-muted);">${c.time}</span>
        </div>
        <div class="comment-card-text" style="font-size: 0.84rem; color: var(--text-primary); line-height: 1.4;">${c.text}</div>
      </div>
    `).join('');
  }

  submitComment() {
    const nameInput = document.getElementById('comment-author-name');
    const input = document.getElementById('comment-textarea');
    if (!input || !this.currentManga || !this.currentChapter) return;
    const text = input.value.trim();
    if (!text) return;

    const authorName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : 'Độc giả';
    const key = `notes_${this.currentManga.id}_${this.currentChapter.id}`;
    const notes = JSON.parse(localStorage.getItem(key) || '[]');

    const newNote = {
      author: authorName,
      text: text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    notes.unshift(newNote);
    localStorage.setItem(key, JSON.stringify(notes));
    input.value = '';
    this.renderComments();
  }

  shareOnFacebook() {
    if (!this.currentManga || !this.currentChapter) return;

    // Luôn ưu tiên dùng URL công khai Cloudflare Pages để máy chủ Facebook crawl tạo Preview Card đẹp mắt
    let baseUrl = 'https://drive-manga.pages.dev';
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && window.location.protocol !== 'file:') {
      baseUrl = window.location.protocol + '//' + window.location.host;
    }

    const shareUrl = `${baseUrl}/?manga=${encodeURIComponent(this.currentManga.id)}&chap=${encodeURIComponent(this.currentChapter.id)}`;
    const fbShareDialogUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    
    window.open(fbShareDialogUrl, 'fbShareWindow', 'width=650,height=550,scrollbars=yes,resizable=yes');
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

  toggleBookmark() {
    if (!this.currentManga) return;
    let bMarks = JSON.parse(localStorage.getItem('manga_bookmarks') || '[]');
    if (bMarks.includes(this.currentManga.id)) {
      bMarks = bMarks.filter(id => id !== this.currentManga.id);
    } else {
      bMarks.push(this.currentManga.id);
    }
    localStorage.setItem('manga_bookmarks', JSON.stringify(bMarks));
    const btn = document.getElementById('btn-sidebar-bookmark');
    if (btn) {
      const isBookmarked = bMarks.includes(this.currentManga.id);
      btn.innerHTML = `<i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark" style="${isBookmarked ? 'color:#818cf8;' : ''}"></i>`;
    }
  }

  startAutoScroll() {
    this.autoScrollActive = true;
    const btn = document.getElementById('btn-toggle-autoscroll');
    if (btn) {
      btn.style.color = '#818cf8';
      btn.innerHTML = '<i class="fas fa-pause"></i> Tắt Tự Động Cuộn';
    }
    
    this.autoScrollTimer = setInterval(() => {
      if (!this.readerMainArea) return;
      this.readerMainArea.scrollTop += this.autoScrollSpeed;
      if (this.readerMainArea.scrollTop + this.readerMainArea.clientHeight >= this.readerMainArea.scrollHeight - 5) {
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
      btn.innerHTML = '<i class="fas fa-play"></i> Bật Tự Động Cuộn';
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

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      this.readerWrapper.requestFullscreen().catch(err => console.log(err));
    } else {
      document.exitFullscreen().catch(err => console.log(err));
    }
  }

  handleKeyDown(e) {
    if (this.readerWrapper.classList.contains('hidden')) return;
    if (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT') return;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        if (this.readerMainArea) this.readerMainArea.scrollTop += 120;
        break;
      case 'ArrowUp':
      case 'k':
        if (this.readerMainArea) this.readerMainArea.scrollTop -= 120;
        break;
      case ' ':
        e.preventDefault();
        if (this.readerMainArea) this.readerMainArea.scrollTop += window.innerHeight * 0.8;
        break;
      case 'f':
      case 'F':
        this.toggleFullscreen();
        break;
      case 's':
      case 'S':
        this.toggleSidebar();
        break;
    }
  }
}
