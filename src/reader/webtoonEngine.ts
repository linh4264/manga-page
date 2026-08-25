/**
 * Webtoon Continuous Vertical Scroll Engine for DriveManga
 * Quản lý cuộn dọc mượt mà, IntersectionObserver tải lười (lazy loading) và Auto-Scroll.
 */

import { DriveHelper } from '../driveHelper';

export interface WebtoonEngineOptions {
  container: HTMLElement;
  scrollArea: HTMLElement;
  pages: string[];
  initialPage?: number;
  zoomLevel?: 'default' | 'wide' | 'full';
  onPageVisible?: (pageIndex: number) => void;
}

export class WebtoonEngine {
  private container: HTMLElement;
  private scrollArea: HTMLElement;
  private pages: string[];
  private onPageVisible?: (pageIndex: number) => void;
  private observer: IntersectionObserver | null = null;
  private autoScrollTimer: any = null;
  private autoScrollSpeed = 2; // px per tick
  private autoScrollActive = false;

  constructor(options: WebtoonEngineOptions) {
    this.container = options.container;
    this.scrollArea = options.scrollArea;
    this.pages = options.pages;
    this.onPageVisible = options.onPageVisible;

    this.init();
  }

  private init(): void {
    this.renderPages();
    this.setupIntersectionObserver();
  }

  private renderPages(): void {
    this.container.innerHTML = '';
    this.container.className = 'reader-canvas is-webtoon-mode';
    this.scrollArea.style.overflow = 'auto';

    this.pages.forEach((pageItem, index) => {
      const pageDiv = document.createElement('div');
      pageDiv.className = 'webtoon-page-container';
      pageDiv.dataset.pageIndex = String(index);

      const img = document.createElement('img');
      img.className = 'webtoon-page-img';
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
      this.container.appendChild(pageDiv);
    });
  }

  private setupIntersectionObserver(): void {
    if (typeof IntersectionObserver === 'undefined') return;

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt((entry.target as HTMLElement).dataset.pageIndex || '0', 10);
          if (this.onPageVisible) {
            this.onPageVisible(idx);
          }
        }
      });
    }, {
      root: this.scrollArea,
      threshold: 0.3
    });

    this.container.querySelectorAll('.webtoon-page-container').forEach(el => {
      this.observer?.observe(el);
    });
  }

  public scrollToPage(pageIndex: number): void {
    const targetEl = this.container.querySelector(`[data-page-index="${pageIndex}"]`) as HTMLElement | null;
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  public startAutoScroll(speed = 2): void {
    this.stopAutoScroll();
    this.autoScrollSpeed = Math.max(1, Math.min(10, speed));
    this.autoScrollActive = true;

    this.autoScrollTimer = setInterval(() => {
      if (this.scrollArea) {
        this.scrollArea.scrollTop += this.autoScrollSpeed;
        if (this.scrollArea.scrollTop + this.scrollArea.clientHeight >= this.scrollArea.scrollHeight - 5) {
          this.stopAutoScroll();
        }
      }
    }, 16);
  }

  public stopAutoScroll(): void {
    if (this.autoScrollTimer) {
      clearInterval(this.autoScrollTimer);
      this.autoScrollTimer = null;
    }
    this.autoScrollActive = false;
  }

  public toggleAutoScroll(speed = 2): boolean {
    if (this.autoScrollActive) {
      this.stopAutoScroll();
      return false;
    } else {
      this.startAutoScroll(speed);
      return true;
    }
  }

  public isAutoScrolling(): boolean {
    return this.autoScrollActive;
  }

  public destroy(): void {
    this.stopAutoScroll();
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }
}
