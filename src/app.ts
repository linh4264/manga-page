/**
 * Main Application Entry Point for DriveManga
 */

import { Manga, CommentItem, ReadingHistoryItem } from './types/manga';
import { SAMPLE_MANGA_DATA } from './data/sampleManga';
import { SheetDatabase } from './sheetDatabase';
import { StorageService } from './storageService';
import { AppRouter } from './router';
import { LibraryComponent } from './components/library';
import { ReaderComponent } from './components/reader';
import { ImportModalComponent } from './components/importModal';
import { AddChapterModalComponent } from './components/addChapterModal';
import { EditChapterModalComponent } from './components/editChapterModal';
import { EditMangaModalComponent } from './components/editMangaModal';
import { PwaService } from './pwaService';

export class MangaApp {
  customMangaList: Manga[];
  sheetMangaList: Manga[];
  
  libraryComponent!: LibraryComponent;
  readerComponent!: ReaderComponent;
  importModalComponent!: ImportModalComponent;
  addChapterModalComponent!: AddChapterModalComponent;
  editChapterModalComponent!: EditChapterModalComponent;
  editMangaModalComponent!: EditMangaModalComponent;
  router!: AppRouter;

  constructor() {
    this.customMangaList = StorageService.getSync<Manga[]>('custom_manga_list', []);
    this.sheetMangaList = StorageService.getSync<Manga[]>('sheet_manga_cache', []);
    
    this.init();
  }

  getAllManga(): Manga[] {
    // 1. Ưu tiên dữ liệu tải từ Google Sheet trong phiên hiện tại
    if (this.sheetMangaList && this.sheetMangaList.length > 0) {
      return this.sheetMangaList;
    }
    // 2. Dự phòng bộ nhớ đệm Cache StorageService (IndexedDB + Memory)
    try {
      const cached = StorageService.getSync<Manga[]>('sheet_manga_cache', []);
      if (cached && cached.length > 0) {
        return cached;
      }
    } catch (e) {}
    // 3. Dự phòng danh mục tĩnh sampleManga khi mất mạng hoặc API Google Sheet nghẽn
    return SAMPLE_MANGA_DATA || [];
  }

  isBookmarked(mangaId: string): boolean {
    if (!mangaId) return false;
    const bookmarks = StorageService.getSync<string[]>('manga_bookmarks', []);
    return bookmarks.includes(mangaId);
  }

  toggleBookmark(mangaId: string): boolean {
    if (!mangaId) return false;
    let bookmarks = StorageService.getSync<string[]>('manga_bookmarks', []);
    const isBookmarked = bookmarks.includes(mangaId);
    if (isBookmarked) {
      bookmarks = bookmarks.filter(id => id !== mangaId);
    } else {
      bookmarks.push(mangaId);
    }
    StorageService.setItem('manga_bookmarks', bookmarks);
    return !isBookmarked;
  }

  saveReadingHistory(mangaId: string, chapterId: string, chapterTitle: string, pageIndex = 0): void {
    if (!mangaId) return;
    try {
      const history = StorageService.getSync<Record<string, ReadingHistoryItem>>('reading_history', {});
      history[mangaId] = {
        chapterId: chapterId,
        chapterTitle: chapterTitle,
        updatedAt: new Date().toISOString(),
        pageIndex: Math.max(0, pageIndex)
      };
      StorageService.setItem('reading_history', history);
    } catch (e) {}
  }

  getReadingHistory(mangaId: string): ReadingHistoryItem | null {
    if (!mangaId) return null;
    try {
      const history = StorageService.getSync<Record<string, ReadingHistoryItem>>('reading_history', {});
      return history[mangaId] || null;
    } catch (e) {
      return null;
    }
  }

  async addCustomManga(mangaObj: Manga, adminPassword?: string): Promise<void> {
    if (SheetDatabase && SheetDatabase.apiUrl) {
      try {
        await SheetDatabase.saveMangaToSheet(mangaObj, adminPassword);
        alert('✅ Đã đăng truyện thành công lên Google Sheet!');
        setTimeout(() => {
          this.syncGoogleSheetData(true);
        }, 1200);
      } catch (err: any) {
        alert('❌ Không thể lưu vào Google Sheet:\n\n' + (err.message || err));
        throw err;
      }
    } else {
      alert('⚠️ Chưa kết nối Google Sheet Database!');
      throw new Error('Chưa kết nối Google Sheet Database');
    }
  }

  async updateManga(mangaObj: Manga, adminPassword?: string): Promise<void> {
    if (SheetDatabase && SheetDatabase.apiUrl) {
      try {
        await SheetDatabase.saveMangaToSheet(mangaObj, adminPassword);
        alert('✅ Đã lưu thay đổi thành công lên Google Sheet!');
        setTimeout(() => {
          this.syncGoogleSheetData(true);
        }, 1000);
      } catch (err: any) {
        alert('❌ Không thể lưu vào Google Sheet:\n\n' + (err.message || err));
        throw err;
      }
    } else {
      alert('⚠️ Chưa kết nối Google Sheet Database!');
      throw new Error('Chưa kết nối Google Sheet Database');
    }
  }

