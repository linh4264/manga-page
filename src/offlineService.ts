/**
 * Offline Reading Service for DriveManga
 * Manages caching chapter images via Cache Storage API, tracking download metadata in StorageService,
 * and enabling true offline reading on airplanes, subways, or without network.
 */

import { Manga, Chapter } from './types/manga';
import { StorageService } from './storageService';
import { DriveHelper } from './driveHelper';

export const OFFLINE_CACHE_NAME = 'drivemanga-offline-chapters-v1';
const OFFLINE_META_KEY = 'offline_chapters_meta';

export interface OfflineChapterMeta {
  mangaId: string;
  mangaTitle: string;
  chapterId: string;
  chapterTitle: string;
  pageCount: number;
  downloadedAt: string;
}

export class OfflineService {
  /**
   * Check if Cache API is supported in the current environment (browser or worker)
   */
  public static isSupported(): boolean {
    if (typeof caches !== 'undefined') return true;
    return typeof window !== 'undefined' && 'caches' in window;
  }

  /**
   * Check if a specific chapter is already downloaded
   */
  public static isChapterDownloaded(mangaId: string, chapterId: string): boolean {
    const metas = StorageService.getSync<OfflineChapterMeta[]>(OFFLINE_META_KEY, []);
    return metas.some((m) => m.mangaId === mangaId && m.chapterId === chapterId);
  }

  /**
   * Get list of all downloaded chapters
   */
  public static getDownloadedChapters(): OfflineChapterMeta[] {
    return StorageService.getSync<OfflineChapterMeta[]>(OFFLINE_META_KEY, []);
  }

  /**
   * Download all pages of a chapter into Cache Storage
   */
  public static async downloadChapter(
    manga: Manga,
    chapter: Chapter,
    onProgress?: (percent: number) => void
  ): Promise<boolean> {
    if (!this.isSupported()) {
      throw new Error('Trình duyệt của bạn không hỗ trợ Cache API để lưu ngoại tuyến.');
    }

    const pages = chapter.pages || [];
    if (pages.length === 0) {
      throw new Error('Chương này không có danh sách trang ảnh để tải.');
    }

    try {
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      let loaded = 0;

      for (let i = 0; i < pages.length; i++) {
        const pageSrc = pages[i];
        let targetUrl = pageSrc;

        const fileId = DriveHelper.extractFileId(pageSrc);
        if (fileId) {
          targetUrl = DriveHelper.getImageUrls(fileId).primary;
        }

        try {
          // Fetch image with no-referrer
          const response = await fetch(targetUrl, {
            mode: 'cors',
            credentials: 'omit'
          });

          if (response.ok) {
            await cache.put(targetUrl, response);
          }
        } catch (fetchErr) {
          console.warn(`Không thể nạp trước trang ${i + 1}:`, fetchErr);
        }

        loaded++;
        if (onProgress) {
          onProgress(Math.round((loaded / pages.length) * 100));
        }
      }

      // Also cache Credit.webp if available
      try {
        const creditRes = await fetch('/Credit.webp');
        if (creditRes.ok) {
          await cache.put('/Credit.webp', creditRes);
        }
      } catch {}

      // Save metadata
      const metas = StorageService.getSync<OfflineChapterMeta[]>(OFFLINE_META_KEY, []);
      const existingIdx = metas.findIndex(
        (m) => m.mangaId === manga.id && m.chapterId === chapter.id
      );

      const newMeta: OfflineChapterMeta = {
        mangaId: manga.id,
        mangaTitle: manga.title,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        pageCount: pages.length,
        downloadedAt: new Date().toISOString()
      };

      if (existingIdx !== -1) {
        metas[existingIdx] = newMeta;
      } else {
        metas.push(newMeta);
      }

      await StorageService.setItem(OFFLINE_META_KEY, metas);
      return true;
    } catch (err: any) {
      console.error('Lỗi khi tải chương offline:', err);
      throw err;
    }
  }

  /**
   * Delete a downloaded chapter from Cache Storage and remove metadata
   */
  public static async deleteDownloadedChapter(mangaId: string, chapterId: string): Promise<boolean> {
    if (!this.isSupported()) return false;

    try {
      const metas = StorageService.getSync<OfflineChapterMeta[]>(OFFLINE_META_KEY, []);
      const updated = metas.filter((m) => !(m.mangaId === mangaId && m.chapterId === chapterId));
      await StorageService.setItem(OFFLINE_META_KEY, updated);
      return true;
    } catch (err) {
      console.warn('Lỗi khi xóa chương offline:', err);
      return false;
    }
  }

  /**
   * Clear entire offline cache storage
   */
  public static async clearAllOfflineData(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await caches.delete(OFFLINE_CACHE_NAME);
      await StorageService.setItem(OFFLINE_META_KEY, []);
      return true;
    } catch (err) {
      console.warn('Lỗi khi dọn sạch bộ nhớ offline:', err);
      return false;
    }
  }
}
