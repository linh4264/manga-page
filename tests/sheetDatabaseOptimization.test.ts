import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SheetDatabase } from '../src/sheetDatabase';
import { Manga } from '../src/types/manga';

describe('Google Sheet Database Optimization & 2-Tab Architecture', () => {
  describe('1. Page ID Compression (Reducing storage by 65%+)', () => {
    it('compresses Google Drive thumbnail URLs into clean File IDs', () => {
      const originalUrls = [
        'https://drive.google.com/thumbnail?id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms&sz=w1600',
        'https://drive.google.com/uc?export=view&id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing'
      ];

      const compressed = SheetDatabase.compressPages(originalUrls);
      expect(compressed).toEqual([
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
        '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'
      ]);

      const originalLen = originalUrls.join(',').length;
      const compressedLen = compressed.join(',').length;
      const reductionRate = (originalLen - compressedLen) / originalLen;
      expect(reductionRate).toBeGreaterThan(0.5); // Over 50% character reduction
    });

    it('preserves non-Drive URLs (e.g. Unsplash, external CDNs, PDF)', () => {
      const urls = [
        'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600',
        'https://example.com/chapter1/page01.webp',
        'https://raw.githubusercontent.com/mozilla/pdf.js/test.pdf'
      ];

      const compressed = SheetDatabase.compressPages(urls);
      expect(compressed).toEqual(urls);
    });
  });

  describe('2. Static Catalog 0ms Edge Fallback', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches static /data/catalog.json successfully when called', async () => {
      const mockCatalog: Manga[] = [
        {
          id: 'test-manga',
          title: 'Test Manga',
          chapters: [
            { id: 'chap-2', title: 'Chương 2', pages: [] },
            { id: 'chap-1', title: 'Chương 1', pages: [] }
          ]
        }
      ];

      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockCatalog
      });

      const result = await SheetDatabase.fetchStaticCatalog();
      expect(result).toBeDefined();
      expect(result?.[0].id).toBe('test-manga');
      // Natural sorting should sort Chương 1 before Chương 2
      expect(result?.[0].chapters[0].title).toBe('Chương 1');
      expect(result?.[0].chapters[1].title).toBe('Chương 2');
    });

    it('returns null gracefully if /data/catalog.json fails to fetch', async () => {
      (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));
      const result = await SheetDatabase.fetchStaticCatalog();
      expect(result).toBeNull();
    });
  });

  describe('3. Connection Testing & Diagnostics', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = vi.fn();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('validates successful connection when ping returns ok', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, status: 'ok', version: '2.0.0' })
      });

      const res = await SheetDatabase.testConnection('https://script.google.com/macros/s/test/exec');
      expect(res.ok).toBe(true);
      expect(res.version).toBe('2.0.0');
      expect(res.message).toContain('thành công');
    });

    it('handles server error response during ping test', async () => {
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        status: 500
      });

      const res = await SheetDatabase.testConnection('https://script.google.com/macros/s/test/exec');
      expect(res.ok).toBe(false);
      expect(res.message).toContain('HTTP 500');
    });
  });
});
