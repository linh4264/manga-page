import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PinchZoomHandler } from '../src/reader/pinchZoomHandler';

describe('Dual-Page Spread Mode & Pinch-to-Zoom Touch Gestures', () => {
  describe('1. Dual-Page Spread Math & Step Logic', () => {
    it('calculates 1.44 aspect ratio for dual page vs 0.72 for single page', () => {
      const singlePageRatio = 0.72;
      const dualPageRatio = singlePageRatio * 2; // 1.44

      expect(dualPageRatio).toBe(1.44);

      // Desktop wide viewport (1440x900)
      const maxH = 888;
      const singleW = Math.round(maxH * singlePageRatio); // 639px
      const dualW = Math.round(maxH * dualPageRatio); // 1279px

      expect(dualW).toBeGreaterThan(singleW * 1.9);
    });

    it('advances by step of 2 in dual-page mode without exceeding bounds', () => {
      const totalPages = 20;
      let currentPage = 0;
      const isDual = true;
      const step = isDual ? 2 : 1;

      function flip(dir: number): number {
        const next = currentPage + (dir * step);
        currentPage = Math.max(0, Math.min(totalPages - 1, next));
        return currentPage;
      }

      expect(flip(1)).toBe(2);  // Pages 2 & 3
      expect(flip(1)).toBe(4);  // Pages 4 & 5
      expect(flip(1)).toBe(6);  // Pages 6 & 7
      expect(flip(-1)).toBe(4); // Back to Pages 4 & 5
      expect(flip(-1)).toBe(2);
      expect(flip(-1)).toBe(0);
      expect(flip(-1)).toBe(0); // Clamped at 0
    });

    it('clamps to last page when stepping by 2 near end of chapter', () => {
      const totalPages = 5;
      let currentPage = 3;
      const step = 2;

      const next = Math.max(0, Math.min(totalPages - 1, currentPage + step));
      expect(next).toBe(4); // Last page index (0 to 4)
    });

    it('calculates realistic dual-page leaf width during 3D flip over the spine', () => {
      const spreadWidth = 1000;
      const halfW = spreadWidth / 2; // 500px per page

      // Test progress = 0 (Resting spread)
      let p = 0;
      let t1 = p * 2;
      let leafW1 = halfW * (1 - t1);
      expect(leafW1).toBe(500); // Fully covers right page

      // Test progress = 0.25 (Mid-way right fold)
      p = 0.25;
      t1 = p * 2; // 0.5
      leafW1 = halfW * (1 - t1);
      expect(leafW1).toBe(250); // Half contracted towards spine

      // Test progress = 0.5 (Directly perpendicular over spine)
      p = 0.5;
      t1 = p * 2; // 1.0
      leafW1 = halfW * (1 - t1);
      expect(leafW1).toBe(0); // At spine

      // Test progress = 0.75 (Expanding onto left page)
      p = 0.75;
      let t2 = (p - 0.5) * 2; // 0.5
      let leafW2 = halfW * t2;
      expect(leafW2).toBe(250); // Half expanded on left

      // Test progress = 1.0 (Fully landed on left page)
      p = 1.0;
      t2 = (p - 0.5) * 2; // 1.0
      leafW2 = halfW * t2;
      expect(leafW2).toBe(500); // Fully covers left page
    });
  });

  describe('2. PinchZoomHandler Functionality', () => {
    let mockContainer: any;
    let handler: PinchZoomHandler;
    let listeners: Record<string, Function[]> = {};

    beforeEach(() => {
      listeners = {};

      mockContainer = {
        style: {} as Record<string, string>,
        clientWidth: 800,
        clientHeight: 1200,
        addEventListener: vi.fn((event: string, fn: Function) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(fn);
        }),
        removeEventListener: vi.fn((event: string, fn: Function) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(f => f !== fn);
          }
        }),
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 800,
          height: 1200,
          right: 800,
          bottom: 1200
        })
      };

      (globalThis as any).window = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      };

      handler = new PinchZoomHandler({
        container: mockContainer as any,
        minScale: 1.0,
        maxScale: 3.5
      });
    });

    afterEach(() => {
      if (handler) {
        handler.destroy();
      }
    });

    it('initializes with default 1.0 scale and is not zoomed', () => {
      expect(handler.getScale()).toBe(1.0);
      expect(handler.isZoomed()).toBe(false);
    });

    it('correctly resets zoom to 1.0', () => {
      handler.resetZoom(false);
      expect(handler.getScale()).toBe(1.0);
      expect(handler.isZoomed()).toBe(false);
    });

    it('cleans up styles and event listeners upon destroy', () => {
      handler.destroy();
      expect(mockContainer.style.transform).toBe('');
      expect(mockContainer.style.touchAction).toBe('');
      expect(mockContainer.removeEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function));
    });
  });
});
