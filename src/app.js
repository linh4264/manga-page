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
    // Chỉ trả về dữ liệu lấy trực tiếp từ Google Sheet
    return this.sheetMangaList;
  }

  async addCustomManga(mangaObj, adminPassword) {
    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      await window.SheetDatabase.saveMangaToSheet(mangaObj, adminPassword);
      alert('✅ Đã đăng truyện thành công lên Google Sheet!');
      setTimeout(() => {
        this.syncGoogleSheetData();
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
        this.syncGoogleSheetData();
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

  async syncGoogleSheetData() {
    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      const liveData = await window.SheetDatabase.fetchMangaCatalog();
      if (liveData && liveData.length > 0) {
        this.sheetMangaList = liveData;
        try {
          localStorage.setItem('sheet_manga_cache', JSON.stringify(liveData));
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
