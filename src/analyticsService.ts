/**
 * Web Analytics & Telemetry Service for DriveManga
 * Tích hợp Google Analytics 4 (GA4), Firebase Analytics và Custom Metrics
 * Theo dõi hành trình độc giả: Lượt xem trang SPA, thời lượng đọc, hoàn thành chương, chế độ đọc.
 */

export interface AnalyticsEventParams {
  [key: string]: string | number | boolean | undefined;
}

export class AnalyticsService {
  private static measurementId = 'G-TTNTCZ25T7';
  private static readingSessionStartTime: number | null = null;
  private static currentReadingChapter: { mangaId: string; chapterId: string } | null = null;

  /**
   * Khởi tạo hoặc kích hoạt lắng nghe Google Analytics
   */
  public static init(): void {
    if (typeof window === 'undefined') return;

    // Kiểm tra và khởi tạo dataLayer cho gtag
    (window as any).dataLayer = (window as any).dataLayer || [];
    if (typeof (window as any).gtag !== 'function') {
      (window as any).gtag = function () {
        (window as any).dataLayer.push(arguments);
      };
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', this.measurementId, {
        send_page_view: false // Quản lý pageview thủ công cho SPA Router
      });
    }
  }

  /**
   * Bắn sự kiện tổng quát đến Google Analytics 4 & Telemetry
   */
  public static logEvent(eventName: string, params: AnalyticsEventParams = {}): void {
    if (typeof window === 'undefined') return;

    try {
      if (typeof (window as any).gtag === 'function') {
        (window as any).gtag('event', eventName, params);
      }

      if ((window as any).firebase && typeof (window as any).firebase.analytics === 'function') {
        (window as any).firebase.analytics().logEvent(eventName, params);
      }
    } catch (e) {
      console.warn('Lỗi ghi nhận analytics event:', e);
    }
  }

  /**
   * Theo dõi lượt xem trang trong ứng dụng Single Page App (SPA Pageview)
   */
  public static trackPageView(pagePath: string, pageTitle?: string): void {
    if (typeof window === 'undefined') return;
    const title = pageTitle || document.title;
    const path = pagePath.startsWith('/') ? pagePath : '/' + pagePath;

    this.logEvent('page_view', {
      page_title: title,
      page_location: window.location.href,
      page_path: path
    });
  }

  /**
   * Theo dõi khi độc giả mở xem trang chi tiết truyện
   */
  public static trackMangaView(mangaId: string, mangaTitle: string, genres?: string[]): void {
    this.logEvent('view_manga_detail', {
      manga_id: mangaId,
      manga_title: mangaTitle,
      genres: genres ? genres.join(', ') : 'Chưa phân loại'
    });
  }

  /**
   * Theo dõi khi độc giả bắt đầu đọc một chương truyện
   */
  public static trackChapterStart(mangaId: string, chapterId: string, chapterTitle: string, readingMode: string): void {
    // Kết thúc phiên đọc trước đó nếu có
    this.trackChapterEnd();

    this.readingSessionStartTime = Date.now();
    this.currentReadingChapter = { mangaId, chapterId };

    this.logEvent('read_chapter_start', {
      manga_id: mangaId,
      chapter_id: chapterId,
      chapter_title: chapterTitle,
      reading_mode: readingMode
    });
  }

  /**
   * Theo dõi khi độc giả hoàn thành chương (đọc đến trang cuối)
   */
  public static trackChapterComplete(mangaId: string, chapterId: string, totalPages: number): void {
    const durationSeconds = this.readingSessionStartTime 
      ? Math.round((Date.now() - this.readingSessionStartTime) / 1000) 
      : 0;

    this.logEvent('read_chapter_complete', {
      manga_id: mangaId,
      chapter_id: chapterId,
      total_pages: totalPages,
      read_duration_seconds: durationSeconds
    });
  }

  /**
   * Ghi nhận kết thúc phiên đọc
   */
  public static trackChapterEnd(): void {
    if (this.currentReadingChapter && this.readingSessionStartTime) {
      const durationSeconds = Math.round((Date.now() - this.readingSessionStartTime) / 1000);
      if (durationSeconds > 5) {
        this.logEvent('reading_session_duration', {
          manga_id: this.currentReadingChapter.mangaId,
          chapter_id: this.currentReadingChapter.chapterId,
          duration_seconds: durationSeconds
        });
      }
    }
    this.readingSessionStartTime = null;
    this.currentReadingChapter = null;
  }

  /**
   * Theo dõi chuyển đổi chế độ đọc (Webtoon vs Manga lật trang)
   */
  public static trackReadingModeChange(newMode: string): void {
    this.logEvent('change_reading_mode', {
      new_reading_mode: newMode
    });
  }

  /**
   * Theo dõi tìm kiếm truyện
   */
  public static trackSearch(query: string, resultCount: number): void {
    if (!query || query.trim().length === 0) return;
    this.logEvent('search_catalog', {
      search_term: query.trim(),
      result_count: resultCount
    });
  }
}

if (typeof window !== 'undefined') {
  (window as any).AnalyticsService = AnalyticsService;
  AnalyticsService.init();
}
