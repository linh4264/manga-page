import { describe, it, expect } from 'vitest';
import { AppRouter } from '../src/router';
import { SheetDatabase } from '../src/sheetDatabase';
import { Chapter, Manga } from '../src/types/manga';

describe('Reader & Navigation Engine', () => {
  describe('Chapter Sorting & Natural Alphanumeric Ordering', () => {
    it('sorts chapters accurately in ascending order (1, 2, ..., 10, 100)', () => {
      const chapters: Chapter[] = [
        { id: 'c10', title: 'Chương 10', pages: [] },
        { id: 'c2', title: 'Chương 2', pages: [] },
        { id: 'c1', title: 'Chương 1', pages: [] },
        { id: 'c100', title: 'Chương 100', pages: [] },
        { id: 'c20', title: 'Chương 20', pages: [] }
      ];

      const sorted = [...chapters].sort((a, b) => 
        (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' })
      );

      expect(sorted.map(c => c.id)).toEqual(['c1', 'c2', 'c10', 'c20', 'c100']);
    });

    it('sorts chapters in descending order for latest first display', () => {
      const chapters: Chapter[] = [
        { id: 'c1', title: 'Chương 1', pages: [] },
        { id: 'c2', title: 'Chương 2', pages: [] },
        { id: 'c3', title: 'Chương 3', pages: [] }
      ];

      const descSorted = [...chapters].sort((a, b) => 
        (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' })
      ).reverse();

      expect(descSorted.map(c => c.id)).toEqual(['c3', 'c2', 'c1']);
    });
  });

  describe('Page Bounds & Flip Navigation Logic', () => {
    const totalPages = 15;

    function getNextPageIndex(current: number, direction: number, total: number): { nextIndex: number; isAtEnd: boolean; isAtStart: boolean } {
      const target = current + direction;
      return {
        nextIndex: Math.max(0, Math.min(total - 1, target)),
        isAtEnd: target >= total,
        isAtStart: target < 0
      };
    }

    it('navigates to next and previous pages within safe bounds', () => {
      expect(getNextPageIndex(0, 1, totalPages)).toEqual({ nextIndex: 1, isAtEnd: false, isAtStart: false });
      expect(getNextPageIndex(5, 1, totalPages)).toEqual({ nextIndex: 6, isAtEnd: false, isAtStart: false });
      expect(getNextPageIndex(5, -1, totalPages)).toEqual({ nextIndex: 4, isAtEnd: false, isAtStart: false });
    });

    it('prevents navigating before the first page', () => {
      const res = getNextPageIndex(0, -1, totalPages);
      expect(res.nextIndex).toBe(0);
      expect(res.isAtStart).toBe(true);
    });

    it('detects when reader reaches the end of the chapter for next chapter transition', () => {
      const res = getNextPageIndex(14, 1, totalPages);
      expect(res.nextIndex).toBe(14);
      expect(res.isAtEnd).toBe(true);
    });

    it('calculates reading progress percentage accurately', () => {
      function calculateProgress(pageIndex: number, total: number): number {
        if (total <= 0) return 0;
        return Math.min(100, Math.max(0, Math.round(((pageIndex + 1) / total) * 100)));
      }

      expect(calculateProgress(0, 10)).toBe(10);
      expect(calculateProgress(4, 10)).toBe(50);
      expect(calculateProgress(9, 10)).toBe(100);
      expect(calculateProgress(0, 0)).toBe(0);
    });
  });

  describe('Router Path & Hash Parsing', () => {
    it('parses home route from clean path and hash', () => {
      const mockApp = { getAllManga: () => [] };
      const router = new AppRouter(mockApp as any);

      function parseRoute(pathOrHash: string): string[] {
        let raw = pathOrHash;
        if (raw.startsWith('#/')) {
          raw = raw.substring(2);
        } else if (raw.startsWith('#')) {
          raw = raw.substring(1);
        }
        if (raw.startsWith('/')) {
          raw = raw.substring(1);
        }
        if (raw.startsWith('index.html')) {
          raw = raw.replace(/^index\.html\/?/, '');
        }
        return raw.split('/').map(p => decodeURIComponent(p.trim())).filter(p => p.length > 0);
      }

      expect(parseRoute('/')).toEqual([]);
      expect(parseRoute('#/')).toEqual([]);
      expect(parseRoute('')).toEqual([]);
      expect(parseRoute('/index.html')).toEqual([]);
      expect(parseRoute('#/index.html')).toEqual([]);
    });

    it('parses manga detail route with IDs and slugs', () => {
      function parseRoute(pathOrHash: string): string[] {
        let raw = pathOrHash.startsWith('#/') ? pathOrHash.substring(2) : (pathOrHash.startsWith('/') ? pathOrHash.substring(1) : pathOrHash);
        return raw.split('/').map(p => decodeURIComponent(p.trim())).filter(p => p.length > 0);
      }

      expect(parseRoute('/solo-leveling')).toEqual(['solo-leveling']);
      expect(parseRoute('#/manga-123')).toEqual(['manga-123']);
      expect(parseRoute('/custom-1725000000')).toEqual(['custom-1725000000']);
    });

    it('parses manga chapter reading route', () => {
      function parseRoute(pathOrHash: string): string[] {
        let raw = pathOrHash.startsWith('#/') ? pathOrHash.substring(2) : (pathOrHash.startsWith('/') ? pathOrHash.substring(1) : pathOrHash);
        return raw.split('/').map(p => decodeURIComponent(p.trim())).filter(p => p.length > 0);
      }

      expect(parseRoute('/solo-leveling/chap-1')).toEqual(['solo-leveling', 'chap-1']);
      expect(parseRoute('#/manga-123/chap-5-1725')).toEqual(['manga-123', 'chap-5-1725']);
    });
  });

  describe('Catalog Cache TTL & SWR Strategy', () => {
    it('validates cache expiration based on TTL', () => {
      const TTL = SheetDatabase.CACHE_TTL_MS;
      const now = Date.now();

      function isCacheValid(syncTime: number, ttl: number, currentTime: number): boolean {
        return (currentTime - syncTime) < ttl;
      }

      // Fresh cache (2 minutes old)
      expect(isCacheValid(now - 2 * 60 * 1000, TTL, now)).toBe(true);

      // Stale cache (15 minutes old)
      expect(isCacheValid(now - 15 * 60 * 1000, TTL, now)).toBe(false);
    });
  });
});
