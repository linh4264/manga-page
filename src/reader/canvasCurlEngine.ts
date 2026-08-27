/**
 * Canvas Curl Engine for DriveManga
 * Mô phỏng hiệu ứng bẻ cong và lật trang Manga/Comic 2D/3D trên HTML5 Canvas
 * Tối ưu hóa hiệu năng với requestAnimationFrame throttling và dọn dẹp bộ nhớ triệt để.
 */

import { DriveHelper } from '../driveHelper';

export interface CanvasCurlEngineOptions {
  viewport: HTMLElement;
  canvas: HTMLCanvasElement;
  pages: string[];
  initialPage?: number;
  onPageChange?: (newPageIndex: number) => void;
  onReachStart?: () => void;
  onReachEnd?: () => void;
}

export class CanvasCurlEngine {
  private viewport: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private pages: string[];
  private onPageChange?: (newPageIndex: number) => void;
  private onReachStart?: () => void;
  private onReachEnd?: () => void;

  private state = {
    currentPage: 0,
    targetPage: -1,
    isDragging: false,
    isAnimating: false,
    progress: 0,
    corner: { x: 0, y: 0 },
    finger: { x: 0, y: 0 },
    animFrame: null as number | null
  };

  private imageCache = new Map<number, HTMLImageElement>();
  private isDrawPending = false;
  private isDestroyed = false;

  private startPt = { x: 0, y: 0 };
  private startTime = 0;
  private isTouchActive = false;

  // Event handlers references for removal
  private handleResizeBound = () => this.resizeCanvas();
  private handleTouchStartBound = (e: any) => this.onPointerDown(e);
  private handleTouchMoveBound = (e: any) => this.onPointerMove(e);
  private handleTouchEndBound = () => this.onPointerUp();
  private handleMouseDownBound = (e: any) => this.onPointerDown(e);
  private handleMouseMoveBound = (e: any) => this.onPointerMove(e);
  private handleMouseUpBound = () => this.onPointerUp();

  constructor(options: CanvasCurlEngineOptions) {
    this.viewport = options.viewport;
    this.canvas = options.canvas;
    this.pages = options.pages;
    this.state.currentPage = Math.max(0, Math.min(this.pages.length - 1, options.initialPage || 0));
    this.onPageChange = options.onPageChange;
    this.onReachStart = options.onReachStart;
    this.onReachEnd = options.onReachEnd;
    this.ctx = this.canvas.getContext('2d');

    this.init();
  }

  private init(): void {
    if (!this.ctx) return;
    this.attachEventListeners();
    this.resizeCanvas();
    this.preload(this.state.currentPage);
    this.requestDraw();
  }

  private attachEventListeners(): void {
    window.addEventListener('resize', this.handleResizeBound);
    this.canvas.addEventListener('touchstart', this.handleTouchStartBound, { passive: true });
    window.addEventListener('touchmove', this.handleTouchMoveBound, { passive: false });
    window.addEventListener('touchend', this.handleTouchEndBound);
    window.addEventListener('touchcancel', this.handleTouchEndBound);

    this.canvas.addEventListener('mousedown', this.handleMouseDownBound);
    window.addEventListener('mousemove', this.handleMouseMoveBound);
    window.addEventListener('mouseup', this.handleMouseUpBound);
  }

  public getCurrentPage(): number {
    return this.state.currentPage;
  }

  public requestDraw(): void {
    if (this.isDrawPending || this.isDestroyed || !this.ctx) return;
    this.isDrawPending = true;
    requestAnimationFrame(() => {
      this.isDrawPending = false;
      this.draw();
    });
  }

  private loadImage(idx: number): HTMLImageElement | null {
    if (idx < 0 || idx >= this.pages.length) return null;
    if (this.imageCache.has(idx)) return this.imageCache.get(idx)!;

    const pageItem = this.pages[idx];
    const fileId = DriveHelper.extractFileId(pageItem);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => this.requestDraw());

