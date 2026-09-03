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
  isDualPage?: boolean;
  onPageChange?: (newPageIndex: number) => void;
  onReachStart?: () => void;
  onReachEnd?: () => void;
}

export class CanvasCurlEngine {
  private viewport: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private pages: string[];
  private isDualPage = false;
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
    this.isDualPage = Boolean(options.isDualPage);
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
    const range = this.isDualPage ? [-2, -1, 0, 1, 2, 3, 4] : [-1, 0, 1, 2];
    range.forEach(offset => {
      const i = currentIdx + offset;
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
    const isDouble = this.isDualPage && w >= 700;

    this.ctx.clearRect(0, 0, w, h);

    // Chế độ 2 Trang: Sử dụng bộ vẽ lật sách Manga 3D chuyên biệt
    if (isDouble) {
      this.drawDualPage(w, h);
      return;
    }

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

  /**
   * Bộ vẽ Manga 2 Trang 3D: Lật tờ giấy qua gáy sách theo đúng chuẩn Manga Nhật Bản (RTL)
   */
  private drawDualPage(w: number, h: number): void {
    if (!this.ctx) return;
    const halfW = w / 2;
    const curP = this.state.currentPage;
    const tarP = this.state.targetPage;
    const isFlipping = (this.state.isDragging || this.state.isAnimating) && this.state.progress > 0.001;

    // Nền tối chuẩn Studio
    this.ctx.fillStyle = '#05070c';
    this.ctx.fillRect(0, 0, w, h);

    if (!isFlipping || tarP < 0 || tarP === curP) {
      // 1. TRẠNG THÁI TĨNH: Vẽ 2 trang mở phẳng trên bàn
      const leftImg = curP + 1 < this.pages.length ? this.loadImage(curP + 1) : null;
      const rightImg = this.loadImage(curP);

      this.drawImageFit(leftImg, 0, 0, halfW, h);
      this.drawImageFit(rightImg, halfW, 0, halfW, h);
      this.drawSpineShadow(halfW, h);
      return;
    }

    // 2. TRẠNG THÁI ĐANG LẬT TRANG (Duyệt theo tiến độ progress 0 -> 1)
    const progress = Math.max(0.001, Math.min(0.999, this.state.progress));

    if (tarP > curP) {
      // LẬT TIẾP (Next - Manga RTL: Lật tờ giấy bên phải qua bên trái)
      // Nền bên trái: Trang tĩnh hiện tại (curP + 1)
      const staticLeftImg = curP + 1 < this.pages.length ? this.loadImage(curP + 1) : null;
      this.drawImageFit(staticLeftImg, 0, 0, halfW, h);

      // Nền bên phải: Trang mới bên dưới sẽ lộ ra (tarP)
      const newRightImg = this.loadImage(tarP);
      this.drawImageFit(newRightImg, halfW, 0, halfW, h);

      // Tờ giấy lật (Leaf): Lật từ mép phải (w) qua gáy (halfW) sang trái (0)
      if (progress <= 0.5) {
        // Nửa đầu: Tờ giấy bên phải co lại về phía gáy sách
        const t = progress * 2; // 0 -> 1
        const leafWidth = Math.max(1, halfW * (1 - t));

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(halfW, 0, leafWidth, h);
        this.ctx.clip();

        const frontImg = this.loadImage(curP);
        this.drawImageFit(frontImg, halfW, 0, halfW, h);

        // Ánh sáng uốn cong hình trụ của trang giấy
        const curlGrad = this.ctx.createLinearGradient(halfW, 0, halfW + leafWidth, 0);
        curlGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        curlGrad.addColorStop(0.25, 'rgba(0, 0, 0, 0.05)');
        curlGrad.addColorStop(0.85, 'rgba(255, 255, 255, 0.22)');
        curlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
        this.ctx.fillStyle = curlGrad;
        this.ctx.fillRect(halfW, 0, leafWidth, h);
        this.ctx.restore();

        // Đổ bóng của mép giấy rơi xuống trang mới bên phải
        const shadowW = Math.min(50, leafWidth * 0.7);
        const shadowGrad = this.ctx.createLinearGradient(halfW + leafWidth, 0, halfW + leafWidth + shadowW, 0);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fillRect(halfW + leafWidth, 0, shadowW, h);

      } else {
        // Nửa sau: Tờ giấy vượt qua gáy sách và mở rộng dần sang bên trái
        const t = (progress - 0.5) * 2; // 0 -> 1
        const leafWidth = Math.max(1, halfW * t);
        const leafLeft = halfW - leafWidth;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(leafLeft, 0, leafWidth, h);
        this.ctx.clip();

        // Mặt sau của tờ giấy (hiển thị trang mới bên trái: tarP + 1)
        const backImg = tarP + 1 < this.pages.length ? this.loadImage(tarP + 1) : null;
        if (backImg) {
          this.drawImageFit(backImg, 0, 0, halfW, h);
        } else {
          this.ctx.fillStyle = '#0f172a';
          this.ctx.fillRect(leafLeft, 0, leafWidth, h);
        }

        // Ánh sáng uốn cong khi tờ giấy tiếp đất bên trái
        const curlGrad = this.ctx.createLinearGradient(leafLeft, 0, halfW, 0);
        curlGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        curlGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.22)');
        curlGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
        curlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        this.ctx.fillStyle = curlGrad;
        this.ctx.fillRect(leafLeft, 0, leafWidth, h);
        this.ctx.restore();

        // Đổ bóng của mép giấy rơi xuống trang cũ bên trái
        const shadowW = Math.min(50, leafWidth * 0.7);
        const shadowGrad = this.ctx.createLinearGradient(leafLeft, 0, leafLeft - shadowW, 0);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fillRect(leafLeft - shadowW, 0, shadowW, h);
      }

    } else {
      // LẬT LÙI (Prev - Manga RTL: Lật tờ giấy bên trái qua bên phải)
      const staticRightImg = this.loadImage(curP);
      this.drawImageFit(staticRightImg, halfW, 0, halfW, h);

      const newLeftImg = tarP + 1 < this.pages.length ? this.loadImage(tarP + 1) : null;
      this.drawImageFit(newLeftImg, 0, 0, halfW, h);

      if (progress <= 0.5) {
        const t = progress * 2;
        const leafWidth = Math.max(1, halfW * (1 - t));
        const leafLeft = halfW - leafWidth;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(leafLeft, 0, leafWidth, h);
        this.ctx.clip();

        const frontImg = curP + 1 < this.pages.length ? this.loadImage(curP + 1) : null;
        this.drawImageFit(frontImg, 0, 0, halfW, h);

        const curlGrad = this.ctx.createLinearGradient(leafLeft, 0, halfW, 0);
        curlGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
        curlGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');
        curlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        this.ctx.fillStyle = curlGrad;
        this.ctx.fillRect(leafLeft, 0, leafWidth, h);
        this.ctx.restore();

        const shadowW = Math.min(50, leafWidth * 0.7);
        const shadowGrad = this.ctx.createLinearGradient(leafLeft, 0, leafLeft - shadowW, 0);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fillRect(leafLeft - shadowW, 0, shadowW, h);

      } else {
        const t = (progress - 0.5) * 2;
        const leafWidth = Math.max(1, halfW * t);

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(halfW, 0, leafWidth, h);
        this.ctx.clip();

        const backImg = this.loadImage(tarP);
        this.drawImageFit(backImg, halfW, 0, halfW, h);

        const curlGrad = this.ctx.createLinearGradient(halfW, 0, halfW + leafWidth, 0);
        curlGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        curlGrad.addColorStop(0.2, 'rgba(255, 255, 255, 0.22)');
        curlGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
        curlGrad.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
        this.ctx.fillStyle = curlGrad;
        this.ctx.fillRect(halfW, 0, leafWidth, h);
        this.ctx.restore();

        const shadowW = Math.min(50, leafWidth * 0.7);
        const shadowGrad = this.ctx.createLinearGradient(halfW + leafWidth, 0, halfW + leafWidth + shadowW, 0);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fillRect(halfW + leafWidth, 0, shadowW, h);
      }
    }

    // Đổ bóng rãnh gáy sách 3D ở chính giữa
    this.drawSpineShadow(halfW, h);
  }

  private drawSpineShadow(halfW: number, h: number): void {
    if (!this.ctx) return;
    const spineShadow = this.ctx.createLinearGradient(halfW - 24, 0, halfW + 24, 0);
    spineShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
    spineShadow.addColorStop(0.42, 'rgba(0, 0, 0, 0.45)');
    spineShadow.addColorStop(0.5, 'rgba(0, 0, 0, 0.7)');
    spineShadow.addColorStop(0.58, 'rgba(0, 0, 0, 0.45)');
    spineShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.fillStyle = spineShadow;
    this.ctx.fillRect(halfW - 24, 0, 48, h);
  }

  public resizeCanvas(): void {
    if (!this.ctx || this.isDestroyed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxW = this.viewport.clientWidth || window.innerWidth;
    const maxH = this.viewport.clientHeight || window.innerHeight;

    const isDouble = this.isDualPage && maxW >= 768;
    const targetRatio = isDouble ? 1.44 : 0.72;

    let renderH = Math.max(400, maxH - 12);
    let renderW = Math.round(renderH * targetRatio);
    if (renderW > maxW - 12) {
      renderW = maxW - 12;
      renderH = Math.round(renderW / targetRatio);
    }

    this.canvas.style.width = `${renderW}px`;
    this.canvas.style.height = `${renderH}px`;
    this.canvas.width = Math.round(renderW * dpr);
    this.canvas.height = Math.round(renderH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.requestDraw();
  }

  private animateProgress(from: number, to: number, duration: number, onComplete?: () => void): void {
    this.state.isAnimating = true;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // Cubic easing siêu mượt
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.state.progress = from + (to - from) * ease;
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

    const isDouble = this.isDualPage && w >= 700;
    const step = isDouble ? 2 : 1;

    if (!this.state.isDragging && dist > 6) {
      if (isDouble) {
        // Trong Manga RTL: Kéo từ nửa phải sang trái = Lật tiếp (Next); Kéo từ nửa trái sang phải = Lật lùi (Prev)
        if (this.startPt.x > w * 0.5) {
          if (this.state.currentPage >= this.pages.length - 1) {
            if (this.onReachEnd) this.onReachEnd();
            return;
          }
          this.state.targetPage = Math.min(this.pages.length - 1, this.state.currentPage + step);
        } else {
          if (this.state.currentPage <= 0) {
            if (this.onReachStart) this.onReachStart();
            return;
          }
          this.state.targetPage = Math.max(0, this.state.currentPage - step);
        }
      } else {
        if (this.startPt.x < w * 0.5) {
          if (this.state.currentPage >= this.pages.length - 1) {
            if (this.onReachEnd) this.onReachEnd();
            return;
          }
          this.state.targetPage = Math.min(this.pages.length - 1, this.state.currentPage + step);
          this.state.corner = { x: 0, y: this.startPt.y < h * 0.5 ? 0 : h };
        } else {
          if (this.state.currentPage <= 0) {
            if (this.onReachStart) this.onReachStart();
            return;
          }
          this.state.targetPage = Math.max(0, this.state.currentPage - step);
          this.state.corner = { x: w, y: this.startPt.y < h * 0.5 ? 0 : h };
        }
      }
      this.state.isDragging = true;
      this.viewport.classList.add('is-dragging');
    }

    if (this.state.isDragging) {
      if (e.cancelable) e.preventDefault();
      this.state.finger = { ...pt };

      if (isDouble) {
        const halfW = w / 2;
        if (this.state.targetPage > this.state.currentPage) {
          const dragged = Math.max(0, this.startPt.x - pt.x);
          this.state.progress = Math.min(1, Math.max(0.01, dragged / (halfW * 0.95)));
        } else {
          const dragged = Math.max(0, pt.x - this.startPt.x);
          this.state.progress = Math.min(1, Math.max(0.01, dragged / (halfW * 0.95)));
        }
      } else {
        this.state.progress = Math.min(1, Math.max(0.01, Math.abs(this.state.finger.x - this.state.corner.x) / (w * 0.95)));
      }
      this.requestDraw();
    }
  }

  private onPointerUp(): void {
    if (!this.isTouchActive || this.state.isAnimating) return;
    this.isTouchActive = false;
    this.viewport.classList.remove('is-dragging');
    const w = parseFloat(this.canvas.style.width) || this.canvas.width;
    const isDouble = this.isDualPage && w >= 700;

    if (!this.state.isDragging) {
      this.state.progress = 0;
      this.state.targetPage = -1;
      this.requestDraw();
      return;
    }

    this.state.isDragging = false;
    const elapsed = performance.now() - this.startTime;

    if (isDouble) {
      const dist = Math.abs(this.state.finger.x - this.startPt.x);
      const velocity = dist / (elapsed || 1);
      const shouldFlip = this.state.progress > 0.22 || (velocity > 0.3 && this.state.progress > 0.06);

      if (shouldFlip) {
        this.animateProgress(this.state.progress, 1, 240, () => {
          this.state.currentPage = this.state.targetPage;
          this.state.progress = 0;
          this.state.targetPage = -1;
          this.preload(this.state.currentPage);
          this.requestDraw();
          if (this.onPageChange) this.onPageChange(this.state.currentPage);
        });
      } else {
        this.animateProgress(this.state.progress, 0, 180, () => {
          this.state.progress = 0;
          this.state.targetPage = -1;
          this.requestDraw();
        });
      }
      return;
    }

    const dist = Math.abs(this.state.finger.x - this.state.corner.x);
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
    const isDouble = this.isDualPage && w >= 700;
    const step = isDouble ? 2 : 1;
    const targetIndex = this.state.currentPage + (direction * step);

    if (direction < 0 && this.state.currentPage <= 0) {
      if (this.onReachStart) this.onReachStart();
      return;
    }
    if (direction > 0 && this.state.currentPage >= this.pages.length - 1) {
      if (this.onReachEnd) this.onReachEnd();
      return;
    }

    const clampedTarget = Math.max(0, Math.min(this.pages.length - 1, targetIndex));

    if (isDouble) {
      this.state.progress = 0.01;
      this.animateProgress(0, 1, 320, () => {
        this.state.currentPage = clampedTarget;
        this.state.progress = 0;
        this.state.targetPage = -1;
        this.preload(this.state.currentPage);
        this.requestDraw();
        if (this.onPageChange) this.onPageChange(this.state.currentPage);
      });
      return;
    }

    this.state.corner = direction > 0 ? { x: 0, y: h } : { x: w, y: h };
    this.state.finger = { ...this.state.corner };
    this.state.progress = 0.05;

    const targetX = this.state.corner.x === 0 ? w * 1.35 : -w * 0.35;
    this.animateTo(targetX, this.state.corner.y, () => {
      this.state.currentPage = clampedTarget;
      this.state.progress = 0;
      this.state.targetPage = -1;
      this.preload(this.state.currentPage);
      this.requestDraw();
      if (this.onPageChange) this.onPageChange(this.state.currentPage);
    });
  }

  public isDual(): boolean {
    const w = parseFloat(this.canvas.style.width) || this.canvas.width;
    return this.isDualPage && w >= 700;
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
