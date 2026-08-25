/**
 * Dynamic SEO & OpenGraph & Schema.org JSON-LD Manager for DriveManga
 * Tự động cập nhật tiêu đề trang, meta description, thẻ OpenGraph (Facebook/Zalo),
 * Twitter Cards, Canonical URLs và Structured Data (JSON-LD) theo chuẩn Google Search.
 */

import { Manga, Chapter } from './types/manga';
import { DriveHelper } from './driveHelper';

export class SeoHelper {
  private static defaultTitle = 'DriveManga - Đọc Truyện Tranh Online Miễn Phí Tốc Độ Cao';
  private static defaultDescription = 'Trình đọc truyện tranh Manga, Webtoon và Comic trực tuyến miễn phí tốc độ cao, hỗ trợ hiệu ứng lật trang 2D/3D Canvas mượt mà, lưu trữ trên Google Drive & Cloudflare CDN.';
  private static siteName = 'DriveManga';
  private static jsonLdScriptId = 'drivemanga-schema-jsonld';

  /**
   * Cập nhật thẻ meta hoặc tạo mới nếu chưa tồn tại
   */
  private static setMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
    if (typeof document === 'undefined') return;
    let el = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  /**
   * Cập nhật thẻ link canonical
   */
  private static setCanonical(url: string): void {
    if (typeof document === 'undefined') return;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  /**
   * Nhúng cấu trúc dữ liệu Schema.org JSON-LD vào thẻ <head>
   */
  private static setStructuredData(schemaObj: Record<string, any>): void {
    if (typeof document === 'undefined') return;
    let script = document.getElementById(this.jsonLdScriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = this.jsonLdScriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schemaObj, null, 2);
  }

  /**
   * Thiết lập SEO cho Trang chủ / Thư viện (Home & Library)
   */
  public static setHomeSEO(): void {
    if (typeof document === 'undefined') return;
    const currentUrl = window.location.origin + window.location.pathname;

    document.title = this.defaultTitle;
    this.setMetaTag('name', 'description', this.defaultDescription);
    this.setCanonical(currentUrl);

    // OpenGraph
    this.setMetaTag('property', 'og:title', this.defaultTitle);
    this.setMetaTag('property', 'og:description', this.defaultDescription);
    this.setMetaTag('property', 'og:type', 'website');
    this.setMetaTag('property', 'og:url', currentUrl);
    this.setMetaTag('property', 'og:site_name', this.siteName);

    // Twitter Card
    this.setMetaTag('name', 'twitter:card', 'summary_large_image');
    this.setMetaTag('name', 'twitter:title', this.defaultTitle);
    this.setMetaTag('name', 'twitter:description', this.defaultDescription);

    // Schema.org WebSite & Organization
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${currentUrl}#website`,
          'url': currentUrl,
          'name': this.siteName,
          'description': this.defaultDescription,
          'inLanguage': 'vi-VN'
        },
        {
          '@type': 'Organization',
          '@id': `${currentUrl}#organization`,
          'name': this.siteName,
          'url': currentUrl
        }
      ]
    });
  }

  /**
   * Thiết lập SEO cho Trang chi tiết bộ truyện (Manga Detail)
   */
  public static setMangaDetailSEO(manga: Manga): void {
    if (typeof document === 'undefined' || !manga) return;
    const currentUrl = window.location.href;
    const pageTitle = `${manga.title} - Đọc Truyện Tranh Online | ${this.siteName}`;
    const desc = manga.description 
      ? `${manga.description.slice(0, 160)}... Đọc truyện ${manga.title} mới nhất tại ${this.siteName}.`
      : `Đọc truyện tranh ${manga.title} miễn phí tốc độ cao, cập nhật nhanh nhất tại ${this.siteName}.`;

    const coverUrl = manga.coverUrl || (manga.coverDriveId ? `https://lh3.googleusercontent.com/d/${manga.coverDriveId}=w800` : '');

    document.title = pageTitle;
    this.setMetaTag('name', 'description', desc);
    this.setCanonical(currentUrl);

    // OpenGraph
    this.setMetaTag('property', 'og:title', pageTitle);
    this.setMetaTag('property', 'og:description', desc);
    this.setMetaTag('property', 'og:type', 'book');
    this.setMetaTag('property', 'og:url', currentUrl);
    if (coverUrl) this.setMetaTag('property', 'og:image', coverUrl);

    // Twitter Card
    this.setMetaTag('name', 'twitter:card', 'summary_large_image');
    this.setMetaTag('name', 'twitter:title', pageTitle);
    this.setMetaTag('name', 'twitter:description', desc);
    if (coverUrl) this.setMetaTag('name', 'twitter:image', coverUrl);

    // Schema.org ComicSeries / Book
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@type': 'ComicSeries',
      'name': manga.title,
      'alternativeHeadline': manga.originalTitle || manga.title,
      'description': manga.description || desc,
      'image': coverUrl,
      'author': {
        '@type': 'Person',
        'name': manga.author || 'Đang cập nhật'
      },
      'genre': manga.genres || ['Manga', 'Webtoon'],
      'inLanguage': 'vi-VN',
      'numberOfEpisodes': manga.chapters?.length || 0
    });
  }

  /**
   * Thiết lập SEO cho Trình đọc chương (Chapter Reader)
   */
  public static setChapterReaderSEO(manga: Manga, chapter: Chapter): void {
    if (typeof document === 'undefined' || !manga || !chapter) return;
    const currentUrl = window.location.href;
    const pageTitle = `${manga.title} - ${chapter.title} | ${this.siteName}`;
    const desc = `Đọc truyện tranh ${manga.title} ${chapter.title} tiếng Việt online tốc độ cao, chế độ đọc Webtoon và Manga lật trang mượt mà tại ${this.siteName}.`;
    const coverUrl = manga.coverUrl || (manga.coverDriveId ? `https://lh3.googleusercontent.com/d/${manga.coverDriveId}=w800` : '');

    document.title = pageTitle;
    this.setMetaTag('name', 'description', desc);
    this.setCanonical(currentUrl);

    // OpenGraph
    this.setMetaTag('property', 'og:title', pageTitle);
    this.setMetaTag('property', 'og:description', desc);
    this.setMetaTag('property', 'og:type', 'article');
    this.setMetaTag('property', 'og:url', currentUrl);
    if (coverUrl) this.setMetaTag('property', 'og:image', coverUrl);

    // Twitter Card
    this.setMetaTag('name', 'twitter:card', 'summary_large_image');
    this.setMetaTag('name', 'twitter:title', pageTitle);
    this.setMetaTag('name', 'twitter:description', desc);
    if (coverUrl) this.setMetaTag('name', 'twitter:image', coverUrl);

    // Schema.org ComicIssue + Breadcrumbs
    this.setStructuredData({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'ComicIssue',
          'name': `${manga.title} - ${chapter.title}`,
          'isPartOf': {
            '@type': 'ComicSeries',
            'name': manga.title
          },
          'description': desc,
          'image': coverUrl,
          'inLanguage': 'vi-VN'
        },
        {
          '@type': 'BreadcrumbList',
          'itemListElement': [
            {
              '@type': 'ListItem',
              'position': 1,
              'name': 'Trang chủ',
              'item': window.location.origin
            },
            {
              '@type': 'ListItem',
              'position': 2,
              'name': manga.title,
              'item': `${window.location.origin}/#/${manga.id}`
            },
            {
              '@type': 'ListItem',
              'position': 3,
              'name': chapter.title,
              'item': currentUrl
            }
          ]
        }
      ]
    });
  }
}
