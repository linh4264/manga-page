class MangaApp {
  constructor() {
    this.customMangaList = JSON.parse(localStorage.getItem('custom_manga_list') || '[]');
    
    this.libraryComponent = null;
    this.readerComponent = null;
    this.importModalComponent = null;

    this.init();
  }

  getAllManga() {
    return [...this.customMangaList, ...(window.SAMPLE_MANGA_DATA || [])];
  }

  addCustomManga(mangaObj) {
    this.customMangaList.unshift(mangaObj);
    localStorage.setItem('custom_manga_list', JSON.stringify(this.customMangaList));
    if (this.libraryComponent) {
      this.libraryComponent.renderCatalog();
    }
  }

  init() {
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
  }
}

// Instantiate App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new MangaApp();
});
