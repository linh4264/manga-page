class MangaApp {
  constructor() {
    this.customMangaList = JSON.parse(localStorage.getItem('custom_manga_list') || '[]');
    this.sheetMangaList = [];
    
    this.libraryComponent = null;
    this.readerComponent = null;
    this.importModalComponent = null;

    this.init();
  }

  getAllManga() {
    return [...this.customMangaList, ...this.sheetMangaList, ...(window.SAMPLE_MANGA_DATA || [])];
  }

  async addCustomManga(mangaObj) {
    this.customMangaList.unshift(mangaObj);
    localStorage.setItem('custom_manga_list', JSON.stringify(this.customMangaList));
    
    if (this.libraryComponent) {
      this.libraryComponent.renderCatalog();
    }

    // Attempt to save to Google Sheets Cloud Database if URL configured
    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      await window.SheetDatabase.saveMangaToSheet(mangaObj);
      alert('✅ Đã thêm truyện thành công và tự động đẩy dữ liệu sang Google Sheet!');
    } else {
      alert('⚠️ Đã thêm truyện vào bộ nhớ trình duyệt! (Để đồng bộ sang Google Sheet công khai, hãy bấm nút "Kết nối Google Sheet" trên menu để dán Web App URL).');
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

    // Bind Header Buttons
    document.getElementById('brand-home-link')?.addEventListener('click', () => {
      document.getElementById('detail-view').classList.add('hidden');
      document.getElementById('library-view').classList.remove('hidden');
      this.libraryComponent.renderCatalog();
      window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // Sync live Google Sheet data
    await this.syncGoogleSheetData();
  }

  async syncGoogleSheetData() {
    if (window.SheetDatabase && window.SheetDatabase.apiUrl) {
      const liveData = await window.SheetDatabase.fetchMangaCatalog();
      if (liveData && liveData.length > 0) {
        this.sheetMangaList = liveData;
        if (this.libraryComponent) {
          this.libraryComponent.renderCatalog();
        }
      }
    }
  }
}

// Instantiate App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MangaApp();
});
