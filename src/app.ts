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

    document.getElementById('btn-export-catalog-json')?.addEventListener('click', () => {
      SheetDatabase.exportCatalogJson(this.getAllManga());
    });

    document.getElementById('btn-open-import')?.addEventListener('click', () => {
      this.importModalComponent.open();
    });

    document.getElementById('btn-open-config-sheet')?.addEventListener('click', async () => {
      const currentUrl = SheetDatabase.apiUrl;
      const inputUrl = prompt(
        'Nhập Web App URL của Google Apps Script (dùng Google Sheet làm Database):\n\nVí dụ: https://script.google.com/macros/s/AKfycbx.../exec',
        currentUrl
      );
      if (inputUrl !== null && inputUrl.trim()) {
        const testRes = await SheetDatabase.testConnection(inputUrl);
        if (testRes.ok) {
          SheetDatabase.setApiUrl(inputUrl);
          alert(`✅ ${testRes.message} (Phiên bản Script: ${testRes.version || '2.0'})`);
          this.syncGoogleSheetData(true);
        } else {
          const confirmSave = confirm(`⚠️ Không thể kết nối với Script:\n${testRes.message}\n\nBạn vẫn muốn lưu URL này chứ?`);
          if (confirmSave) {
            SheetDatabase.setApiUrl(inputUrl);
            this.syncGoogleSheetData(true);
          }
        }
      }
    });

    // DMCA Legal Modal Listeners
    const dmcaModal = document.getElementById('modal-dmca');
    document.getElementById('btn-open-dmca-modal')?.addEventListener('click', (e) => {
      e.preventDefault();
      dmcaModal?.classList.remove('hidden');
    });
    document.getElementById('btn-close-dmca-modal')?.addEventListener('click', () => {
      dmcaModal?.classList.add('hidden');
    });
    document.getElementById('btn-close-dmca-modal-bottom')?.addEventListener('click', () => {
      dmcaModal?.classList.add('hidden');
    });
    dmcaModal?.addEventListener('click', (e) => {
      if (e.target === dmcaModal) dmcaModal.classList.add('hidden');
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

    // Tải trước dữ liệu tĩnh nếu lần đầu truy cập chưa có cache
    if (!this.sheetMangaList || this.sheetMangaList.length === 0) {
      const cached = StorageService.getSync<Manga[]>('sheet_manga_cache', []);
      if (cached && cached.length > 0) {
        this.sheetMangaList = cached;
      } else {
        const staticCatalog = await SheetDatabase.fetchStaticCatalog();
        if (staticCatalog && staticCatalog.length > 0) {
          this.sheetMangaList = staticCatalog;
          StorageService.setItem('sheet_manga_cache', staticCatalog);
        }
      }
    }

    // Initial render
    this.libraryComponent.renderCatalog();

    // Sync live Google Sheet data in background on every page load (Stale-While-Revalidate)
    this.syncGoogleSheetData(false);

    // Tự động đồng bộ ngầm khi người dùng quay lại tab sau một khoảng thời gian
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          const lastSync = StorageService.getSync<string | null>('sheet_manga_sync_time', null);
          if (lastSync) {
            const age = Date.now() - parseInt(lastSync, 10);
            if (age >= SheetDatabase.AUTO_SYNC_THROTTLE_MS) {
              this.syncGoogleSheetData(false);
            }
          } else {
            this.syncGoogleSheetData(false);
          }
        }
      });
    }
  }

  async syncGoogleSheetData(force = false): Promise<void> {
    const syncIcon = document.getElementById('icon-sync-data');
    if (syncIcon) syncIcon.classList.add('fa-spin');

    const now = Date.now();

    if (SheetDatabase && SheetDatabase.apiUrl) {
      try {
        const liveData = await SheetDatabase.fetchMangaCatalog(force);
        if (liveData && liveData.length > 0) {
          const isDifferent = JSON.stringify(this.sheetMangaList) !== JSON.stringify(liveData);

          this.sheetMangaList = liveData;
          StorageService.setItem('sheet_manga_cache', liveData);
          StorageService.setItem('sheet_manga_sync_time', String(now));

          // Chỉ cập nhật lại giao diện nếu có dữ liệu mới hoặc người dùng yêu cầu force sync
          if (isDifferent || force) {
            const isReaderOpen = document.getElementById('reader-wrapper') && !document.getElementById('reader-wrapper')?.classList.contains('hidden');
            const isDetailOpen = document.getElementById('detail-view') && !document.getElementById('detail-view')?.classList.contains('hidden');

            if (isReaderOpen && this.readerComponent && this.readerComponent.currentManga) {
              // Đang trong màn hình đọc: Cập nhật object manga và dropdown chọn chương
              // TUYỆT ĐỐI KHÔNG gọi router.handleRoute() để tránh reset cuộn hoặc tải lại ảnh
              const updatedManga = liveData.find(m => m.id === this.readerComponent.currentManga?.id);
              if (updatedManga) {
                this.readerComponent.currentManga = updatedManga;
                if (this.readerComponent.readerChapterSelect) {
                  const currentChapterId = this.readerComponent.currentChapter?.id;
                  this.readerComponent.readerChapterSelect.innerHTML = '';
                  updatedManga.chapters?.forEach(ch => {
                    const opt = document.createElement('option');
                    opt.value = ch.id;
                    opt.textContent = ch.title;
                    if (ch.id === currentChapterId) opt.selected = true;
                    this.readerComponent.readerChapterSelect?.appendChild(opt);
                  });
                }
              }
            } else if (isDetailOpen && this.libraryComponent) {
              // Đang xem chi tiết truyện: Cập nhật lại view chi tiết với thông tin và danh sách chương mới
              const parts = this.router ? this.router.getRouteParts() : [];
              const currentMangaId = parts[0];
              const targetManga = liveData.find(m => m.id === currentMangaId || m.title.toLowerCase().replace(/\s+/g, '-') === currentMangaId?.toLowerCase());
              if (targetManga) {
                this.libraryComponent.showDetailView(targetManga, false);
              }
            } else {
              // Đang ở thư viện / trang chủ: Cập nhật bộ lọc thể loại và lưới truyện
              if (this.libraryComponent) {
                this.libraryComponent.setupGenreFilter();
                this.libraryComponent.renderCatalog();
              }
            }
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
