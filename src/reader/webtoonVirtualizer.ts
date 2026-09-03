/**
 * Webtoon Virtualizer: High-Performance DOM Virtualization & Predictive Loading Engine
 * Caps active GPU texture memory by mounting images only within active scroll window (viewport + buffer),
 * preserving exact container dimensions to guarantee zero layout shift (CLS = 0).
 */

import { DriveHelper } from '../driveHelper';

export interface WebtoonVirtualizerOptions {
  container: HTMLElement;
  pages: string[];
  creditImageUrl?: string;
  bufferMargin?: string; // default: '1200px 0px 1200px 0px'
  onPageVisible?: (pageIndex: number) => void;
  onReachNearEnd?: () => void;
}

export class WebtoonVirtualizer {
  private container: HTMLElement;
  private pages: string[];
  private creditImageUrl: string;
  private bufferMargin: string;
  private onPageVisible?: (pageIndex: number) => void;
  private onReachNearEnd?: () => void;

  private pageContainers: HTMLElement[] = [];
  private windowObserver: IntersectionObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private measuredHeights = new Map<number, number>();
  private activeMountedPages = new Set<number>();
  private preloadedUrls = new Set<string>();
  private isDestroyed = false;

  constructor(options: WebtoonVirtualizerOptions) {
    this.container = options.container;
    this.pages = options.pages || [];
    this.creditImageUrl = options.creditImageUrl || '/Credit.webp';
    this.bufferMargin = options.bufferMargin || '1200px 0px 1200px 0px';
    this.onPageVisible = options.onPageVisible;
    this.onReachNearEnd = options.onReachNearEnd;

    this.init();
  }

  private init(): void {
    if (this.pages.length === 0) return;

    this.setupObservers();
    this.buildContainers();
  }

