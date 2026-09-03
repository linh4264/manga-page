/**
 * Pinch-to-Zoom & Multi-Touch Gesture Handler for DriveManga
 * Supports 2-finger pinch zooming (1.0x to 3.5x), 1-finger panning when zoomed,
 * and double-tap to quick zoom (2.2x) or reset (1.0x) on mobile devices.
 * 100% Zero-Cost Client-side Vanilla TypeScript.
 */

export interface PinchZoomOptions {
  container: HTMLElement;
  minScale?: number;
  maxScale?: number;
  onScaleChange?: (scale: number) => void;
}

export class PinchZoomHandler {
  private container: HTMLElement;
  private minScale: number;
  private maxScale: number;
  private onScaleChange?: (scale: number) => void;

  private scale = 1.0;
  private pan = { x: 0, y: 0 };
  private initialTouchDistance = 0;
  private initialScale = 1.0;
  private touchStartPos = { x: 0, y: 0 };
  private panStart = { x: 0, y: 0 };
  private isMultiTouch = false;
  private isPanning = false;

  private lastTapTime = 0;
  private lastTapPos = { x: 0, y: 0 };
  private isDestroyed = false;

  // Bound event listeners
  private handleTouchStartBound = (e: TouchEvent) => this.onTouchStart(e);
  private handleTouchMoveBound = (e: TouchEvent) => this.onTouchMove(e);
  private handleTouchEndBound = (e: TouchEvent) => this.onTouchEnd(e);

  constructor(options: PinchZoomOptions) {
    this.container = options.container;
    this.minScale = options.minScale || 1.0;
    this.maxScale = options.maxScale || 3.5;
    this.onScaleChange = options.onScaleChange;

    this.init();
  }

  private init(): void {
    if (typeof window === 'undefined' || !this.container) return;

    this.container.style.touchAction = 'none'; // Prevent browser native zoom fighting
    this.container.style.transformOrigin = 'center center';
    this.container.style.willChange = 'transform';

    this.container.addEventListener('touchstart', this.handleTouchStartBound, { passive: false });
    window.addEventListener('touchmove', this.handleTouchMoveBound, { passive: false });
    window.addEventListener('touchend', this.handleTouchEndBound, { passive: true });
    window.addEventListener('touchcancel', this.handleTouchEndBound, { passive: true });
  }

  public getScale(): number {
    return this.scale;
  }

  public isZoomed(): boolean {
    return this.scale > 1.05;
  }

  private getDistance(t1: Touch, t2: Touch): number {
    return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
  }

  private getCenter(t1: Touch, t2: Touch): { x: number; y: number } {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2
    };
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.isDestroyed) return;

    // 1. Two-finger Pinch gesture start
    if (e.touches.length === 2) {
      e.preventDefault();
      this.isMultiTouch = true;
      this.isPanning = false;
      this.initialTouchDistance = this.getDistance(e.touches[0], e.touches[1]);
      this.initialScale = this.scale;
      this.container.style.transition = 'none';
      return;
    }

    // 2. Single-finger touch handling
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();
      const tapDist = Math.hypot(touch.clientX - this.lastTapPos.x, touch.clientY - this.lastTapPos.y);

      // Double-Tap detection (tap within 300ms and within 30px radius)
      if (now - this.lastTapTime < 300 && tapDist < 30) {
        e.preventDefault();
        this.handleDoubleTap(touch.clientX, touch.clientY);
        this.lastTapTime = 0;
        return;
      }

      this.lastTapTime = now;
      this.lastTapPos = { x: touch.clientX, y: touch.clientY };

      // If already zoomed in, enable 1-finger dragging / panning around the image
      if (this.isZoomed()) {
        this.isPanning = true;
        this.touchStartPos = { x: touch.clientX, y: touch.clientY };
        this.panStart = { ...this.pan };
        this.container.style.transition = 'none';
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.isDestroyed) return;

    // Handle 2-finger pinching
    if (this.isMultiTouch && e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
      if (this.initialTouchDistance > 0) {
        const factor = currentDistance / this.initialTouchDistance;
        let newScale = this.initialScale * factor;
        newScale = Math.max(0.8, Math.min(this.maxScale + 0.5, newScale)); // Elastic boundaries
        this.scale = newScale;
        this.applyTransform();
        if (this.onScaleChange) this.onScaleChange(this.scale);
      }
      return;
    }

    // Handle 1-finger panning while zoomed in
    if (this.isPanning && e.touches.length === 1 && this.isZoomed()) {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - this.touchStartPos.x;
      const dy = touch.clientY - this.touchStartPos.y;

      // Allow dragging around
      const maxPanX = (this.container.clientWidth * (this.scale - 1)) / 2;
      const maxPanY = (this.container.clientHeight * (this.scale - 1)) / 2;

      this.pan.x = Math.max(-maxPanX, Math.min(maxPanX, this.panStart.x + dx));
      this.pan.y = Math.max(-maxPanY, Math.min(maxPanY, this.panStart.y + dy));

      this.applyTransform();
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.isDestroyed) return;

    if (e.touches.length < 2 && this.isMultiTouch) {
      this.isMultiTouch = false;
      // Clamp scale to valid range with smooth spring animation
      if (this.scale < this.minScale + 0.1) {
        this.resetZoom(true);
      } else if (this.scale > this.maxScale) {
        this.scale = this.maxScale;
        this.applyTransform(true);
      }
    }

    if (e.touches.length === 0) {
      this.isPanning = false;
      if (this.scale < this.minScale + 0.1) {
        this.resetZoom(true);
      }
    }
  }

  private handleDoubleTap(clientX: number, clientY: number): void {
    if (this.isZoomed()) {
      // Zoom out back to 1.0x
      this.resetZoom(true);
    } else {
      // Zoom in to 2.2x centered on tap
      this.scale = 2.2;
      const rect = this.container.getBoundingClientRect();
      const originX = clientX - rect.left - rect.width / 2;
      const originY = clientY - rect.top - rect.height / 2;

      this.pan.x = -originX * 0.6;
      this.pan.y = -originY * 0.6;

      this.applyTransform(true);
      if (this.onScaleChange) this.onScaleChange(this.scale);
    }
  }

  public applyTransform(animate = false): void {
    if (!this.container) return;

    if (animate) {
      this.container.style.transition = 'transform 0.28s cubic-bezier(0.25, 1, 0.5, 1)';
    } else {
      this.container.style.transition = 'none';
    }

    if (this.scale <= 1.001) {
      this.container.style.transform = '';
      this.container.style.touchAction = '';
    } else {
      this.container.style.transform = `translate3d(${this.pan.x}px, ${this.pan.y}px, 0) scale(${this.scale})`;
      this.container.style.touchAction = 'none';
    }
  }

  public resetZoom(animate = true): void {
    this.scale = 1.0;
    this.pan = { x: 0, y: 0 };
    this.isPanning = false;
    this.isMultiTouch = false;
    this.applyTransform(animate);
    if (this.onScaleChange) this.onScaleChange(1.0);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.resetZoom(false);
    if (this.container) {
      this.container.removeEventListener('touchstart', this.handleTouchStartBound);
      this.container.style.touchAction = '';
      this.container.style.transform = '';
      this.container.style.transition = '';
      this.container.style.willChange = '';
    }
    window.removeEventListener('touchmove', this.handleTouchMoveBound);
    window.removeEventListener('touchend', this.handleTouchEndBound);
    window.removeEventListener('touchcancel', this.handleTouchEndBound);
  }
}
