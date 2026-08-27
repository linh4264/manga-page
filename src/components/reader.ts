/**
 * Reader Component: Supports Webtoon vertical scroll, Horizontal Manga 2D/3D Canvas Page Curl engine,
 * and PDF direct embedded viewing.
 */

import { Manga, Chapter, CommentItem } from '../types/manga';
import { DriveHelper } from '../driveHelper';
import { PdfHelper } from '../pdfHelper';
import { FirebaseService } from '../firebaseService';
import { CanvasCurlEngine } from '../reader/canvasCurlEngine';
import { SheetDatabase } from '../sheetDatabase';

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
      const maxPages = (this.currentChapter?.pages?.length || 0);
      if (this.readingMode.startsWith('horizontal')) {
        this.flipPage(1);
      } else {
        this.scrollToPage(Math.min(maxPages, this.currentPageIndex + 1));
      }
    });
    document.getElementById('btn-last-page')?.addEventListener('click', () => {
      const maxPages = (this.currentChapter?.pages?.length || 0);
      this.scrollToPage(maxPages);
    });

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

    // Nếu chương chưa tải danh sách ảnh (Lazy chapter data)
    if ((!chapter.pages || chapter.pages.length === 0) && !chapter.pdfUrl && !chapter.isPdf && SheetDatabase) {
      if (this.readerCanvas) {
        this.readerCanvas.className = `reader-canvas ${this.zoomLevel}`;
        this.readerCanvas.innerHTML = `
          <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
            <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; margin-bottom: 1rem; color: #818cf8;"></i>
            <p style="font-size: 1rem; color: var(--text-primary);">Đang tải nội dung ${chapter.title}...</p>
          </div>
        `;
      }
      SheetDatabase.fetchChapterPages(this.currentManga.id, chapter.id, chapter.pages).then(pages => {
        if (this.currentChapter?.id === chapter.id) {
          chapter.pages = pages;
          this.renderPages();
          this.updatePageSelect();
          this.updateProgressUI();
        }
      });
    } else {
      this.renderPages();
      this.updatePageSelect();
    }

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
      } else if (pageItem.startsWith('/') || pageItem.startsWith('data:') || pageItem.startsWith('blob:')) {
        img.src = pageItem;
        img.onerror = () => {
          img.classList.add('img-load-error');
          img.alt = 'Không thể tải ảnh.';
        };
      } else {
        try {
          const parsed = new URL(pageItem, window.location.href);
          if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            img.src = parsed.href;
            img.onerror = () => {
              img.classList.add('img-load-error');
              img.alt = 'Không thể tải ảnh.';
            };
          }
        } catch {
          img.src = pageItem;
        }
      }

      pageDiv.appendChild(img);
      this.readerCanvas?.appendChild(pageDiv);
    });

    // 1. Tự động thêm ảnh Credit.webp vào cuối chương
    const creditDiv = document.createElement('div');
    creditDiv.className = 'reader-page-item reader-credit-item';
    creditDiv.dataset.pageIndex = String(pages.length);

    const creditImg = document.createElement('img');
    creditImg.alt = 'Credit - Manga Translator Studio';
    creditImg.src = '/Credit.webp';
    creditImg.className = 'reader-credit-img';
    creditImg.referrerPolicy = 'no-referrer';
    creditImg.loading = 'lazy';
    creditImg.decoding = 'async';
    creditImg.onerror = () => {
      creditDiv.style.display = 'none';
    };

    creditDiv.appendChild(creditImg);
    this.readerCanvas.appendChild(creditDiv);

    // 2. Card Điều Hướng Kết Thúc Chương (Sleek End-of-Chapter Card)
    const currentIdx = (this.currentManga?.chapters || []).findIndex(c => c.id === this.currentChapter?.id);
    const hasPrev = currentIdx > 0;
    const hasNext = currentIdx !== -1 && currentIdx < (this.currentManga?.chapters || []).length - 1;
    const nextChapterObj = hasNext ? this.currentManga?.chapters[currentIdx + 1] : null;
    const prevChapterObj = hasPrev ? this.currentManga?.chapters[currentIdx - 1] : null;
    const isBookmarked = this.currentManga ? this.state.isBookmarked(this.currentManga.id) : false;

    const endCard = document.createElement('div');
    endCard.className = 'reader-chapter-end-card glass-panel';
    endCard.innerHTML = `
      <div class="end-card-header">
        <div class="end-card-badge"><i class="fas fa-check-circle"></i> Đã hoàn thành chương</div>
        <h3>${this.currentChapter.title}</h3>
        <p class="end-card-manga-title">${this.currentManga?.title || ''}</p>
      </div>

      <div class="end-card-nav-actions">
        ${hasPrev ? `
          <button type="button" class="btn-secondary btn-end-nav" id="btn-end-prev-chap">
            <i class="fas fa-arrow-left"></i> ${prevChapterObj?.title || 'Chương trước'}
          </button>
        ` : ''}

        ${hasNext ? `
          <button type="button" class="btn-primary btn-end-nav btn-end-next" id="btn-end-next-chap">
            <span>${nextChapterObj?.title || 'Chương tiếp theo'}</span> <i class="fas fa-arrow-right"></i>
          </button>
        ` : `
          <div class="end-card-latest-notice">
            <i class="fas fa-flag-checkered" style="color: #fbbf24; margin-right: 6px;"></i> Bạn đã đọc đến chương mới nhất của bộ truyện này!
          </div>
        `}
      </div>

      <div class="end-card-sub-actions">
        <button type="button" class="btn-secondary btn-end-sub" id="btn-end-bookmark">
          <i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark" style="${isBookmarked ? 'color: #818cf8;' : ''}"></i>
          <span>${isBookmarked ? 'Đã yêu thích' : 'Yêu thích truyện'}</span>
        </button>
        <button type="button" class="btn-secondary btn-end-sub" id="btn-end-share-fb">
          <i class="fab fa-facebook-f" style="color: #1877f2;"></i> <span>Chia sẻ FB</span>
        </button>
        <button type="button" class="btn-secondary btn-end-sub" id="btn-end-back-manga">
          <i class="fas fa-list"></i> <span>Danh sách chương</span>
        </button>
      </div>
    `;

    this.readerCanvas.appendChild(endCard);

    // Gắn sự kiện cho các nút trong endCard
    endCard.querySelector('#btn-end-prev-chap')?.addEventListener('click', () => this.prevChapter());
    endCard.querySelector('#btn-end-next-chap')?.addEventListener('click', () => this.nextChapter());
    endCard.querySelector('#btn-end-bookmark')?.addEventListener('click', () => {
      this.toggleBookmark();
      const bBtn = endCard.querySelector('#btn-end-bookmark');
      const bookmarkedNow = this.currentManga ? this.state.isBookmarked(this.currentManga.id) : false;
      if (bBtn) {
        bBtn.innerHTML = `<i class="${bookmarkedNow ? 'fas' : 'far'} fa-bookmark" style="${bookmarkedNow ? 'color: #818cf8;' : ''}"></i> <span>${bookmarkedNow ? 'Đã yêu thích' : 'Yêu thích truyện'}</span>`;
      }
    });
    endCard.querySelector('#btn-end-share-fb')?.addEventListener('click', () => this.shareOnFacebook());
    endCard.querySelector('#btn-end-back-manga')?.addEventListener('click', () => this.close());

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

    // Bao gồm tất cả các trang ảnh + trang Credit.webp ở cuối
    const displayPages = [...pages, '/Credit.webp'];

    this.canvasCurlEngine = new CanvasCurlEngine({
      viewport,
      canvas,
      pages: displayPages,
      initialPage: this.currentPageIndex || 0,
      onPageChange: (newPageIdx) => {
        this.currentPageIndex = newPageIdx;
        this.updateProgressUI();
      },
      onReachEnd: () => {
        this.nextChapter();
      },
      onReachStart: () => {
        this.prevChapter();
      }
    });

    this.updateProgressUI();
  }

  flipPage(direction: number): void {
    const totalPages = (this.currentChapter?.pages?.length || 0) + 1;
    if (totalPages === 0) return;

    if (this.canvasCurlEngine) {
      this.canvasCurlEngine.flip(direction);
    }
  }

  scrollToPage(pageIdx: number): void {
    const totalPages = (this.currentChapter?.pages?.length || 0) + 1;
    if (pageIdx < 0 || pageIdx >= totalPages) return;

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
      if ((!nextChap.pages || nextChap.pages.length === 0) && !nextChap.pdfUrl && !nextChap.isPdf && SheetDatabase) {
        SheetDatabase.fetchChapterPages(this.currentManga.id, nextChap.id).then(pages => {
          nextChap.pages = pages;
        });
      } else {
        const nextPages = nextChap.pages || [];
        nextPages.slice(0, 3).forEach(pageItem => {
          const fileId = DriveHelper.extractFileId(pageItem);
          if (fileId) {
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            DriveHelper.attachImageFallback(img, fileId);
          } else {
            try {
              const parsed = new URL(pageItem, window.location.href);
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
      opt.textContent = `Trang ${idx + 1} / ${pages.length + 1}`;
      this.readerPageSelect?.appendChild(opt);
    });

    // Thêm option cho trang Credit
    const creditOpt = document.createElement('option');
    creditOpt.value = String(pages.length);
    creditOpt.textContent = `Trang ${pages.length + 1} (Credit)`;
    this.readerPageSelect?.appendChild(creditOpt);

    this.readerPageSelect.value = String(this.currentPageIndex);
  }

  updateProgressUI(): void {
    const totalPages = (this.currentChapter?.pages?.length || 0) + 1;
    let percent = 0;

    if (this.readingMode.startsWith('horizontal')) {
      percent = Math.round(((this.currentPageIndex + 1) / totalPages) * 100);
    } else {
      if (this.readerMainArea) {
        const isMobileWebtoon = window.innerWidth <= 768 && document.body.classList.contains('is-webtoon-reading');
        const scrollTop = isMobileWebtoon
          ? (window.scrollY || document.documentElement.scrollTop || 0)
          : this.readerMainArea.scrollTop;
        const scrollHeight = isMobileWebtoon
          ? ((document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight)
          : (this.readerMainArea.scrollHeight - this.readerMainArea.clientHeight);
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
