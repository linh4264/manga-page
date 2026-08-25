class MangaApp {
  constructor() {
    this.customMangaList = JSON.parse(localStorage.getItem('custom_manga_list') || '[]');
    let cached = [];
    try {
      cached = JSON.parse(localStorage.getItem('sheet_manga_cache') || '[]');
    } catch (e) {
      cached = [];
    }
    this.sheetMangaList = cached;
    
    this.libraryComponent = null;
    this.readerComponent = null;
    this.importModalComponent = null;

    this.init();
  }

  getAllManga() {
    // 1. Ưu tiên dữ liệu tải từ Google Sheet trong phiên hiện tại
    if (this.sheetMangaList && this.sheetMangaList.length > 0) {
      return this.sheetMangaList;
    }
    // 2. Dự phòng bộ nhớ đệm Cache LocalStorage
    try {
      const cached = JSON.parse(localStorage.getItem('sheet_manga_cache') || '[]');
      if (cached && cached.length > 0) {
        return cached;
      }
    } catch (e) {}
    // 3. Dự phòng danh mục tĩnh sampleManga khi mất mạng hoặc API Google Sheet nghẽn
    return window.SAMPLE_MANGA_DATA || [];
  }

  isBookmarked(mangaId) {
    if (!mangaId) return false;
    const bookmarks = JSON.parse(localStorage.getItem('manga_bookmarks') || '[]');
    return bookmarks.includes(mangaId);
  }

  toggleBookmark(mangaId) {
    if (!mangaId) return false;
    let bookmarks = JSON.parse(localStorage.getItem('manga_bookmarks') || '[]');
    const isBookmarked = bookmarks.includes(mangaId);
    if (isBookmarked) {
      bookmarks = bookmarks.filter(id => id !== mangaId);
    } else {
      bookmarks.push(mangaId);
    }
    localStorage.setItem('manga_bookmarks', JSON.stringify(bookmarks));
    return !isBookmarked;
  }

  saveReadingHistory(mangaId, chapterId, chapterTitle) {
    if (!mangaId) return;
    try {
      const history = JSON.parse(localStorage.getItem('reading_history') || '{}');
      history[mangaId] = {
        chapterId: chapterId,
        chapterTitle: chapterTitle,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('reading_history', JSON.stringify(history));
    } catch (e) {}
  }

  getReadingHistory(mangaId) {
    if (!mangaId) return null;
    try {
      const history = JSON.parse(localStorage.getItem('reading_history') || '{}');
      return history[mangaId] || null;
    } catch (e) {
      return null;
    }
  }

  getComments(chapterId) {
    if (!chapterId) return [];
    try {
      const allComments = JSON.parse(localStorage.getItem('chapter_comments') || '{}');
      return allComments[chapterId] || [];
    } catch (e) {
      return [];
    }
  }

  addComment(chapterId, author, text) {
    if (!chapterId || !text) return;
    try {
      const allComments = JSON.parse(localStorage.getItem('chapter_comments') || '{}');
      if (!allComments[chapterId]) allComments[chapterId] = [];
      allComments[chapterId].unshift({
        author: author || 'Độc giả',
        text: text,
        timestamp: 'Vừa xong'
      });
      localStorage.setItem('chapter_comments', JSON.stringify(allComments));
    } catch (e) {}
  }

  async addCustomManga(mangaObj, adminPassword) {
    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      await window.SheetDatabase.saveMangaToSheet(mangaObj, adminPassword);
      alert('✅ Đã đăng truyện thành công lên Google Sheet!');
      setTimeout(() => {
        this.syncGoogleSheetData(true);
      }, 1200);
    } else {
      alert('⚠️ Chưa kết nối Google Sheet Database!');
    }
  }

  async updateManga(mangaObj, adminPassword) {
    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      await window.SheetDatabase.saveMangaToSheet(mangaObj, adminPassword);
      alert('✅ Đã lưu thay đổi thành công lên Google Sheet!');
      setTimeout(() => {
        this.syncGoogleSheetData(true);
      }, 1000);
    } else {
      alert('⚠️ Chưa kết nối Google Sheet Database!');
    }
  }

  openAddChapterModal(manga) {
    if (this.addChapterModalComponent) {
      this.addChapterModalComponent.open(manga);
    }
  }

  openEditChapterModal(manga, chapter) {
    if (this.editChapterModalComponent) {
      this.editChapterModalComponent.open(manga, chapter);
    }
  }

  openEditMangaModal(manga) {
    if (this.editMangaModalComponent) {
      this.editMangaModalComponent.open(manga);
    }
  }

  async init() {
    // Initialize components
    this.readerComponent = new window.ReaderComponent(this);

    this.libraryComponent = new window.LibraryComponent(
      this,
      (manga) => this.libraryComponent.showDetailView(manga),
      (manga, chapterId) => this.readerComponent.open(manga, chapterId)
    );

    this.importModalComponent = new window.ImportModalComponent(
      this,
      (newManga) => {
        this.libraryComponent.renderCatalog();
        this.libraryComponent.showDetailView(newManga);
      }
    );

    this.addChapterModalComponent = new window.AddChapterModalComponent(
      this,
      (manga, newChapter) => {
        this.libraryComponent.showDetailView(manga);
      }
    );

    this.editChapterModalComponent = new window.EditChapterModalComponent(
      this,
      (manga, updatedChapter) => {
        this.libraryComponent.showDetailView(manga);
      }
    );

    this.editMangaModalComponent = new window.EditMangaModalComponent(
      this,
      (updatedManga) => {
        this.libraryComponent.renderCatalog();
        this.libraryComponent.showDetailView(updatedManga);
      }
    );

    // Initialize SPA Router
    this.router = new window.AppRouter(this);

    // Bind Header Buttons
    document.getElementById('brand-home-link')?.addEventListener('click', () => {
      if (this.router) {
        this.router.goHome();
      } else {
        document.getElementById('detail-view').classList.add('hidden');
        document.getElementById('library-view').classList.remove('hidden');
        this.libraryComponent.renderCatalog();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    document.getElementById('btn-open-import')?.addEventListener('click', () => {
      this.importModalComponent.open();
    });

    document.getElementById('btn-open-config-sheet')?.addEventListener('click', () => {
      const currentUrl = window.SheetDatabase.apiUrl;
      const inputUrl = prompt(
        'Nhập Web App URL của Google Apps Script (dùng Google Sheet làm Database):\n\nVí dụ: https://script.google.com/macros/s/AKfycbx.../exec',
        currentUrl
      );
      if (inputUrl !== null) {
        window.SheetDatabase.setApiUrl(inputUrl);
        alert('Đã lưu URL Google Apps Script! Trang web sẽ tự động đồng bộ dữ liệu với Google Sheet.');
        this.syncGoogleSheetData();
      }
    });

    // Keyboard shortcut '/' for search focusing
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
    });

    // Initial render
    this.libraryComponent.renderCatalog();

    // Sync live Google Sheet data & handle initial URL Route
    this.syncGoogleSheetData();
  }

  async syncGoogleSheetData(force = false) {
    const lastSyncTime = parseInt(localStorage.getItem('sheet_manga_sync_time') || '0', 10);
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000; // 5 phút cooldown tránh nghẽn Google Apps Script khi có nhiều người truy cập

    // Nếu không bắt buộc và cache còn mới (< 5 phút) và đã có data -> Dùng luôn cache
    if (!force && (now - lastSyncTime < CACHE_TTL) && this.sheetMangaList && this.sheetMangaList.length > 0) {
      if (this.router) {
        this.router.handleRoute();
      }
      return;
    }

    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      const liveData = await window.SheetDatabase.fetchMangaCatalog();
      if (liveData && liveData.length > 0) {
        this.sheetMangaList = liveData;
        try {
          localStorage.setItem('sheet_manga_cache', JSON.stringify(liveData));
          localStorage.setItem('sheet_manga_sync_time', String(now));
        } catch (e) {
          console.warn('Cannot write catalog to localStorage cache:', e);
        }
        if (this.libraryComponent) {
          this.libraryComponent.renderCatalog();
        }
      }
    }
    // Handle URL routing after data sync
    if (this.router) {
      this.router.handleRoute();
    }
  }
}

// Instantiate App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MangaApp();
});
