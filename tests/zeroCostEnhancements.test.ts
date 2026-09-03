import { describe, it, expect } from 'vitest';
import { DriveHelper } from '../src/driveHelper';
import { StorageService } from '../src/storageService';
import { ReadingHistoryItem, Manga } from '../src/types/manga';

describe('Zero-Cost ($0/Month) Architectural Enhancements', () => {
  describe('1. Free Global WebP CDN (wsrv.nl)', () => {
    it('generates high-performance WebP CDN URL with custom width', () => {
      const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      const webpUrl = DriveHelper.getWebpUrl(fileId, 800);

      expect(webpUrl).toBe(
        `https://wsrv.nl/?url=https%3A%2F%2Fdrive.google.com%2Fthumbnail%3Fid%3D${fileId}%26sz%3Dw800&output=webp&q=82`
      );
    });

    it('returns default width 1600 if width is omitted in getWebpUrl', () => {
      const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      const webpUrl = DriveHelper.getWebpUrl(fileId);

      expect(webpUrl).toContain('sz%3Dw1600');
      expect(webpUrl).toContain('output=webp');
      expect(webpUrl).toContain('q=82');
    });

    it('includes webpCdn in getImageUrls response', () => {
      const fileId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
      const urls = DriveHelper.getImageUrls(fileId, 1200);

      expect(urls.webpCdn).toBeDefined();
      expect(urls.webpCdn).toContain('wsrv.nl');
      expect(urls.webpCdn).toContain(fileId);
      expect(urls.webpCdn).toContain('w1200');
      expect(urls.webpCdn).toContain('output=webp');
    });

    it('returns null or empty for invalid IDs in WebP generation', () => {
      expect(DriveHelper.getWebpUrl('')).toBeNull();
      expect(DriveHelper.getWebpUrl(null)).toBeNull();
    });
  });

  describe('2. Page-Level Reading Progress & Bookmark Resume', () => {
    it('stores and retrieves exact pageIndex in reading_history', () => {
      const mangaId = 'solo-leveling';
      const historyItem: ReadingHistoryItem = {
        chapterId: 'chap-1',
        chapterTitle: 'Chương 1',
        updatedAt: new Date().toISOString(),
        pageIndex: 14 // Trang thứ 15 (0-indexed)
      };

      const historyMap: Record<string, ReadingHistoryItem> = {
        [mangaId]: historyItem
      };

      StorageService.setItem('reading_history', historyMap);

      const retrieved = StorageService.getSync<Record<string, ReadingHistoryItem>>('reading_history', {});
      expect(retrieved[mangaId]).toBeDefined();
      expect(retrieved[mangaId].pageIndex).toBe(14);
      expect(retrieved[mangaId].chapterId).toBe('chap-1');
    });
  });

  describe('3. Dynamic Genre Catalog Extraction', () => {
    it('extracts unique, sorted genres from any arbitrary manga list', () => {
      const mockCatalog: Manga[] = [
        {
          id: 'm1',
          title: 'Truyện 1',
          genres: ['Action', 'Fantasy', 'Isekai'],
          chapters: []
        },
        {
          id: 'm2',
          title: 'Truyện 2',
          genres: ['Romance', 'Comedy', 'Action'],
          chapters: []
        },
        {
          id: 'm3',
          title: 'Truyện 3',
          genres: ['Sci-Fi', 'Isekai'],
          chapters: []
        }
      ];

      const genreSet = new Set<string>();
      mockCatalog.forEach(m => {
        if (Array.isArray(m.genres)) {
          m.genres.forEach(g => {
            const trimmed = g.trim();
            if (trimmed) genreSet.add(trimmed);
          });
        }
      });

      const sortedGenres = Array.from(genreSet).sort((a, b) => a.localeCompare(b, 'vi'));
      const finalGenres = ['All', ...sortedGenres, 'Bookmarks'];

      expect(finalGenres).toEqual([
        'All',
        'Action',
        'Comedy',
        'Fantasy',
        'Isekai',
        'Romance',
        'Sci-Fi',
        'Bookmarks'
      ]);
    });
  });
});
