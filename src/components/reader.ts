/**
 * Reader Component: Supports Webtoon vertical scroll, Horizontal Manga 2D/3D Canvas Page Curl engine,
 * and PDF direct embedded viewing.
 */

import { Manga, Chapter, CommentItem } from '../types/manga';
import { DriveHelper } from '../driveHelper';
import { PdfHelper } from '../pdfHelper';
import { FirebaseService } from '../firebaseService';

export class ReaderComponent {
  state: any;
  currentManga: Manga | null = null;
  currentChapter: Chapter | null = null;
  currentPageIndex = 0;
  readingMode: 'webtoon' | 'horizontal-rtl' | 'horizontal-ltr';
  zoomLevel: 'default' | 'wide' | 'full';
  autoScrollActive = false;
  autoScrollSpeed = 2; // px per tick
  autoScrollTimer: any = null;
  controlsVisible = true;
  isFlipping = false;
  lastScrollTop = 0;
  canvasCurlEngine: any = null;
  unsubscribeComments?: () => void;

  readerWrapper: HTMLElement | null = null;
  readerMainArea: HTMLElement | null = null;
  readerCanvas: HTMLElement | null = null;
  readerTopFloating: HTMLElement | null = null;
  readerMangaTitleTop: HTMLElement | null = null;
  sidebarMangaTitle: HTMLElement | null = null;
  sidebarChapterSubtitle: HTMLElement | null = null;
  readerChapterSelect: HTMLSelectElement | null = null;
  readerPageSelect: HTMLSelectElement | null = null;
  progressBar: HTMLElement | null = null;

  constructor(appState: any) {
    this.state = appState;
    this.readingMode = (localStorage.getItem('drive_manga_reading_mode') as any) || 'webtoon';
    this.zoomLevel = 'default';
    
    this.initDOMReferences();
  }

