import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OfflineService, OFFLINE_CACHE_NAME } from '../src/offlineService';
import { StorageService } from '../src/storageService';

describe('OfflineService - Chapter Cache Storage & Metadata Management', () => {
  beforeEach(async () => {
    await StorageService.init();
    await OfflineService.clearAllOfflineData();

    // Mock caches API
    const mockCacheStore = new Map<string, any>();
    (global as any).caches = {
      open: vi.fn().mockResolvedValue({
        put: vi.fn().mockImplementation((req, res) => {
          mockCacheStore.set(typeof req === 'string' ? req : req.url, res);
          return Promise.resolve();
        }),
        match: vi.fn().mockImplementation((req) => {
          const key = typeof req === 'string' ? req : req.url;
          return Promise.resolve(mockCacheStore.get(key) || null);
        }),
        delete: vi.fn().mockImplementation((req) => {
          const key = typeof req === 'string' ? req : req.url;
          mockCacheStore.delete(key);
          return Promise.resolve(true);
        })
      }),
      delete: vi.fn().mockImplementation(() => {
        mockCacheStore.clear();
        return Promise.resolve(true);
      }),
      match: vi.fn().mockResolvedValue(null)
    };

    // Mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      clone: () => ({ ok: true }),
      blob: () => Promise.resolve(new Blob(['fake-image']))
    } as any);
  });

  it('reports Cache API support correctly', () => {
    expect(OfflineService.isSupported()).toBe(true);
  });

  it('checks if chapter is downloaded and manages metadata', async () => {
    expect(OfflineService.isChapterDownloaded('solo-leveling', 'c1')).toBe(false);

    const manga: any = {
      id: 'solo-leveling',
      title: 'Solo Leveling'
    };
    const chapter: any = {
      id: 'c1',
      title: 'Chương 1',
      pages: ['https://example.com/p1.jpg', 'https://example.com/p2.jpg']
    };

    let progressPercent = 0;
    const ok = await OfflineService.downloadChapter(manga, chapter, (pct) => {
      progressPercent = pct;
    });

    expect(ok).toBe(true);
    expect(progressPercent).toBe(100);

    // Now it should report as downloaded
    expect(OfflineService.isChapterDownloaded('solo-leveling', 'c1')).toBe(true);

    // Metadata list should contain this chapter
    const list = OfflineService.getDownloadedChapters();
    expect(list).toHaveLength(1);
    expect(list[0].mangaId).toBe('solo-leveling');
    expect(list[0].chapterId).toBe('c1');
    expect(list[0].pageCount).toBe(2);

    // Delete chapter
    const deleted = await OfflineService.deleteDownloadedChapter('solo-leveling', 'c1');
    expect(deleted).toBe(true);
    expect(OfflineService.isChapterDownloaded('solo-leveling', 'c1')).toBe(false);
  });

  it('clears all offline data completely', async () => {
    const manga: any = { id: 'm1', title: 'Manga 1' };
    const chapter: any = { id: 'c1', title: 'Chương 1', pages: ['https://example.com/p1.jpg'] };

    await OfflineService.downloadChapter(manga, chapter);
    expect(OfflineService.getDownloadedChapters()).toHaveLength(1);

    await OfflineService.clearAllOfflineData();
    expect(OfflineService.getDownloadedChapters()).toHaveLength(0);
  });
});