    if (fileId) {
      DriveHelper.attachImageFallback(img, fileId);
    } else if (pageItem.startsWith('/') || pageItem.startsWith('data:') || pageItem.startsWith('blob:')) {
      img.src = pageItem;
    } else {
      try {
        const parsed = new URL(pageItem, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          img.src = parsed.href;
        }
      } catch {
        img.src = pageItem;
      }
    }

    this.imageCache.set(idx, img);
    return img;
  }

  public preload(currentIdx: number): void {
    [currentIdx - 1, currentIdx, currentIdx + 1, currentIdx + 2].forEach(i => {
      if (i >= 0 && i < this.pages.length) this.loadImage(i);
    });
  }

  private drawImageFit(img: HTMLImageElement | null, x: number, y: number, w: number, h: number): void {
    if (!this.ctx) return;
    if (!img || !img.complete || img.naturalWidth === 0) {
      this.ctx.fillStyle = '#0b0f19';
      this.ctx.fillRect(x, y, w, h);
      this.ctx.fillStyle = '#64748b';
      this.ctx.font = '15px "Plus Jakarta Sans", sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Đang tải trang...', x + w / 2, y + h / 2);
      return;
    }

    this.ctx.fillStyle = '#05070c';
    this.ctx.fillRect(x, y, w, h);

    const imgW = img.naturalWidth;
    const imgH = img.naturalHeight;
    const scale = Math.min(w / imgW, h / imgH);
    const dw = imgW * scale;
    const dh = imgH * scale;
    const dx = x + (w - dw) / 2;
    const dy = y + (h - dh) / 2;

    this.ctx.drawImage(img, dx, dy, dw, dh);
  }

  public draw(): void {
    if (!this.ctx || this.isDestroyed) return;
    const w = parseFloat(this.canvas.style.width) || this.canvas.width;
    const h = parseFloat(this.canvas.style.height) || this.canvas.height;

    this.ctx.clearRect(0, 0, w, h);
    const currentImg = this.loadImage(this.state.currentPage);

    if (this.state.progress <= 0.001 || (!this.state.isDragging && !this.state.isAnimating)) {
      this.drawImageFit(currentImg, 0, 0, w, h);
      return;
    }

    this.ctx.fillStyle = '#05070c';
    this.ctx.fillRect(0, 0, w, h);

    const targetImg = this.state.targetPage >= 0 ? this.loadImage(this.state.targetPage) : null;
    const cornerX = this.state.corner.x;
    const cornerY = this.state.corner.y;
    const fingerX = this.state.finger.x;
    const fingerY = this.state.finger.y;

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

    // 1. VẼ TRANG KẾ TIẾP (Underneath)
    if (targetImg) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.moveTo(p1X, p1Y);
      this.ctx.lineTo(p2X, p2Y);
      this.ctx.lineTo(p2X - cosN * extend, p2Y - sinN * extend);
      this.ctx.lineTo(p1X - cosN * extend, p1Y - sinN * extend);
      this.ctx.closePath();
      this.ctx.clip();

      this.drawImageFit(targetImg, 0, 0, w, h);

      const underShadow = this.ctx.createLinearGradient(midX, midY, midX - cosN * 45, midY - sinN * 45);
      underShadow.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
      underShadow.addColorStop(0.3, 'rgba(0, 0, 0, 0.3)');
      underShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      this.ctx.fillStyle = underShadow;
      this.ctx.fill();

      this.ctx.restore();
    }

    // 2. VẼ TRANG HIỆN TẠI (Current page)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(p1X, p1Y);
    this.ctx.lineTo(p2X, p2Y);
    this.ctx.lineTo(p2X + cosN * extend, p2Y + sinN * extend);
    this.ctx.lineTo(p1X + cosN * extend, p1Y + sinN * extend);
    this.ctx.closePath();
    this.ctx.clip();

    this.drawImageFit(currentImg, 0, 0, w, h);
    this.ctx.restore();

    // 3. VẼ VẠT GIẤY BẺ CONG LẬT NGƯỢC (Curled Page Flap)
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(p1X, p1Y);
    this.ctx.lineTo(p2X, p2Y);
    this.ctx.lineTo(p2X + cosN * extend, p2Y + sinN * extend);
    this.ctx.lineTo(p1X + cosN * extend, p1Y + sinN * extend);
    this.ctx.closePath();
    this.ctx.clip();

    this.ctx.translate(midX, midY);
    this.ctx.rotate(foldAngle);
    this.ctx.scale(1, -1);
    this.ctx.rotate(-foldAngle);
    this.ctx.translate(-midX, -midY);

    this.ctx.beginPath();
    this.ctx.rect(0, 0, w, h);
    this.ctx.clip();

    this.ctx.fillStyle = '#1c2230';
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.globalAlpha = 0.22;
    this.drawImageFit(currentImg, 0, 0, w, h);
    this.ctx.globalAlpha = 1.0;

    const curlGrad = this.ctx.createLinearGradient(midX, midY, midX + cosN * 60, midY + sinN * 60);
    curlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    curlGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.12)');
    curlGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.2)');
    curlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
    this.ctx.fillStyle = curlGrad;
    this.ctx.fillRect(0, 0, w, h);

    this.ctx.restore();
  }

  public resizeCanvas(): void {
    if (!this.ctx || this.isDestroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxW = this.viewport.clientWidth || window.innerWidth;
    const maxH = this.viewport.clientHeight || window.innerHeight;

    let renderH = Math.max(400, maxH - 12);
    let renderW = Math.round(renderH * 0.72);
    if (renderW > maxW - 12) {
      renderW = maxW - 12;
      renderH = Math.round(renderW / 0.72);
    }

    this.canvas.style.width = `${renderW}px`;
    this.canvas.style.height = `${renderH}px`;
    this.canvas.width = Math.round(renderW * dpr);
    this.canvas.height = Math.round(renderH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.requestDraw();
  }

  private animateTo(endX: number, endY: number, onComplete?: () => void): void {
    this.state.isAnimating = true;
    const startX = this.state.finger.x;
    const startY = this.state.finger.y;
    const startTime = performance.now();
    const duration = 250;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.state.finger.x = startX + (endX - startX) * ease;
      this.state.finger.y = startY + (endY - startY) * ease;
      this.draw();

      if (t < 1) {
        this.state.animFrame = requestAnimationFrame(step);
      } else {
        this.state.isAnimating = false;
        if (onComplete) onComplete();
      }
    };
    if (this.state.animFrame) cancelAnimationFrame(this.state.animFrame);
    this.state.animFrame = requestAnimationFrame(step);
  }

  private getCanvasPoint(e: any): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(rect.width, clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, clientY - rect.top))
    };
  }

  private onPointerDown(e: any): void {
    if (this.state.isAnimating) return;
    this.startPt = this.getCanvasPoint(e);
    this.startTime = performance.now();
    this.isTouchActive = true;
    this.state.isDragging = false;
    this.state.progress = 0;
    this.state.targetPage = -1;
  }

  private onPointerMove(e: any): void {
    if (!this.isTouchActive || this.state.isAnimating) return;
    const pt = this.getCanvasPoint(e);
    const w = parseFloat(this.canvas.style.width) || this.canvas.width;
    const h = parseFloat(this.canvas.style.height) || this.canvas.height;
    const dist = Math.hypot(pt.x - this.startPt.x, pt.y - this.startPt.y);

    if (!this.state.isDragging && dist > 5) {
      if (this.startPt.x < w * 0.5) {
        if (this.state.currentPage >= this.pages.length - 1) {
          if (this.onReachEnd) this.onReachEnd();
          return;
        }
        this.state.targetPage = this.state.currentPage + 1;
        this.state.corner = { x: 0, y: this.startPt.y < h * 0.5 ? 0 : h };
      } else {
        if (this.state.currentPage <= 0) {
          if (this.onReachStart) this.onReachStart();
          return;
        }
        this.state.targetPage = this.state.currentPage - 1;
        this.state.corner = { x: w, y: this.startPt.y < h * 0.5 ? 0 : h };
      }
      this.state.isDragging = true;
      this.viewport.classList.add('is-dragging');
    }

    if (this.state.isDragging) {
      if (e.cancelable) e.preventDefault();
      this.state.finger = { ...pt };
      this.state.progress = Math.min(1, Math.max(0.01, Math.abs(this.state.finger.x - this.state.corner.x) / (w * 0.95)));
      this.requestDraw();
    }
  }

  private onPointerUp(): void {
    if (!this.isTouchActive || this.state.isAnimating) return;
    this.isTouchActive = false;
    this.viewport.classList.remove('is-dragging');
    const w = parseFloat(this.canvas.style.width) || this.canvas.width;

    if (!this.state.isDragging) {
      this.state.progress = 0;
      this.state.targetPage = -1;
      this.requestDraw();
      return;
    }

    this.state.isDragging = false;
    const dist = Math.abs(this.state.finger.x - this.state.corner.x);
    const elapsed = performance.now() - this.startTime;
    const velocity = dist / (elapsed || 1);
    const shouldFlip = dist > w * 0.26 || (velocity > 0.35 && dist > 20);

    if (shouldFlip) {
      const targetX = this.state.corner.x === 0 ? w * 1.35 : -w * 0.35;
      const targetY = this.state.corner.y;

      this.animateTo(targetX, targetY, () => {
        this.state.currentPage = this.state.targetPage;
        this.state.progress = 0;
        this.state.targetPage = -1;
        this.preload(this.state.currentPage);
        this.requestDraw();
        if (this.onPageChange) this.onPageChange(this.state.currentPage);
      });
    } else {
      this.animateTo(this.state.corner.x, this.state.corner.y, () => {
        this.state.progress = 0;
        this.state.targetPage = -1;
        this.requestDraw();
      });
    }
  }

  public flip(direction: number): void {
    if (this.state.isAnimating) return;
    const w = parseFloat(this.canvas.style.width) || this.canvas.width;
    const h = parseFloat(this.canvas.style.height) || this.canvas.height;
    const targetIndex = this.state.currentPage + direction;

    if (targetIndex < 0) {
      if (this.onReachStart) this.onReachStart();
      return;
    }
    if (targetIndex >= this.pages.length) {
      if (this.onReachEnd) this.onReachEnd();
      return;
    }

    this.state.targetPage = targetIndex;
    this.state.corner = direction > 0 ? { x: 0, y: h } : { x: w, y: h };
    this.state.finger = { ...this.state.corner };
    this.state.progress = 0.05;

    const targetX = this.state.corner.x === 0 ? w * 1.35 : -w * 0.35;
    this.animateTo(targetX, this.state.corner.y, () => {
      this.state.currentPage = targetIndex;
      this.state.progress = 0;
      this.state.targetPage = -1;
      this.preload(this.state.currentPage);
      this.requestDraw();
      if (this.onPageChange) this.onPageChange(this.state.currentPage);
    });
  }

  public turnToPage(pageIdx: number): void {
    if (pageIdx >= 0 && pageIdx < this.pages.length) {
      this.state.currentPage = pageIdx;
      this.state.progress = 0;
      this.state.targetPage = -1;
      this.preload(pageIdx);
      this.requestDraw();
      if (this.onPageChange) this.onPageChange(pageIdx);
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    window.removeEventListener('resize', this.handleResizeBound);
    this.canvas.removeEventListener('touchstart', this.handleTouchStartBound);
    window.removeEventListener('touchmove', this.handleTouchMoveBound);
    window.removeEventListener('touchend', this.handleTouchEndBound);
    window.removeEventListener('touchcancel', this.handleTouchEndBound);
    this.canvas.removeEventListener('mousedown', this.handleMouseDownBound);
    window.removeEventListener('mousemove', this.handleMouseMoveBound);
    window.removeEventListener('mouseup', this.handleMouseUpBound);

    if (this.state.animFrame) {
      cancelAnimationFrame(this.state.animFrame);
      this.state.animFrame = null;
    }
    this.isDrawPending = false;
    this.imageCache.clear();
  }
}