  initDOMReferences(): void {
    this.readerWrapper = document.getElementById('reader-wrapper');
    this.readerMainArea = document.getElementById('reader-main-area');
    this.readerCanvas = document.getElementById('reader-canvas');
    this.readerTopFloating = document.getElementById('reader-top-floating');
    this.readerMangaTitleTop = document.getElementById('reader-manga-title-top');
    this.sidebarMangaTitle = document.getElementById('sidebar-manga-title');
    this.sidebarChapterSubtitle = document.getElementById('sidebar-chapter-subtitle');
    this.readerChapterSelect = document.getElementById('reader-chapter-select') as HTMLSelectElement | null;
    this.readerPageSelect = document.getElementById('reader-page-select') as HTMLSelectElement | null;
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
      this.readerMainArea.addEventListener('click', (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.manga-canvas-viewport') && !target.closest('.btn-expand-sidebar')) {
          handleOutsideClick();
          if (this.readingMode === 'webtoon' && this.readerWrapper) {
            this.readerWrapper.classList.toggle('is-scrolling-down');
          }
        }
      });
    }

    // Bind Expand Sidebar Button (Support click & touch)
    const expandBtn = document.getElementById('btn-expand-sidebar');
    if (expandBtn) {
      const handleOpenSidebar = (e?: Event) => {
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
    
    // Bind Page Navigation (<<, <, select, >, >>)
    document.getElementById('btn-first-page')?.addEventListener('click', () => this.scrollToPage(0));
    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (this.readingMode.startsWith('horizontal')) {
        this.flipPage(-1);
      } else {
        this.scrollToPage(Math.max(0, this.currentPageIndex - 1));
      }
    });
    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      if (this.readingMode.startsWith('horizontal')) {
        this.flipPage(1);
      } else {
        this.scrollToPage(Math.min((this.currentChapter?.pages?.length || 1) - 1, this.currentPageIndex + 1));
      }
    });
    document.getElementById('btn-last-page')?.addEventListener('click', () => this.scrollToPage((this.currentChapter?.pages?.length || 1) - 1));

    // Bind Reading Mode Selector Buttons
    document.querySelectorAll('#reader-mode-buttons .btn-mode-pill').forEach(btnEl => {
      const btn = btnEl as HTMLElement;
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as any;
        this.setReadingMode(mode);
      });
    });

    document.getElementById('btn-toggle-autoscroll')?.addEventListener('click', () => this.toggleAutoScroll());
    document.getElementById('select-reading-mode')?.addEventListener('change', (e: Event) => this.setReadingMode((e.target as HTMLSelectElement).value as any));
    document.getElementById('select-zoom-level')?.addEventListener('change', (e: Event) => this.setZoomLevel((e.target as HTMLSelectElement).value as any));
    
    this.readerChapterSelect?.addEventListener('change', (e: Event) => {
      this.loadChapter((e.target as HTMLSelectElement).value);
    });

    this.readerPageSelect?.addEventListener('change', (e: Event) => {
      this.scrollToPage(parseInt((e.target as HTMLSelectElement).value, 10));
    });

    // Bind Comments submission & Facebook Share
    document.getElementById('btn-submit-comment')?.addEventListener('click', () => this.submitComment());
    document.getElementById('btn-share-facebook-chapter')?.addEventListener('click', () => this.shareOnFacebook());
    document.getElementById('btn-share-fb-action')?.addEventListener('click', () => this.shareOnFacebook());

    // Handle Keyboard Hotkeys
    window.addEventListener('keydown', (e: KeyboardEvent) => this.handleKeyDown(e));

    // Handle Scroll for Webtoon Progress & Page tracking
    const onScrollEvent = () => {
      if (this.readingMode === 'webtoon' && this.readerWrapper && !this.readerWrapper.classList.contains('hidden')) {
        this.handleScroll();
      }
    };
    window.addEventListener('scroll', onScrollEvent, { passive: true });
    document.addEventListener('scroll', onScrollEvent, { passive: true });
    this.readerMainArea?.addEventListener('scroll', onScrollEvent, { passive: true });

    // Handle screen resize / orientation changes
    window.addEventListener('resize', () => {
      if (this.readerWrapper && !this.readerWrapper.classList.contains('hidden')) {
        this.applyReadingModeBodyStyles();
      }
    });

    this.syncReadingModeUI();
  }

  syncReadingModeUI(): void {
    document.querySelectorAll('#reader-mode-buttons .btn-mode-pill').forEach(btnEl => {
      const btn = btnEl as HTMLElement;
      if (btn.dataset.mode === this.readingMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  toggleSidebar(forceCollapse: boolean | null = null): void {
    if (!this.readerWrapper) return;
    const backdrop = document.getElementById('reader-sidebar-backdrop');
    const expandBtn = document.getElementById('btn-expand-sidebar');
    const isCollapsed = this.readerWrapper.classList.contains('sidebar-collapsed');
    const shouldCollapse = forceCollapse !== null ? forceCollapse : !isCollapsed;

    if (shouldCollapse) {
      this.readerWrapper.classList.add('sidebar-collapsed');
      if (backdrop) backdrop.classList.add('hidden');
      if (expandBtn) expandBtn.classList.remove('hidden');
    } else {
      this.readerWrapper.classList.remove('sidebar-collapsed');
      if (backdrop) backdrop.classList.remove('hidden');
      if (expandBtn) expandBtn.classList.add('hidden');
    }
  }

  open(manga: Manga, chapterId?: string, pushState = true): void {
    if (pushState && this.state?.router) {
      this.state.router.goChapter(manga.id, chapterId || manga.chapters[0]?.id);
      return;
    }

    this.currentManga = manga;
    if (this.readerMangaTitleTop) this.readerMangaTitleTop.textContent = manga.title;
    if (this.sidebarMangaTitle) this.sidebarMangaTitle.textContent = manga.title;
    
    // Giấu hoàn toàn phần Header & Chi tiết truyện
    document.getElementById('library-view')?.classList.add('hidden');
    document.getElementById('detail-view')?.classList.add('hidden');
    document.querySelector('.view-container')?.classList.add('hidden');
    document.querySelector('.app-header')?.classList.add('hidden');

    // Sắp xếp danh sách chương theo thứ tự tự nhiên của tên chương (Chương 1, 2, ..., 10)
    if (manga.chapters && manga.chapters.length > 1) {
      manga.chapters.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' }));
    }

    // Populate chapter select dropdown
    if (this.readerChapterSelect) {
      this.readerChapterSelect.innerHTML = '';
      manga.chapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.textContent = ch.title;
        this.readerChapterSelect?.appendChild(opt);
      });
    }

    const targetChapterId = chapterId || manga.chapters[0]?.id;
    this.loadChapter(targetChapterId);
    this.readerWrapper?.classList.remove('hidden');
    this.applyReadingModeBodyStyles();

    // Reset cuộn về đầu trang đọc
    window.scrollTo(0, 0);
    if (this.readerMainArea) this.readerMainArea.scrollTop = 0;

    // Ghi nhận lượt xem thật khi độc giả mở đọc chương
    FirebaseService.recordView(manga.id);

    // Tự động thu gọn Sidebar trên điện thoại khi mở đọc chương
    if (window.innerWidth <= 768) {
      this.toggleSidebar(true);
    }

    this.syncReadingModeUI();
  }

  applyReadingModeBodyStyles(): void {
    if (this.readingMode === 'webtoon') {
      document.body.classList.add('is-webtoon-reading');
      document.documentElement.classList.add('is-webtoon-reading');
      if (window.innerWidth <= 768) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        if (this.readerMainArea) this.readerMainArea.style.overflow = '';
      } else {
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = '';
      }
    } else {
      document.body.classList.remove('is-webtoon-reading');
      document.documentElement.classList.remove('is-webtoon-reading');
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
  }

  loadChapter(chapterId: string): void {
    if (!this.currentManga) return;
    const chapter = this.currentManga.chapters.find(c => c.id === chapterId) || this.currentManga.chapters[0];
    this.currentChapter = chapter;
    this.currentPageIndex = 0;
    
    if (this.sidebarChapterSubtitle) {
      this.sidebarChapterSubtitle.textContent = chapter.title;
    }
    if (this.readerChapterSelect) {
      this.readerChapterSelect.value = chapter.id;
    }

    this.updateBookmarkButtonState();
    this.renderPages();
    this.updatePageSelect();
    this.updateChapterNavButtons();
    
    // Lưu lịch sử đọc
    this.state.saveReadingHistory(this.currentManga.id, chapter.id, chapter.title);

    // Tải bình luận
    this.loadComments(chapter.id);
    this.initDisqusComments(this.currentManga.id, chapter.id);

    // Update URL hash
    if (this.state?.router && !window.location.hash.includes(chapter.id)) {
      this.state.router.goChapter(this.currentManga.id, chapter.id);
    }
  }

  updateBookmarkButtonState(): void {
    if (!this.currentManga) return;
    const isBookmarked = this.state.isBookmarked(this.currentManga.id);
    const btn = document.getElementById('btn-sidebar-bookmark');
    if (btn) {
      btn.innerHTML = `<i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark" style="${isBookmarked ? 'color: #818cf8;' : ''}"></i>`;
      btn.title = isBookmarked ? 'Đã yêu thích bộ này' : 'Thêm vào yêu thích';
    }
  }

  toggleBookmark(): void {
    if (!this.currentManga) return;
    this.state.toggleBookmark(this.currentManga.id);
    this.updateBookmarkButtonState();
  }

  updateChapterNavButtons(): void {
    const chapters = this.currentManga?.chapters || [];
    const idx = chapters.findIndex(c => c.id === this.currentChapter?.id);
    
    const btnFirst = document.getElementById('btn-first-chapter') as HTMLButtonElement | null;
    const btnPrev = document.getElementById('btn-prev-chapter-side') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-next-chapter-side') as HTMLButtonElement | null;
    const btnLast = document.getElementById('btn-last-chapter') as HTMLButtonElement | null;

    if (btnFirst) btnFirst.disabled = idx <= 0;
    if (btnPrev) btnPrev.disabled = idx <= 0;
    if (btnNext) btnNext.disabled = idx >= chapters.length - 1;
    if (btnLast) btnLast.disabled = idx >= chapters.length - 1;
  }

  loadComments(chapterId: string): void {
    if (this.unsubscribeComments) {
      this.unsubscribeComments();
      this.unsubscribeComments = undefined;
    }

    this.unsubscribeComments = FirebaseService.subscribeChapterComments(chapterId, (comments) => {
      this.renderComments(comments);
    });
  }

  renderComments(comments: CommentItem[]): void {
    const feed = document.getElementById('comments-feed-list');
    if (!feed) return;

    feed.innerHTML = '';
    if (!comments || comments.length === 0) {
      feed.innerHTML = '<div class="empty-feed">Chưa có bình luận nào. Hãy là người đầu tiên để lại cảm nhận!</div>';
      return;
    }

    comments.forEach(c => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.style.cssText = 'padding: 8px 10px; background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); margin-bottom: 6px; border: 1px solid rgba(255,255,255,0.05);';

      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; font-size: 0.75rem; color: #818cf8; margin-bottom: 3px;';

      const authorStrong = document.createElement('strong');
      authorStrong.textContent = c.author || 'Độc giả';

      const timeSpan = document.createElement('span');
      timeSpan.style.color = 'var(--text-muted)';
      timeSpan.textContent = c.timestamp || 'Vừa xong';

      header.appendChild(authorStrong);
      header.appendChild(timeSpan);

      const bodyDiv = document.createElement('div');
      bodyDiv.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; word-break: break-word;';
      bodyDiv.textContent = c.text;

      item.appendChild(header);
      item.appendChild(bodyDiv);
      feed.appendChild(item);
    });
  }

  async submitComment(): Promise<void> {
    const authorInput = document.getElementById('comment-author-name') as HTMLInputElement | null;
    const textInput = document.getElementById('comment-textarea') as HTMLTextAreaElement | null;
    const submitBtn = document.getElementById('btn-submit-comment') as HTMLButtonElement | null;
    if (!textInput || !this.currentChapter) return;

    const text = textInput.value.trim();
    const author = authorInput ? authorInput.value.trim() : '';

    if (!text) {
      alert('Vui lòng nhập nội dung bình luận!');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang gửi...';
    }

    try {
      await FirebaseService.addChapterComment(this.currentChapter.id, author || 'Độc giả', text);
      textInput.value = '';
    } catch (err) {
      console.warn('Lỗi gửi bình luận:', err);
      alert('Không thể gửi bình luận trực tuyến. Vui lòng kiểm tra lại kết nối!');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Gửi Bình Luận';
      }
    }
  }

  shareOnFacebook(): void {
    if (!this.currentManga || !this.currentChapter) return;
    const url = window.location.href;
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    window.open(shareUrl, 'fbShareWindow', 'height=450, width=550, top=' + (window.innerHeight / 2 - 225) + ', left=' + (window.innerWidth / 2 - 275) + ', toolbar=0, location=0, menubar=0, directories=0, scrollbars=0');
  }

  initDisqusComments(mangaId: string, chapterId: string): void {
    const disqusContainer = document.getElementById('disqus_thread');
    if (!disqusContainer || !this.currentManga || !this.currentChapter) return;

    const shortname = 'drivemanga';
    const pageIdentifier = `${mangaId}_${chapterId}`;
    const pageUrl = window.location.href;
    const pageTitle = `${this.currentManga.title} - ${this.currentChapter.title}`;

    const showFallbackUI = () => {
      if (disqusContainer) {
        disqusContainer.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-subtle); border-radius: var(--radius-md);">
            <i class="fab fa-comments" style="font-size: 2rem; color: #818cf8; margin-bottom: 0.5rem;"></i>
            <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">Khu vực bình luận cộng đồng Disqus</p>
            <a href="https://disqus.com" target="_blank" rel="noopener noreferrer" class="btn-secondary" style="font-size: 0.8rem; padding: 6px 14px; border-radius: var(--radius-sm);">Mở Trang Bình Luận</a>
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
      s.setAttribute('data-timestamp', String(+new Date()));
      s.onerror = showFallbackUI;
      (d.head || d.body).appendChild(s);
    }
  }

  renderPages(): void {
    if (!this.readerCanvas || !this.currentChapter) return;
    this.readerCanvas.innerHTML = '';

    const pages = this.currentChapter.pages || [];
    const pdfSource = this.currentChapter.pdfUrl || (pages[0] && PdfHelper.isPdfSource(pages[0]) ? pages[0] : null);

    // If Chapter source is a PDF file
    if (pdfSource || this.currentChapter.isPdf) {
      if (this.readerWrapper) this.readerWrapper.classList.add('is-pdf-active');
      this.readerCanvas.className = `reader-canvas ${this.zoomLevel} is-pdf-mode`;
      const source = pdfSource || pages[0];
      PdfHelper.renderPdfToContainer(source, this.readerCanvas, (totalPdfPages) => {
        if (this.currentChapter && (!this.currentChapter.pages || this.currentChapter.pages.length !== totalPdfPages)) {
          this.currentChapter.pages = Array.from({ length: totalPdfPages }, (_, i) => `PDF Page ${i + 1}`);
        }
        this.updateProgressUI();
      });
      return;
    } else {
      if (this.readerWrapper) this.readerWrapper.classList.remove('is-pdf-active');
    }
    
    if (pages.length === 0) {
      this.readerCanvas.className = `reader-canvas ${this.zoomLevel}`;
      this.readerCanvas.innerHTML = `
        <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
          <p>Chương này chưa có ảnh hoặc link Google Drive không khả dụng.</p>
        </div>
      `;
      return;
    }

    // NẾU LÀ CHẾ ĐỘ MANGA NGANG (Right-to-Left / Left-to-Right)
    if (this.readingMode === 'horizontal-rtl' || this.readingMode === 'horizontal-ltr') {
      if (this.readerMainArea) this.readerMainArea.style.overflow = 'hidden';
      this.renderHorizontalFlipMode();
      return;
    } else {
      if (this.readerMainArea) {
        this.readerMainArea.style.overflow = window.innerWidth <= 768 ? '' : 'auto';
      }
    }

    // MẶC ĐỊNH: CHẾ ĐỘ WEBTOON CUỘN DỌC
    this.readerCanvas.className = `reader-canvas ${this.zoomLevel}`;
    pages.forEach((pageItem, index) => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'reader-page-item';
      pageDiv.dataset.pageIndex = String(index);

      const img = document.createElement('img');
      img.alt = `Trang ${index + 1}`;
      img.referrerPolicy = 'no-referrer';
      img.loading = index < 3 ? 'eager' : 'lazy';
      img.decoding = 'async';

      const fileId = DriveHelper.extractFileId(pageItem);
      if (fileId) {
        DriveHelper.attachImageFallback(img, fileId);
      } else {
        try {
          const parsed = new URL(pageItem);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            img.src = parsed.href;
            img.onerror = () => {
              img.classList.add('img-load-error');
              img.alt = 'Không thể tải ảnh.';
            };
          }
        } catch {}
      }

      pageDiv.appendChild(img);
      this.readerCanvas?.appendChild(pageDiv);
    });

    this.preloadNextChapter();
    this.updateProgressUI();
  }

  /**
   * MANGA CANVAS PAGE CURL ENGINE
   */
  renderHorizontalFlipMode(): void {
    const pages = this.currentChapter?.pages || [];
    if (pages.length === 0 || !this.readerCanvas) return;

    if (this.canvasCurlEngine) {
      try {
        this.canvasCurlEngine.destroy();
      } catch (e) {}
      this.canvasCurlEngine = null;
    }

    this.readerCanvas.innerHTML = '';
    this.readerCanvas.className = `reader-canvas ${this.zoomLevel} is-horizontal-flip-mode`;
    if (this.readerMainArea) {
      this.readerMainArea.scrollTop = 0;
      this.readerMainArea.style.overflow = 'hidden';
    }

    const viewport = document.createElement('div');
    viewport.className = 'manga-canvas-viewport';
    viewport.id = 'manga-canvas-viewport';

    const canvas = document.createElement('canvas');
    canvas.className = 'manga-curl-canvas';
    canvas.id = 'manga-curl-canvas';
    viewport.appendChild(canvas);

    this.readerCanvas.appendChild(viewport);

    this.initCanvasCurlEngine(viewport, canvas, pages);
    this.updateProgressUI();
  }

  initCanvasCurlEngine(viewport: HTMLElement, canvas: HTMLCanvasElement, pages: string[]): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const state = {
      currentPage: this.currentPageIndex || 0,
      targetPage: -1,
      isDragging: false,
      isAnimating: false,
      progress: 0,
      corner: { x: 0, y: 0 },
      finger: { x: 0, y: 0 },
      animFrame: null as number | null
    };

    const imageCache = new Map<number, HTMLImageElement>();

    let isDrawPending = false;
    const requestDraw = () => {
      if (isDrawPending) return;
      isDrawPending = true;
      requestAnimationFrame(() => {
        isDrawPending = false;
        draw();
      });
    };

    const loadImage = (idx: number): HTMLImageElement | null => {
      if (idx < 0 || idx >= pages.length) return null;
      if (imageCache.has(idx)) return imageCache.get(idx)!;
      const pageItem = pages[idx];
      const fileId = DriveHelper.extractFileId(pageItem);
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.addEventListener('load', () => requestDraw());
      if (fileId) {
        DriveHelper.attachImageFallback(img, fileId);
      } else {
        try {
          const parsed = new URL(pageItem);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            img.src = parsed.href;
          }
        } catch {}
      }
      imageCache.set(idx, img);
      return img;
    };

    const preload = (currentIdx: number) => {
      [currentIdx - 1, currentIdx, currentIdx + 1, currentIdx + 2].forEach(i => {
        if (i >= 0 && i < pages.length) loadImage(i);
      });
    };

    function drawImageFit(img: HTMLImageElement | null, x: number, y: number, w: number, h: number) {
      if (!ctx) return;
      if (!img || !img.complete || img.naturalWidth === 0) {
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#64748b';
        ctx.font = '15px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Đang tải trang...', x + w / 2, y + h / 2);
        return;
      }
      ctx.fillStyle = '#05070c';
      ctx.fillRect(x, y, w, h);

      const imgW = img.naturalWidth;
      const imgH = img.naturalHeight;
      const scale = Math.min(w / imgW, h / imgH);
      const dw = imgW * scale;
      const dh = imgH * scale;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);
    }

    function draw() {
      if (!ctx) return;
      const w = parseFloat(canvas.style.width) || canvas.width;
      const h = parseFloat(canvas.style.height) || canvas.height;

      ctx.clearRect(0, 0, w, h);

      const currentImg = loadImage(state.currentPage);

      if (state.progress <= 0.001 || (!state.isDragging && !state.isAnimating)) {
        drawImageFit(currentImg, 0, 0, w, h);
        return;
      }

      ctx.fillStyle = '#05070c';
      ctx.fillRect(0, 0, w, h);

      const targetImg = state.targetPage >= 0 ? loadImage(state.targetPage) : null;

      const cornerX = state.corner.x;
      const cornerY = state.corner.y;
      const fingerX = state.finger.x;
      const fingerY = state.finger.y;

      const midX = (cornerX + fingerX) / 2;
      const midY = (cornerY + fingerY) / 2;

      const dx = fingerX - cornerX;
      const dy = fingerY - cornerY;
      const angle = Math.atan2(dy, dx);
      const foldAngle = angle + Math.PI / 2;

      const cosFold = Math.cos(foldAngle);
      const sinFold = Math.sin(foldAngle);
      const cosN = Math.cos(angle);
      const sinN = Math.sin(angle);
      const extend = Math.max(w, h) * 3;

      const p1X = midX - cosFold * extend;
      const p1Y = midY - sinFold * extend;
      const p2X = midX + cosFold * extend;
      const p2Y = midY + sinFold * extend;

      // 1. VẼ TRANG KẾ TIẾP
      if (targetImg) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1X, p1Y);
        ctx.lineTo(p2X, p2Y);
        ctx.lineTo(p2X - cosN * extend, p2Y - sinN * extend);
        ctx.lineTo(p1X - cosN * extend, p1Y - sinN * extend);
        ctx.closePath();
        ctx.clip();

        drawImageFit(targetImg, 0, 0, w, h);

        const underShadow = ctx.createLinearGradient(midX, midY, midX - cosN * 45, midY - sinN * 45);
        underShadow.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
        underShadow.addColorStop(0.3, 'rgba(0, 0, 0, 0.3)');
        underShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = underShadow;
        ctx.fill();

        ctx.restore();
      }

      // 2. VẼ TRANG HIỆN TẠI
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);
      ctx.lineTo(p2X + cosN * extend, p2Y + sinN * extend);
      ctx.lineTo(p1X + cosN * extend, p1Y + sinN * extend);
      ctx.closePath();
      ctx.clip();

      drawImageFit(currentImg, 0, 0, w, h);
      ctx.restore();

      // 3. VẼ VẠT GIẤY BẺ CONG LẬT NGƯỢC
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p1X, p1Y);
      ctx.lineTo(p2X, p2Y);
      ctx.lineTo(p2X + cosN * extend, p2Y + sinN * extend);
      ctx.lineTo(p1X + cosN * extend, p1Y + sinN * extend);
      ctx.closePath();
      ctx.clip();

      ctx.translate(midX, midY);
      ctx.rotate(foldAngle);
      ctx.scale(1, -1);
      ctx.rotate(-foldAngle);
      ctx.translate(-midX, -midY);

      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();

      ctx.fillStyle = '#1c2230';
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.22;
      drawImageFit(currentImg, 0, 0, w, h);
      ctx.globalAlpha = 1.0;

      const curlGrad = ctx.createLinearGradient(midX, midY, midX + cosN * 60, midY + sinN * 60);
      curlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
      curlGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.12)');
      curlGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
      curlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
      ctx.fillStyle = curlGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();
    }

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const maxW = viewport.clientWidth || window.innerWidth;
      const maxH = viewport.clientHeight || window.innerHeight;

      let renderH = Math.max(400, maxH - 12);
      let renderW = Math.round(renderH * 0.72);
      if (renderW > maxW - 12) {
        renderW = maxW - 12;
        renderH = Math.round(renderW / 0.72);
      }

      canvas.style.width = `${renderW}px`;
      canvas.style.height = `${renderH}px`;
      canvas.width = Math.round(renderW * dpr);
      canvas.height = Math.round(renderH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      requestDraw();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    preload(state.currentPage);

    const animateTo = (endX: number, endY: number, onComplete?: () => void) => {
      state.isAnimating = true;
      const startX = state.finger.x;
      const startY = state.finger.y;
      const startTime = performance.now();
      const duration = 250;

      const step = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        state.finger.x = startX + (endX - startX) * ease;
        state.finger.y = startY + (endY - startY) * ease;
        draw();

        if (t < 1) {
          state.animFrame = requestAnimationFrame(step);
        } else {
          state.isAnimating = false;
          if (onComplete) onComplete();
        }
      };
      if (state.animFrame) cancelAnimationFrame(state.animFrame);
      state.animFrame = requestAnimationFrame(step);
    };

    const getCanvasPoint = (e: any) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
        y: Math.max(0, Math.min(rect.height, clientY - rect.top))
      };
    };

    let startPt = { x: 0, y: 0 };
    let startTime = 0;
    let isTouchActive = false;

    const onPointerDown = (e: any) => {
      if (state.isAnimating) return;
      startPt = getCanvasPoint(e);
      startTime = performance.now();
      isTouchActive = true;
      state.isDragging = false;
      state.progress = 0;
      state.targetPage = -1;
    };

    const onPointerMove = (e: any) => {
      if (!isTouchActive || state.isAnimating) return;
      const pt = getCanvasPoint(e);
      const w = parseFloat(canvas.style.width) || canvas.width;
      const h = parseFloat(canvas.style.height) || canvas.height;

      const dist = Math.hypot(pt.x - startPt.x, pt.y - startPt.y);

      if (!state.isDragging && dist > 5) {
        if (startPt.x < w * 0.5) {
          if (state.currentPage >= pages.length - 1) return;
          state.targetPage = state.currentPage + 1;
          state.corner = { x: 0, y: startPt.y < h * 0.5 ? 0 : h };
        } else {
          if (state.currentPage <= 0) return;
          state.targetPage = state.currentPage - 1;
          state.corner = { x: w, y: startPt.y < h * 0.5 ? 0 : h };
        }
        state.isDragging = true;
        viewport.classList.add('is-dragging');
      }

      if (state.isDragging) {
        if (e.cancelable) e.preventDefault();
        state.finger = { ...pt };
        state.progress = Math.min(1, Math.max(0.01, Math.abs(state.finger.x - state.corner.x) / (w * 0.95)));
        requestDraw();
      }
    };

    const onPointerUp = () => {
      if (!isTouchActive || state.isAnimating) return;
      isTouchActive = false;
      viewport.classList.remove('is-dragging');

      const w = parseFloat(canvas.style.width) || canvas.width;

      if (!state.isDragging) {
        state.progress = 0;
        state.targetPage = -1;
        requestDraw();
        return;
      }

      state.isDragging = false;
      const dist = Math.abs(state.finger.x - state.corner.x);
      const elapsed = performance.now() - startTime;
      const velocity = dist / (elapsed || 1);

      const shouldFlip = dist > w * 0.26 || (velocity > 0.35 && dist > 20);

      if (shouldFlip) {
        const targetX = state.corner.x === 0 ? w * 1.35 : -w * 0.35;
        const targetY = state.corner.y;

        animateTo(targetX, targetY, () => {
          state.currentPage = state.targetPage;
          this.currentPageIndex = state.currentPage;
          state.progress = 0;
          state.targetPage = -1;
          preload(state.currentPage);
          requestDraw();
          this.updateProgressUI();
        });
      } else {
        animateTo(state.corner.x, state.corner.y, () => {
          state.progress = 0;
          state.targetPage = -1;
          requestDraw();
        });
      }
    };

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    this.canvasCurlEngine = {
      flip: (direction: number) => {
        if (state.isAnimating) return;
        const w = parseFloat(canvas.style.width) || canvas.width;
        const h = parseFloat(canvas.style.height) || canvas.height;

        const targetIndex = state.currentPage + direction;
        if (targetIndex < 0 || targetIndex >= pages.length) return;

        state.targetPage = targetIndex;
        state.corner = direction > 0 ? { x: 0, y: h } : { x: w, y: h };
        state.finger = { ...state.corner };
        state.progress = 0.05;

        const targetX = state.corner.x === 0 ? w * 1.35 : -w * 0.35;
        animateTo(targetX, state.corner.y, () => {
          state.currentPage = targetIndex;
          this.currentPageIndex = state.currentPage;
          state.progress = 0;
          state.targetPage = -1;
          preload(state.currentPage);
          requestDraw();
          this.updateProgressUI();
        });
      },
      turnToPage: (pageIdx: number) => {
        if (pageIdx >= 0 && pageIdx < pages.length) {
          state.currentPage = pageIdx;
          this.currentPageIndex = pageIdx;
          state.progress = 0;
          state.targetPage = -1;
          preload(pageIdx);
          requestDraw();
          this.updateProgressUI();
        }
      },
      destroy: () => {
        window.removeEventListener('resize', resizeCanvas);
        canvas.removeEventListener('touchstart', onPointerDown);
        window.removeEventListener('touchmove', onPointerMove);
        window.removeEventListener('touchend', onPointerUp);
        window.removeEventListener('touchcancel', onPointerUp);
        canvas.removeEventListener('mousedown', onPointerDown);
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('mouseup', onPointerUp);
        if (state.animFrame) cancelAnimationFrame(state.animFrame);
        isDrawPending = false;
        imageCache.clear();
      }
    };
  }

  flipPage(direction: number): void {
    const pages = this.currentChapter?.pages || [];
    if (pages.length === 0) return;

    if (this.canvasCurlEngine) {
      if (direction > 0 && this.currentPageIndex >= pages.length - 1) {
        this.nextChapter();
        return;
      }
      if (direction < 0 && this.currentPageIndex <= 0) {
        this.prevChapter();
        return;
      }
      this.canvasCurlEngine.flip(direction);
    }
  }

  scrollToPage(pageIdx: number): void {
    const pages = this.currentChapter?.pages || [];
    if (pageIdx < 0 || pageIdx >= pages.length) return;

    if (this.readingMode.startsWith('horizontal')) {
      this.currentPageIndex = pageIdx;
      if (this.canvasCurlEngine) {
        this.canvasCurlEngine.turnToPage(pageIdx);
      }
      this.updateProgressUI();
      return;
    }

    const pageElements = this.readerCanvas?.querySelectorAll('.reader-page-item');
    if (pageElements && pageElements[pageIdx]) {
      const isMobileWebtoon = window.innerWidth <= 768 && document.body.classList.contains('is-webtoon-reading');
      const targetY = (pageElements[pageIdx] as HTMLElement).offsetTop - 20;
      if (isMobileWebtoon) {
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      } else if (this.readerMainArea) {
        this.readerMainArea.scrollTo({ top: targetY, behavior: 'smooth' });
      }
      this.currentPageIndex = pageIdx;
      this.updateProgressUI();
    }
  }

  preloadNextChapter(): void {
    if (!this.currentManga || !this.currentChapter) return;
    const chapters = this.currentManga.chapters || [];
    const currentIdx = chapters.findIndex(c => c.id === this.currentChapter?.id);
    if (currentIdx !== -1 && currentIdx < chapters.length - 1) {
      const nextChap = chapters[currentIdx + 1];
      const nextPages = nextChap.pages || [];
      nextPages.slice(0, 3).forEach(pageItem => {
        const fileId = DriveHelper.extractFileId(pageItem);
        if (fileId) {
          const img = new Image();
          img.referrerPolicy = 'no-referrer';
          DriveHelper.attachImageFallback(img, fileId);
        } else {
          try {
            const parsed = new URL(pageItem);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
              const img = new Image();
              img.referrerPolicy = 'no-referrer';
              img.src = parsed.href;
            }
          } catch {}
        }
      });
    }
  }

  goToChapterIndex(index: number): void {
    const chapters = this.currentManga?.chapters || [];
    if (index >= 0 && index < chapters.length) {
      this.loadChapter(chapters[index].id);
    }
  }

  nextChapter(): void {
    const chapters = this.currentManga?.chapters || [];
    const currentIdx = chapters.findIndex(c => c.id === this.currentChapter?.id);
    if (currentIdx !== -1 && currentIdx < chapters.length - 1) {
      this.loadChapter(chapters[currentIdx + 1].id);
    }
  }

  prevChapter(): void {
    const chapters = this.currentManga?.chapters || [];
    const currentIdx = chapters.findIndex(c => c.id === this.currentChapter?.id);
    if (currentIdx > 0) {
      this.loadChapter(chapters[currentIdx - 1].id);
    }
  }

  updatePageSelect(): void {
    if (!this.readerPageSelect || !this.currentChapter) return;
    this.readerPageSelect.innerHTML = '';
    const pages = this.currentChapter.pages || [];
    pages.forEach((_, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = `Trang ${idx + 1} / ${pages.length}`;
      this.readerPageSelect?.appendChild(opt);
    });
    this.readerPageSelect.value = String(this.currentPageIndex);
  }

  updateProgressUI(): void {
    const totalPages = this.currentChapter?.pages?.length || 1;
    let percent = 0;

    if (this.readingMode.startsWith('horizontal')) {
      percent = Math.round(((this.currentPageIndex + 1) / totalPages) * 100);
    } else {
      if (this.readerMainArea) {
        const scrollTop = this.readerMainArea.scrollTop;
        const scrollHeight = this.readerMainArea.scrollHeight - this.readerMainArea.clientHeight;
        percent = scrollHeight > 0 ? Math.round((scrollTop / scrollHeight) * 100) : 0;
      }
    }

    if (this.progressBar) {
      this.progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
    if (this.readerPageSelect) {
      this.readerPageSelect.value = String(this.currentPageIndex);
    }
  }

  handleScroll(): void {
    const isMobileWebtoon = window.innerWidth <= 768 && document.body.classList.contains('is-webtoon-reading');
    const scrollTop = isMobileWebtoon
      ? (window.scrollY || document.documentElement.scrollTop || 0)
      : (this.readerMainArea?.scrollTop || 0);

    if (this.readingMode === 'webtoon') {
      const scrollDiff = scrollTop - (this.lastScrollTop || 0);

      if (scrollDiff > 6 && scrollTop > 25) {
        if (this.readerWrapper && !this.readerWrapper.classList.contains('is-scrolling-down')) {
          this.readerWrapper.classList.add('is-scrolling-down');
        }
        if (window.innerWidth <= 768 && this.readerWrapper && !this.readerWrapper.classList.contains('sidebar-collapsed')) {
          this.toggleSidebar(true);
        }
      } else if (scrollDiff < -6 || scrollTop <= 20) {
        if (this.readerWrapper && this.readerWrapper.classList.contains('is-scrolling-down')) {
          this.readerWrapper.classList.remove('is-scrolling-down');
        }
      }

      this.lastScrollTop = Math.max(0, scrollTop);
    }

    const pageElements = this.readerCanvas?.querySelectorAll('.reader-page-item');
    if (!pageElements || pageElements.length === 0) return;

    const viewportH = isMobileWebtoon ? window.innerHeight : (this.readerMainArea?.clientHeight || window.innerHeight);
    const viewportMiddle = scrollTop + (viewportH / 2);

    let activeIdx = 0;
    pageElements.forEach((el, idx) => {
      if ((el as HTMLElement).offsetTop <= viewportMiddle) {
        activeIdx = idx;
      }
    });

    if (this.currentPageIndex !== activeIdx) {
      this.currentPageIndex = activeIdx;
    }
    this.updateProgressUI();
  }

  toggleAutoScroll(): void {
    if (this.autoScrollActive) {
      this.stopAutoScroll();
    } else {
      this.startAutoScroll();
    }
  }

  startAutoScroll(): void {
    this.autoScrollActive = true;
    const btn = document.getElementById('btn-toggle-autoscroll');
    if (btn) {
      btn.style.color = '#818cf8';
      btn.innerHTML = '<i class="fas fa-pause"></i> Dừng Tự Động Cuộn';
    }

    this.autoScrollTimer = setInterval(() => {
      const isMobileWebtoon = window.innerWidth <= 768 && document.body.classList.contains('is-webtoon-reading');
      if (this.readingMode.startsWith('horizontal')) {
        this.flipPage(1);
      } else if (isMobileWebtoon) {
        window.scrollBy({ top: this.autoScrollSpeed, behavior: 'smooth' });
        if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 10)) {
          this.stopAutoScroll();
        }
      } else {
        if (!this.readerMainArea) return;
        this.readerMainArea.scrollTop += this.autoScrollSpeed;
        if (this.readerMainArea.scrollTop + this.readerMainArea.clientHeight >= this.readerMainArea.scrollHeight - 5) {
          this.stopAutoScroll();
        }
      }
    }, this.readingMode.startsWith('horizontal') ? 3500 : 30);
  }

  stopAutoScroll(): void {
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

  setZoomLevel(level: 'default' | 'wide' | 'full'): void {
    this.zoomLevel = level;
    if (this.readerCanvas) {
      this.readerCanvas.className = `reader-canvas ${level} ${this.readingMode.startsWith('horizontal') ? 'is-horizontal-flip-mode' : ''}`;
    }
  }

  setReadingMode(mode: 'webtoon' | 'horizontal-rtl' | 'horizontal-ltr'): void {
    if (this.readingMode === mode) return;
    this.stopAutoScroll();
    this.readingMode = mode;
    localStorage.setItem('drive_manga_reading_mode', mode);
    this.applyReadingModeBodyStyles();
    this.syncReadingModeUI();
    this.renderPages();
  }

  toggleFullscreen(): void {
    const elem = document.documentElement as any;
    const isFullscreen = document.fullscreenElement || (document as any).webkitFullscreenElement || (document as any).mozFullScreenElement || (document as any).msFullscreenElement;
    if (!isFullscreen) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err: any) => console.log(err));
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err: any) => console.log(err));
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
    }
  }

  close(): void {
    this.stopAutoScroll();
    if (this.unsubscribeComments) {
      this.unsubscribeComments();
      this.unsubscribeComments = undefined;
    }
    if (this.readerWrapper) {
      this.readerWrapper.classList.add('hidden');
    }
    document.body.classList.remove('is-webtoon-reading');
    document.documentElement.classList.remove('is-webtoon-reading');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // Khôi phục hiển thị cho view-container và header
    document.querySelector('.view-container')?.classList.remove('hidden');
    document.querySelector('.app-header')?.classList.remove('hidden');

    if (this.state?.router) {
      if (this.currentManga) {
        this.state.router.goManga(this.currentManga.id);
      } else {
        this.state.router.goHome();
      }
    } else {
      if (this.currentManga && this.state?.libraryComponent) {
        this.state.libraryComponent.showDetailView(this.currentManga);
      } else {
        document.getElementById('detail-view')?.classList.add('hidden');
        document.getElementById('library-view')?.classList.remove('hidden');
      }
    }
  }

  handleKeyDown(e: KeyboardEvent): void {
    if (!this.readerWrapper || this.readerWrapper.classList.contains('hidden')) return;
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) return;

    const isRTL = this.readingMode === 'horizontal-rtl';

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (this.readingMode.startsWith('horizontal')) {
          this.flipPage(isRTL ? 1 : -1);
        } else {
          this.scrollToPage(Math.max(0, this.currentPageIndex - 1));
        }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (this.readingMode.startsWith('horizontal')) {
          this.flipPage(isRTL ? -1 : 1);
        } else {
          this.scrollToPage(Math.min((this.currentChapter?.pages?.length || 1) - 1, this.currentPageIndex + 1));
        }
        break;
      case 'ArrowDown':
      case 'j':
        if (this.readingMode === 'webtoon') {
          if (this.readerMainArea) this.readerMainArea.scrollTop += 120;
        } else {
          this.flipPage(1);
        }
        break;
      case 'ArrowUp':
      case 'k':
        if (this.readingMode === 'webtoon') {
          if (this.readerMainArea) this.readerMainArea.scrollTop -= 120;
        } else {
          this.flipPage(-1);
        }
        break;
      case ' ':
        e.preventDefault();
        if (this.readingMode === 'webtoon') {
          if (this.readerMainArea) this.readerMainArea.scrollTop += window.innerHeight * 0.8;
        } else {
          this.flipPage(1);
        }
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

if (typeof window !== 'undefined') {
  window.ReaderComponent = ReaderComponent;
}