  openAddChapterModal(manga: Manga): void {
    if (this.addChapterModalComponent) {
      this.addChapterModalComponent.open(manga);
    }
  }

  openEditChapterModal(manga: Manga, chapter: any): void {
    if (this.editChapterModalComponent) {
      this.editChapterModalComponent.open(manga, chapter);
    }
  }

  openEditMangaModal(manga: Manga): void {
    if (this.editMangaModalComponent) {
      this.editMangaModalComponent.open(manga);
    }
  }

  async init(): Promise<void> {
    // Khởi tạo PWA & Service Worker
    PwaService.init();

    // Initialize components
    this.readerComponent = new ReaderComponent(this);

    this.libraryComponent = new LibraryComponent(
      this,
      (manga) => this.libraryComponent.showDetailView(manga),
      (manga, chapterId) => this.readerComponent.open(manga, chapterId)
    );

    this.importModalComponent = new ImportModalComponent(
      this,
      (newManga) => {
        this.libraryComponent.renderCatalog();
        this.libraryComponent.showDetailView(newManga);
      }
    );

    this.addChapterModalComponent = new AddChapterModalComponent(
      this,
      (manga) => {
        this.libraryComponent.showDetailView(manga);
      }
    );

    this.editChapterModalComponent = new EditChapterModalComponent(
      this,
      (manga) => {
        this.libraryComponent.showDetailView(manga);
      }
    );

    this.editMangaModalComponent = new EditMangaModalComponent(
      this,
      (updatedManga) => {
        this.libraryComponent.renderCatalog();
        this.libraryComponent.showDetailView(updatedManga);
      }
    );

    // Initialize SPA Router
    this.router = new AppRouter(this);

    // Bind Header Buttons
    document.getElementById('brand-home-link')?.addEventListener('click', () => {
      if (this.router) {
        this.router.goHome();
      } else {
        document.getElementById('detail-view')?.classList.add('hidden');
        document.getElementById('library-view')?.classList.remove('hidden');
        this.libraryComponent.renderCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.getElementById('btn-sync-live-data')?.addEventListener('click', () => {
      this.syncGoogleSheetData(true);
    });

    document.getElementById('btn-open-import')?.addEventListener('click', () => {
      this.importModalComponent.open();
    });

    document.getElementById('btn-open-config-sheet')?.addEventListener('click', () => {
      const currentUrl = SheetDatabase.apiUrl;
      const inputUrl = prompt(
        'Nhập Web App URL của Google Apps Script (dùng Google Sheet làm Database):\n\nVí dụ: https://script.google.com/macros/s/AKfycbx.../exec',
        currentUrl
      );
      if (inputUrl !== null) {
        SheetDatabase.setApiUrl(inputUrl);
        alert('Đã lưu URL Google Apps Script! Trang web sẽ tự động đồng bộ dữ liệu với Google Sheet.');
        this.syncGoogleSheetData(true);
      }
    });

    // Keyboard shortcut '/' for search focusing
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (e.key === '/' && activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
    });

    // Initial render
    this.libraryComponent.renderCatalog();

    // Sync live Google Sheet data in background on every page load (Stale-While-Revalidate)
    this.syncGoogleSheetData(false);
  }

  async syncGoogleSheetData(force = false): Promise<void> {
    const syncIcon = document.getElementById('icon-sync-data');
    if (syncIcon) syncIcon.classList.add('fa-spin');

    const now = Date.now();

    if (SheetDatabase && SheetDatabase.apiUrl) {
      try {
        const liveData = await SheetDatabase.fetchMangaCatalog(force);
        if (liveData && liveData.length > 0) {
          this.sheetMangaList = liveData;
          StorageService.setItem('sheet_manga_cache', liveData);
          StorageService.setItem('sheet_manga_sync_time', String(now));

          // Cập nhật lại view hiện tại (Library, Detail hoặc Reader) với dữ liệu mới nhất
          if (this.router) {
            this.router.handleRoute();
          } else if (this.libraryComponent) {
            this.libraryComponent.renderCatalog();
          }
        }
      } catch (err) {
        console.warn('Lỗi đồng bộ Google Sheet:', err);
      } finally {
        if (syncIcon) {
          setTimeout(() => {
            syncIcon.classList.remove('fa-spin');
          }, 400);
        }
      }
    } else {
      if (syncIcon) syncIcon.classList.remove('fa-spin');
    }
  }
}

// Instantiate App when DOM is ready
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    (window as any).app = new MangaApp();
  });
}
