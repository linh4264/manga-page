import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SheetDatabase } from '../src/sheetDatabase';
import { StorageService } from '../src/storageService';
import { Manga } from '../src/types/manga';

describe('Background Auto-Sync Flow & Stale-While-Revalidate (SWR)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
    // Clear storage cache before each test
    StorageService.removeItem('sheet_manga_cache');
    StorageService.removeItem('sheet_manga_sync_time');
    SheetDatabase._inFlightFetch = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    SheetDatabase._inFlightFetch = null;
  });

  it('triggers network fetch to Google Sheet when cache is older than AUTO_SYNC_THROTTLE_MS', async () => {
    const mockMangaList: Manga[] = [
      { id: 'manga-1', title: 'Truyện Mới 1', chapters: [] }
    ];

    // Simulate cache from 2 minutes ago (> 60s throttle)
    const oldSyncTime = Date.now() - 120 * 1000;
    StorageService.setItem('sheet_manga_cache', [{ id: 'old-manga', title: 'Truyện Cũ', chapters: [] }]);
    StorageService.setItem('sheet_manga_sync_time', String(oldSyncTime));

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockMangaList
    });

    const result = await SheetDatabase.fetchMangaCatalog(false);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
    expect(result?.[0].id).toBe('manga-1');

    // Verify storage was updated with fresh sync timestamp
    const newSyncTime = StorageService.getSync<string | null>('sheet_manga_sync_time', null);
    expect(Number(newSyncTime)).toBeGreaterThan(oldSyncTime);
  });

  it('returns cached data immediately without network request when within throttle interval', async () => {
    const cachedManga: Manga[] = [
      { id: 'cached-1', title: 'Truyện Trong Cache', chapters: [] }
    ];

    // Simulate recent sync (20 seconds ago, < 60s throttle)
    const recentSyncTime = Date.now() - 20 * 1000;
    StorageService.setItem('sheet_manga_cache', cachedManga);
    StorageService.setItem('sheet_manga_sync_time', String(recentSyncTime));

    const result = await SheetDatabase.fetchMangaCatalog(false);

    // No network request made
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toEqual(cachedManga);
  });

  it('bypasses throttle and forces network fetch when force = true', async () => {
    const cachedManga: Manga[] = [
      { id: 'cached-1', title: 'Truyện Trong Cache', chapters: [] }
    ];
    const freshManga: Manga[] = [
      { id: 'fresh-1', title: 'Truyện Mới Tinh', chapters: [] }
    ];

    // Even if synced 5 seconds ago
    StorageService.setItem('sheet_manga_cache', cachedManga);
    StorageService.setItem('sheet_manga_sync_time', String(Date.now() - 5000));

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => freshManga
    });

    const result = await SheetDatabase.fetchMangaCatalog(true);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (globalThis.fetch as any).mock.calls[0][0];
    expect(calledUrl).toContain('_t='); // Cache buster param
    expect(result?.[0].id).toBe('fresh-1');
  });

  it('deduplicates concurrent in-flight fetch requests', async () => {
    const mockMangaList: Manga[] = [
      { id: 'manga-async', title: 'Async Manga', chapters: [] }
    ];

    // Slow network response (delayed)
    (globalThis.fetch as any).mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            headers: { get: () => 'application/json' },
            json: async () => mockMangaList
          });
        }, 50);
      });
    });

    // Call fetchMangaCatalog twice concurrently
    const p1 = SheetDatabase.fetchMangaCatalog(false);
    const p2 = SheetDatabase.fetchMangaCatalog(false);

    const [res1, res2] = await Promise.all([p1, p2]);

    // Only 1 fetch call was initiated
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(res1).toEqual(res2);
    expect(res1?.[0].id).toBe('manga-async');
  });

  it('falls back gracefully to existing cache when Google Sheets API encounters error', async () => {
    const existingCache: Manga[] = [
      { id: 'cached-fallback', title: 'Truyện Trong Bộ Nhớ Đệm', chapters: [] }
    ];

    StorageService.setItem('sheet_manga_cache', existingCache);
    StorageService.setItem('sheet_manga_sync_time', String(Date.now() - 200 * 1000));

    (globalThis.fetch as any).mockRejectedValue(new Error('503 Service Unavailable'));

    const result = await SheetDatabase.fetchMangaCatalog(false);

    // Returned existing cache without throwing
    expect(result).toEqual(existingCache);
  });
});
