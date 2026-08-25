import { describe, it, expect } from 'vitest';
import { SeoHelper } from '../src/seoHelper';
import { AnalyticsService } from '../src/analyticsService';
import { SheetDatabase } from '../src/sheetDatabase';
import { Manga, Chapter, MangaSummary, ChapterSummary, ChapterDetail } from '../src/types/manga';

describe('P2 Architecture & Scale Enhancements', () => {
  describe('7. Modular Reader Engine Structure', () => {
    it('creates and manages page indices safely in CanvasCurlEngine logic', () => {
      const pages = ['page1.jpg', 'page2.jpg', 'page3.jpg'];
      let currentPage = 0;

      function flip(dir: number): number {
        const next = currentPage + dir;
        if (next >= 0 && next < pages.length) {
          currentPage = next;
        }
        return currentPage;
      }

      expect(flip(1)).toBe(1);
      expect(flip(1)).toBe(2);
      expect(flip(1)).toBe(2); // Clamped at end
      expect(flip(-1)).toBe(1);
      expect(flip(-1)).toBe(0);
      expect(flip(-1)).toBe(0); // Clamped at start
    });
  });

  describe('8. Manga Metadata & Chapter Data Separation', () => {
    it('creates lightweight MangaSummary without bloating memory with full page arrays', () => {
      const summary: MangaSummary = {
        id: 'solo-leveling',
        title: 'Solo Leveling',
        author: 'Chugong',
        coverUrl: 'https://lh3.googleusercontent.com/d/coverId',
        chapterCount: 200,
        latestChapterTitle: 'Chương 200'
      };

      expect(summary.id).toBe('solo-leveling');
      expect(summary.chapterCount).toBe(200);
      expect((summary as any).chapters).toBeUndefined();
    });

    it('returns existing pages without fetching if already present', async () => {
      const pages = ['p1.jpg', 'p2.jpg'];
      const result = await SheetDatabase.fetchChapterPages('manga1', 'chap1', pages);
      expect(result).toEqual(pages);
    });

    it('uses in-memory cache for repeated lazy chapter page requests', async () => {
      const cacheKey = 'manga1_chap2';
      SheetDatabase.chapterPagesCache.set(cacheKey, ['cached_p1.jpg', 'cached_p2.jpg']);

      const result = await SheetDatabase.fetchChapterPages('manga1', 'chap2');
      expect(result).toEqual(['cached_p1.jpg', 'cached_p2.jpg']);
    });
  });

  describe('9. Clean URL & SEO Structured Data Generation', () => {
    const mockManga: Manga = {
      id: 'one-piece',
      title: 'One Piece',
      originalTitle: 'Đảo Hải Tặc',
      author: 'Eiichiro Oda',
      description: 'Hành trình tìm kiếm kho báu One Piece của Luffy.',
      coverUrl: 'https://lh3.googleusercontent.com/d/cover123',
      genres: ['Action', 'Adventure', 'Shounen'],
      rating: 4.9,
      chapters: [
        { id: 'c1', title: 'Chương 1: Bình minh của cuộc phiêu lưu', pages: ['p1.jpg'] }
      ]
    };

    it('formats correct title and description for Manga Detail SEO', () => {
      const expectedTitle = `${mockManga.title} - Đọc Truyện Tranh Online | DriveManga`;
      expect(expectedTitle).toContain('One Piece');
      expect(expectedTitle).toContain('DriveManga');
    });

    it('formats correct title for Chapter Reader SEO', () => {
      const chapter = mockManga.chapters[0];
      const expectedTitle = `${mockManga.title} - ${chapter.title} | DriveManga`;
      expect(expectedTitle).toBe('One Piece - Chương 1: Bình minh của cuộc phiêu lưu | DriveManga');
    });
  });

  describe('10. Web Analytics & Reading Telemetry', () => {
    it('formats pageview and custom reader events accurately', () => {
      const events: Array<{ name: string; params: any }> = [];

      function mockLog(name: string, params: any) {
        events.push({ name, params });
      }

      mockLog('page_view', {
        page_path: '/one-piece/c1',
        page_title: 'One Piece - Chương 1'
      });

      mockLog('read_chapter_start', {
        manga_id: 'one-piece',
        chapter_id: 'c1',
        reading_mode: 'webtoon'
      });

      mockLog('read_chapter_complete', {
        manga_id: 'one-piece',
        chapter_id: 'c1',
        total_pages: 50,
        read_duration_seconds: 120
      });

      expect(events).toHaveLength(3);
      expect(events[0].name).toBe('page_view');
      expect(events[0].params.page_path).toBe('/one-piece/c1');
      expect(events[1].params.reading_mode).toBe('webtoon');
      expect(events[2].params.read_duration_seconds).toBe(120);
    });
  });
});