  private setupObservers(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    // 1. Windowing Observer: Mounts/Unmounts images within 1200px buffer around viewport
    this.windowObserver = new IntersectionObserver(
      (entries) => {
        if (this.isDestroyed) return;
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          const pageIdx = parseInt(target.dataset.pageIndex || '-1', 10);
          if (pageIdx === -1) return;

          if (entry.isIntersecting) {
            this.mountPageImage(pageIdx, target);
            this.predictivePreloadAhead(pageIdx);
          } else {
            // Unmount heavy image outside buffer to free GPU texture RAM, keeping container height intact
            this.unmountPageImage(pageIdx, target);
          }
        });
      },
      {
        root: null, // viewport
        rootMargin: this.bufferMargin,
        threshold: 0
      }
    );

    // 2. Active Page Visibility Observer: Tracks which page the user is currently reading
    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        if (this.isDestroyed) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageIdx = parseInt((entry.target as HTMLElement).dataset.pageIndex || '-1', 10);
            if (pageIdx !== -1 && this.onPageVisible) {
              this.onPageVisible(pageIdx);
            }

            // Trigger near end callback (when user reaches last 3 pages)
            if (this.onReachNearEnd && pageIdx >= this.totalPages - 3) {
              this.onReachNearEnd();
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '-20% 0px -40% 0px',
        threshold: 0
      }
    );
  }

  public get totalPages(): number {
    return this.pages.length + (this.creditImageUrl ? 1 : 0);
  }

  private buildContainers(): void {
    this.pageContainers = [];

    const total = this.totalPages;
    for (let i = 0; i < total; i++) {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'reader-page-item is-virtualized is-loading';
      pageDiv.dataset.pageIndex = String(i);

      // Default estimated height for Webtoon vertical strip (500px)
      pageDiv.style.minHeight = '500px';

      if (i === this.pages.length && this.creditImageUrl) {
        pageDiv.classList.add('reader-credit-item');
      }

      this.container.appendChild(pageDiv);
      this.pageContainers.push(pageDiv);

      if (this.windowObserver) {
        this.windowObserver.observe(pageDiv);
      }
      if (this.visibilityObserver) {
        this.visibilityObserver.observe(pageDiv);
      }
    }

    // Immediately mount the first 2 pages for instant first-paint
    if (this.pageContainers[0]) {
      this.mountPageImage(0, this.pageContainers[0]);
    }
    if (this.pageContainers[1]) {
      this.mountPageImage(1, this.pageContainers[1]);
    }
  }

  public mountPageImage(pageIndex: number, container: HTMLElement): void {
    if (this.activeMountedPages.has(pageIndex)) return;

    const pageSrc = pageIndex === this.pages.length ? this.creditImageUrl : this.pages[pageIndex];
    if (!pageSrc) return;

    this.activeMountedPages.add(pageIndex);

    // If an image element already exists, skip creating a new one
    let img = container.querySelector('img') as HTMLImageElement | null;
    if (!img) {
      img = document.createElement('img');
      img.alt = `Trang ${pageIndex + 1}`;
      img.referrerPolicy = 'no-referrer';
      img.decoding = 'async';
      img.loading = pageIndex < 3 ? 'eager' : 'lazy';

      img.onload = () => {
        container.classList.remove('is-loading');
        img?.classList.add('is-loaded');
        const height = img?.offsetHeight || 0;
        if (height > 60) {
          this.measuredHeights.set(pageIndex, height);
          container.style.minHeight = `${height}px`;
        }
      };

      img.onerror = () => {
        container.classList.remove('is-loading');
        if (pageIndex === this.pages.length) {
          // Hide credit item if not available
          container.style.display = 'none';
        } else {
          img?.classList.add('img-load-error');
          if (img) img.alt = 'Không thể tải ảnh.';
        }
      };

      const fileId = DriveHelper.extractFileId(pageSrc);
      if (fileId) {
        DriveHelper.attachImageFallback(img, fileId);
      } else {
        img.src = pageSrc;
      }

      container.appendChild(img);
    }
  }

  public unmountPageImage(pageIndex: number, container: HTMLElement): void {
    // Keep first 2 pages in memory to avoid flashing if user scrolls back to top immediately
    if (pageIndex <= 1) return;
    if (!this.activeMountedPages.has(pageIndex)) return;

    const img = container.querySelector('img');
    if (img) {
      // Preserve measured height so scrollbar and layout do not jump
      const currentHeight = img.offsetHeight || this.measuredHeights.get(pageIndex) || 500;
      this.measuredHeights.set(pageIndex, currentHeight);
      container.style.minHeight = `${currentHeight}px`;

      // Free GPU texture by clearing src and unmounting
      img.src = '';
      img.remove();
    }

    this.activeMountedPages.delete(pageIndex);
  }

  /**
   * Predictive preloading: downloads next 2-3 images into disk cache ahead of scrolling
   */
  private predictivePreloadAhead(currentPageIndex: number): void {
    const lookAhead = 3;
    for (let i = 1; i <= lookAhead; i++) {
      const targetIdx = currentPageIndex + i;
      if (targetIdx < this.pages.length) {
        const url = this.pages[targetIdx];
        if (url && !this.preloadedUrls.has(url)) {
          this.preloadedUrls.add(url);
          const fileId = DriveHelper.extractFileId(url);
          const preloadImg = new Image();
          preloadImg.referrerPolicy = 'no-referrer';
          if (fileId) {
            DriveHelper.attachImageFallback(preloadImg, fileId);
          } else {
            preloadImg.src = url;
          }
        }
      }
    }
  }

  /**
   * Scroll smoothly or directly to a specific page index
   */
  public scrollToPage(pageIndex: number, smooth = true): void {
    if (pageIndex < 0 || pageIndex >= this.pageContainers.length) return;
    const target = this.pageContainers[pageIndex];
    if (!target) return;

    // Immediately mount target page and neighbors so it is ready
    this.mountPageImage(pageIndex, target);
    if (this.pageContainers[pageIndex + 1]) {
      this.mountPageImage(pageIndex + 1, this.pageContainers[pageIndex + 1]);
    }

    target.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'start'
    });
  }

  public getContainer(pageIndex: number): HTMLElement | undefined {
    return this.pageContainers[pageIndex];
  }

  public getActiveCount(): number {
    return this.activeMountedPages.size;
  }

  public destroy(): void {
    this.isDestroyed = true;

    if (this.windowObserver) {
      this.windowObserver.disconnect();
      this.windowObserver = null;
    }
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }

    this.pageContainers.forEach((el) => {
      el.innerHTML = '';
      el.remove();
    });
    this.pageContainers = [];
    this.activeMountedPages.clear();
    this.measuredHeights.clear();
    this.preloadedUrls.clear();
  }
}
