/**
 * Simple SPA Router supporting clean path URLs (/:id and /:id/:chapterId)
 * with hash fallback (/#/:id and /#/:id/:chapterId) for static file hosting compatibility.
 */

window.AppRouter = class AppRouter {
  constructor(app) {
    this.app = app;
    this.init();
  }

  init() {
    window.addEventListener('popstate', () => this.handleRoute());
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  /**
   * Get clean path parts array: [] for home, [mangaId] for detail, [mangaId, chapterId] for reader
   */
  getRouteParts() {
    let rawPath = '';
    
    // Check hash route first if available
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      rawPath = window.location.hash.substring(2);
    } else {
      rawPath = window.location.pathname;
      if (rawPath.startsWith('/')) {
        rawPath = rawPath.substring(1);
      }
    }

    // Filter out index.html if present
    if (rawPath.startsWith('index.html')) {
      rawPath = rawPath.replace(/^index\.html\/?/, '');
    }

    const cleanParts = rawPath.split('/').map(p => decodeURIComponent(p.trim())).filter(p => p.length > 0);
    return cleanParts;
  }

  /**
   * Update browser address bar using Hash Routing (/#/:id and /#/:id/:chapterId)
   * to guarantee ZERO 404 errors when reloading (F5) on any static web server or host.
   */
  pushRoute(path) {
    const targetPath = path.startsWith('/') ? path : '/' + path;
    window.location.hash = '#' + targetPath;
  }

  /**
   * Navigate to Home
   */
  goHome() {
    this.pushRoute('/');
    this.handleRoute();
  }

  /**
   * Navigate to Manga DetailView (/:mangaId)
   */
  goManga(mangaId) {
    if (!mangaId) return;
    this.pushRoute(`/${mangaId}`);
    this.handleRoute();
  }

  /**
   * Navigate to Chapter Reader (/:mangaId/:chapterId)
   */
  goChapter(mangaId, chapterId) {
    if (!mangaId || !chapterId) return;
    this.pushRoute(`/${mangaId}/${chapterId}`);
    this.handleRoute();
  }

  /**
   * Parse current URL and render the target view
   */
  handleRoute() {
    const parts = this.getRouteParts();
    const allManga = this.app.getAllManga();

    if (parts.length === 0) {
      // Route / -> Show Catalog
      document.getElementById('reader-wrapper')?.classList.add('hidden');
      document.getElementById('detail-view')?.classList.add('hidden');
      document.getElementById('library-view')?.classList.remove('hidden');
      if (this.app.libraryComponent) {
        this.app.libraryComponent.renderCatalog();
      }
      return;
    }

    const mangaId = parts[0];
    const targetManga = allManga.find(m => m.id === mangaId || m.title.toLowerCase().replace(/\s+/g, '-') === mangaId.toLowerCase());

    if (!targetManga) {
      // Manga not found -> fallback to Home
      console.warn(`Không tìm thấy bộ truyện có ID: ${mangaId}`);
      document.getElementById('detail-view')?.classList.add('hidden');
      document.getElementById('library-view')?.classList.remove('hidden');
      return;
    }

    if (parts.length === 1) {
      // Route /:id -> Show Detail View
      document.getElementById('reader-wrapper')?.classList.add('hidden');
      document.getElementById('library-view')?.classList.add('hidden');
      document.getElementById('detail-view')?.classList.remove('hidden');
      if (this.app.libraryComponent) {
        this.app.libraryComponent.showDetailView(targetManga, false); // false = don't push state again
      }
    } else if (parts.length >= 2) {
      // Route /:id/:chapterId -> Show Reader View
      const chapterId = parts[1];
      if (this.app.readerComponent) {
        this.app.readerComponent.open(targetManga, chapterId, false); // false = don't push state again
      }
    }
  }
};
