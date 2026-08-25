/**
 * Simple SPA Router supporting clean path URLs (/:id and /:id/:chapterId)
 * with hash fallback (/#/:id and /#/:id/:chapterId) for static file hosting compatibility.
 */

import { Manga } from './types/manga';
import { SeoHelper } from './seoHelper';
import { AnalyticsService } from './analyticsService';

export interface AppInstance {
  getAllManga: () => Manga[];
  libraryComponent?: any;
  readerComponent?: any;
}

export class AppRouter {
  app: AppInstance;

  constructor(app: AppInstance) {
    this.app = app;
    this.init();
  }

  init(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => this.handleRoute());
      window.addEventListener('hashchange', () => this.handleRoute());
    }
  }

  /**
   * Get clean path parts array: [] for home, [mangaId] for detail, [mangaId, chapterId] for reader
   */
  getRouteParts(): string[] {
    let rawPath = '';
    if (typeof window === 'undefined') return [];
    
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
   */
  pushRoute(path: string): void {
    if (typeof window === 'undefined') return;
    const targetPath = path.startsWith('/') ? path : '/' + path;
    window.location.hash = '#' + targetPath;
  }

  /**
   * Navigate to Home
   */
  goHome(): void {
    this.pushRoute('/');
    this.handleRoute();
  }

  /**
   * Alias to goHome
   */
  goLibrary(): void {
    this.goHome();
  }

  /**
   * Navigate to Manga DetailView (/:mangaId)
   */
  goManga(mangaId: string): void {
    if (!mangaId) return;
    this.pushRoute(`/${mangaId}`);
    this.handleRoute();
  }

  /**
   * Navigate to Chapter Reader (/:mangaId/:chapterId)
   */
  goChapter(mangaId: string, chapterId: string): void {
    if (!mangaId || !chapterId) return;
    this.pushRoute(`/${mangaId}/${chapterId}`);
    this.handleRoute();
  }

  /**
   * Parse current URL and render the target view with SEO and Analytics tracking
   */
  handleRoute(): void {
    const parts = this.getRouteParts();
    const allManga = this.app.getAllManga();

    if (parts.length === 0) {
      // Route / -> Show Catalog
      document.body.classList.remove('is-webtoon-reading');
      document.documentElement.classList.remove('is-webtoon-reading');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.getElementById('reader-wrapper')?.classList.add('hidden');
      document.getElementById('detail-view')?.classList.add('hidden');
      document.getElementById('library-view')?.classList.remove('hidden');
      document.querySelector('.view-container')?.classList.remove('hidden');
      document.querySelector('.app-header')?.classList.remove('hidden');
      if (this.app.libraryComponent) {
        this.app.libraryComponent.renderCatalog();
      }
      SeoHelper.setHomeSEO();
      AnalyticsService.trackPageView('/', 'DriveManga - Đọc Truyện Tranh Online');
      return;
    }

    const mangaId = parts[0];
    const targetManga = allManga.find(m => m.id === mangaId || m.title.toLowerCase().replace(/\s+/g, '-') === mangaId.toLowerCase());

    if (!targetManga) {
      // Manga not found -> fallback to Home
      console.warn(`Không tìm thấy bộ truyện có ID: ${mangaId}`);
      document.body.classList.remove('is-webtoon-reading');
      document.documentElement.classList.remove('is-webtoon-reading');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.getElementById('reader-wrapper')?.classList.add('hidden');
      document.getElementById('detail-view')?.classList.add('hidden');
      document.getElementById('library-view')?.classList.remove('hidden');
      document.querySelector('.view-container')?.classList.remove('hidden');
      document.querySelector('.app-header')?.classList.remove('hidden');
      SeoHelper.setHomeSEO();
      return;
    }

    if (parts.length === 1) {
      // Route /:id -> Show Detail View
      document.body.classList.remove('is-webtoon-reading');
      document.documentElement.classList.remove('is-webtoon-reading');
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.getElementById('reader-wrapper')?.classList.add('hidden');
      document.getElementById('library-view')?.classList.add('hidden');
      document.getElementById('detail-view')?.classList.remove('hidden');
      document.querySelector('.view-container')?.classList.remove('hidden');
      document.querySelector('.app-header')?.classList.remove('hidden');
      if (this.app.libraryComponent) {
        this.app.libraryComponent.showDetailView(targetManga, false);
      }
      SeoHelper.setMangaDetailSEO(targetManga);
      AnalyticsService.trackPageView(`/${targetManga.id}`, `${targetManga.title} - Chi Tiết Truyện`);
      AnalyticsService.trackMangaView(targetManga.id, targetManga.title, targetManga.genres);
    } else if (parts.length >= 2) {
      // Route /:id/:chapterId -> Show Reader View
      const chapterId = parts[1];
      document.getElementById('library-view')?.classList.add('hidden');
      document.getElementById('detail-view')?.classList.add('hidden');
      document.querySelector('.view-container')?.classList.add('hidden');
      document.querySelector('.app-header')?.classList.add('hidden');
      if (this.app.readerComponent) {
        this.app.readerComponent.open(targetManga, chapterId, false);
      }
      const currentChapter = targetManga.chapters?.find(c => c.id === chapterId) || targetManga.chapters?.[0];
      if (currentChapter) {
        SeoHelper.setChapterReaderSEO(targetManga, currentChapter);
        AnalyticsService.trackPageView(`/${targetManga.id}/${currentChapter.id}`, `${targetManga.title} - ${currentChapter.title}`);
        AnalyticsService.trackChapterStart(targetManga.id, currentChapter.id, currentChapter.title, 'webtoon');
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.AppRouter = AppRouter;
}
