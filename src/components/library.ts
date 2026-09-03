/**
 * Library Component: Renders manga grid catalog, genre filters, and manga detail view.
 */

import { Manga, Chapter } from '../types/manga';
import { DriveHelper } from '../driveHelper';
import { FirebaseService } from '../firebaseService';
import { StorageService } from '../storageService';
import { escapeHtml, sanitizeUrl } from '../utils/security';
import { OfflineService } from '../offlineService';
import { PwaService } from '../pwaService';
import { SheetDatabase } from '../sheetDatabase';

export class LibraryComponent {
  state: any;
  onSelectManga: (manga: Manga) => void;
  onReadChapter: (manga: Manga, chapterId: string) => void;
  activeGenre: string;
  searchQuery: string;
  chapterSortOrder: 'asc' | 'desc';

  libraryContainer: HTMLElement | null = null;
  detailContainer: HTMLElement | null = null;
  mangaGrid: HTMLElement | null = null;
  searchInput: HTMLInputElement | null = null;
  genreBar: HTMLElement | null = null;

  constructor(
    appState: any,
    onSelectManga: (manga: Manga) => void,
    onReadChapter: (manga: Manga, chapterId: string) => void
  ) {
    this.state = appState;
    this.onSelectManga = onSelectManga;
    this.onReadChapter = onReadChapter;
    this.activeGenre = 'All';
    this.searchQuery = '';
    this.chapterSortOrder = 'asc';
    
    this.initDOMReferences();
  }

  initDOMReferences(): void {
    this.libraryContainer = document.getElementById('library-view');
    this.detailContainer = document.getElementById('detail-view');
    this.mangaGrid = document.getElementById('manga-grid');
    this.searchInput = document.getElementById('search-input') as HTMLInputElement | null;
    this.genreBar = document.getElementById('genre-filter-bar');
    
    this.searchInput?.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      this.searchQuery = target.value.toLowerCase().trim();
      this.renderCatalog();
    });

    this.setupGenreFilter();
  }

  setupGenreFilter(): void {
    if (!this.genreBar) return;
    const genres = ['All', 'Action', 'Fantasy', 'Sci-Fi', 'Manhwa', 'Shounen', 'Google Drive', 'Bookmarks'];
    
    this.genreBar.innerHTML = '';
    genres.forEach(genre => {
      const btn = document.createElement('button');
      btn.className = `chip-filter ${genre === this.activeGenre ? 'active' : ''}`;
      btn.textContent = genre === 'Bookmarks' ? '⭐ Yêu thích' : genre;
      btn.addEventListener('click', () => {
        this.genreBar?.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeGenre = genre;
        this.renderCatalog();
      });
      this.genreBar?.appendChild(btn);
    });
  }

  renderCatalog(): void {
    if (!this.mangaGrid) return;
    
    let catalog: Manga[] = this.state.getAllManga();
    const bookmarks: string[] = StorageService.getSync<string[]>('manga_bookmarks', []);

    // Filter by genre
    if (this.activeGenre === 'Bookmarks') {
      catalog = catalog.filter(m => bookmarks.includes(m.id));
    } else if (this.activeGenre !== 'All') {
      catalog = catalog.filter(m => m.genres && m.genres.includes(this.activeGenre));
    }

    // Filter by search query
    if (this.searchQuery) {
      catalog = catalog.filter(m => 
        m.title.toLowerCase().includes(this.searchQuery) ||
        (m.originalTitle && m.originalTitle.toLowerCase().includes(this.searchQuery)) ||
        (m.author && m.author.toLowerCase().includes(this.searchQuery))
      );
    }

    this.mangaGrid.innerHTML = '';

    if (catalog.length === 0) {
      this.mangaGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 4rem; text-align: center; color: var(--text-muted);">
          <i class="fas fa-search" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.5;"></i>
          <h3>Không tìm thấy bộ truyện nào</h3>
          <p>Thử tìm kiếm với từ khóa khác hoặc dán link Google Drive để thêm truyện mới!</p>
        </div>
      `;
      return;
    }

    catalog.forEach(manga => {
      const card = this.createMangaCard(manga, bookmarks.includes(manga.id));
      this.mangaGrid?.appendChild(card);
    });

    FirebaseService.updateAllViewElementsOnPage();
  }

  createMangaCard(manga: Manga, isBookmarked: boolean): HTMLElement {
    const card = document.createElement('div');
    card.className = 'manga-card';

    // Resolve Cover URL (Trực tiếp URL ảnh hoặc Link Google Drive)
    let coverSrc = manga.coverUrl;
    if (manga.coverDriveId) {
      coverSrc = DriveHelper.getImageUrls(manga.coverDriveId, 500).primary;
    } else if (manga.coverUrl && DriveHelper.extractFileId(manga.coverUrl)) {
      const fileId = DriveHelper.extractFileId(manga.coverUrl);
      coverSrc = DriveHelper.getImageUrls(fileId, 500).primary;
    } else if (!coverSrc && manga.chapters?.[0]?.pages?.[0]) {
      const firstPage = manga.chapters[0].pages[0];
      const fileId = DriveHelper.extractFileId(firstPage);
      coverSrc = fileId ? DriveHelper.getImageUrls(fileId, 500).primary : firstPage;
    }

    const liveViews = FirebaseService.getViewCount(manga.id);
    const formattedViews = FirebaseService.formatViewCount(liveViews || manga.views);

    const safeTitle = escapeHtml(manga.title);
    const safeCoverSrc = sanitizeUrl(coverSrc, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80');
    const safeStatus = escapeHtml(manga.status || 'Đang tiến hành');
    const safeRating = escapeHtml(String(manga.rating || '4.9'));
    const safeMangaId = escapeHtml(manga.id);

    card.innerHTML = `
      <div class="card-cover">
        <img src="${safeCoverSrc}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer">
        <div class="card-badge-top">
          <span class="badge">${safeStatus}</span>
        </div>
        <div class="card-rating">
          <i class="fas fa-star"></i> ${safeRating}
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${safeTitle}</h3>
        <div class="card-meta">
          <span><i class="far fa-file-alt"></i> ${manga.chapters?.length || 0} tập</span>
          <span><i class="far fa-eye"></i> <span data-manga-view-id="${safeMangaId}">${formattedViews}</span></span>
        </div>
      </div>
    `;

    const imgEl = card.querySelector('.card-cover img') as HTMLImageElement | null;
    const coverFileId = manga.coverDriveId || DriveHelper.extractFileId(manga.coverUrl) || (manga.chapters?.[0]?.pages?.[0] ? DriveHelper.extractFileId(manga.chapters[0].pages[0]) : null);
    if (imgEl && coverFileId) {
      DriveHelper.attachImageFallback(imgEl, coverFileId, 500);
    }

    card.addEventListener('click', () => {
      this.showDetailView(manga);
    });

    return card;
  }

  showDetailView(manga: Manga, pushState = true): void {
    if (pushState && this.state?.router) {
      this.state.router.goManga(manga.id);
      return;
    }

    // Tự động ghi nhận lượt xem thật khi vào trang chi tiết truyện
    FirebaseService.recordView(manga.id);

    document.getElementById('reader-wrapper')?.classList.add('hidden');
    document.querySelector('.view-container')?.classList.remove('hidden');
    document.querySelector('.app-header')?.classList.remove('hidden');

    if (!this.detailContainer) return;

    this.libraryContainer?.classList.add('hidden');
    this.detailContainer.classList.remove('hidden');
    window.scrollTo(0, 0);

    const isBookmarked = this.state.isBookmarked(manga.id);
    const lastRead = this.state.getReadingHistory(manga.id);

    let coverSrc = manga.coverUrl;
    if (manga.coverDriveId) {
      coverSrc = DriveHelper.getImageUrls(manga.coverDriveId, 600).primary;
    } else if (manga.coverUrl && DriveHelper.extractFileId(manga.coverUrl)) {
      const fileId = DriveHelper.extractFileId(manga.coverUrl);
      coverSrc = DriveHelper.getImageUrls(fileId, 600).primary;
    }

    const liveViews = FirebaseService.getViewCount(manga.id);
    const formattedViews = FirebaseService.formatViewCount(liveViews || manga.views);

    // Luôn sắp xếp danh sách chương chuẩn theo tên chương tự nhiên (Chương 1, 2, ..., 10)
    if (manga.chapters && manga.chapters.length > 1) {
      manga.chapters = this.sortChapters(manga.chapters, 'asc');
    }

    const currentOrder = this.chapterSortOrder || 'asc';
    const displayChapters = this.sortChapters(manga.chapters || [], currentOrder);

    const safeTitle = escapeHtml(manga.title);
    const safeAltTitle = escapeHtml(manga.originalTitle || manga.author || '');
    const safeDesc = escapeHtml(manga.description || 'Chưa có mô tả cho bộ truyện này.');
    const safeCoverSrc = sanitizeUrl(coverSrc, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80');
    const safeGenres = (manga.genres || []).map(g => `<span class="badge">${escapeHtml(g)}</span>`).join('');
    const safeLastReadTitle = lastRead ? escapeHtml(lastRead.chapterTitle) : '';
    const safeStatus = escapeHtml(manga.status || 'Đang tiến hành');
    const safeRating = escapeHtml(String(manga.rating || '4.9'));
    const safeMangaId = escapeHtml(manga.id);

    this.detailContainer.innerHTML = `
      <button id="btn-back-library" class="btn-secondary" style="margin-bottom: 1.5rem;">
        <i class="fas fa-arrow-left"></i> Quay lại Thư viện
      </button>

      <div class="glass-panel detail-header-card">
        <div class="detail-cover" id="detail-cover-clickable" style="cursor: pointer; position: relative;" title="Bấm để thay đổi ảnh bìa">
          <img src="${safeCoverSrc}" alt="${safeTitle}">
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(15, 23, 42, 0.85); color: #a5b4fc; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.72rem; border: 1px solid rgba(255, 255, 255, 0.15);">
            <i class="fas fa-camera"></i> Đổi ảnh
          </div>
        </div>
        <div class="detail-info">
          <h1>${safeTitle}</h1>
          <div class="alt-title">${safeAltTitle}</div>
          
          <div class="detail-stats-bar" style="display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: center; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
            <span><i class="far fa-eye" style="color: #60a5fa;"></i> <strong style="color: #ffffff;" data-manga-view-id="${safeMangaId}">${formattedViews}</strong> lượt xem</span>
            <span><i class="far fa-file-alt" style="color: #a855f7;"></i> <strong style="color: #ffffff;">${manga.chapters?.length || 0}</strong> tập</span>
            <span><i class="fas fa-star" style="color: #fbbf24;"></i> <strong style="color: #ffffff;">${safeRating}</strong></span>
            <span><i class="fas fa-check-circle" style="color: #34d399;"></i> ${safeStatus}</span>
          </div>

          <div class="detail-tags">
            ${safeGenres}
          </div>

          <p class="detail-description">${safeDesc}</p>

          <div class="detail-actions">
            <button id="btn-start-reading" class="btn-primary">
              <i class="fas fa-book-open"></i> ${lastRead ? 'Đọc tiếp (' + safeLastReadTitle + ')' : 'Đọc từ chương 1'}
            </button>
            <button id="btn-edit-manga-cover" class="btn-secondary" title="Thay đổi ảnh bìa hoặc sửa thông tin truyện">
              <i class="fas fa-image" style="color: #a855f7;"></i> Đổi Ảnh Bìa
            </button>
            <button id="btn-toggle-bookmark" class="btn-secondary">
              <i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark" style="${isBookmarked ? 'color: #818cf8;' : ''}"></i>
              ${isBookmarked ? 'Đã Yêu Thích' : 'Yêu Thích'}
            </button>
          </div>
        </div>
      </div>

      <div class="glass-panel chapter-list-section">
        <div class="chapter-list-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 8px;">
          <h2 class="section-title" style="margin-bottom: 0;"><i class="fas fa-list"></i> Danh Sách Chương (${manga.chapters?.length || 0})</h2>
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="btn-toggle-chapter-sort" class="btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; border-radius: var(--radius-full);" title="Đổi thứ tự sắp xếp theo tên">
              <i class="fas ${currentOrder === 'asc' ? 'fa-sort-numeric-down' : 'fa-sort-numeric-up-alt'}"></i> 
              <span>${currentOrder === 'asc' ? 'Chương 1 ➔ Mới nhất' : 'Mới nhất ➔ Chương 1'}</span>
            </button>
            <button id="btn-add-chapter" class="btn-primary" style="font-size: 0.85rem; padding: 6px 14px;">
              <i class="fas fa-plus-circle"></i> + Thêm Chương Mới
            </button>
          </div>
        </div>
        <div class="chapter-grid">
          ${displayChapters.map(ch => {
            const isDownloaded = OfflineService.isChapterDownloaded(manga.id, ch.id);
            return `
            <div class="chapter-item" data-chapter-id="${escapeHtml(ch.id)}" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <div class="chapter-info-click" style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 8px; cursor: pointer;">
                <span class="chapter-title-text">${escapeHtml(ch.title)}</span>
                <span class="chapter-date"><i class="far fa-clock"></i> ${escapeHtml(ch.updatedAt || 'Hôm nay')}</span>
              </div>
              <div class="chapter-actions-right" style="display: flex; align-items: center; gap: 6px;">
                <div class="chapter-offline-actions" id="offline-action-${escapeHtml(ch.id)}">
                  ${isDownloaded ? `
                    <span class="badge-downloaded" title="Chương đã tải offline"><i class="fas fa-check-circle"></i> Đã tải</span>
                    <button class="btn-delete-offline" data-chapter-id="${escapeHtml(ch.id)}" title="Xóa dữ liệu offline của chương này">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  ` : `
                    <button class="btn-download-chapter" data-chapter-id="${escapeHtml(ch.id)}" title="Tải chương về để đọc ngoại tuyến">
                      <i class="fas fa-cloud-arrow-down"></i> Tải
                    </button>
                  `}
                </div>
                <button class="btn-edit-chapter btn-secondary" data-chapter-id="${escapeHtml(ch.id)}" style="padding: 4px 8px; font-size: 0.75rem; border-radius: var(--radius-sm);" title="Chỉnh sửa nội dung chương">
                  <i class="fas fa-edit" style="color: #818cf8;"></i> Sửa
                </button>
              </div>
            </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Bind event listener to detail cover image fallback
    const detailCoverImg = this.detailContainer.querySelector('#detail-cover-clickable img') as HTMLImageElement | null;
    const coverFileId = manga.coverDriveId || DriveHelper.extractFileId(manga.coverUrl);
    if (detailCoverImg && coverFileId) {
      DriveHelper.attachImageFallback(detailCoverImg, coverFileId, 600);
    }

    // Event handlers for detail view buttons
    document.getElementById('btn-back-library')?.addEventListener('click', () => {
      if (this.state?.router) {
        this.state.router.goHome();
      } else {
        this.detailContainer?.classList.add('hidden');
        this.libraryContainer?.classList.remove('hidden');
      }
    });

    document.getElementById('btn-toggle-chapter-sort')?.addEventListener('click', () => {
      this.chapterSortOrder = (this.chapterSortOrder || 'asc') === 'asc' ? 'desc' : 'asc';
      this.showDetailView(manga, false);
    });

    document.getElementById('btn-add-chapter')?.addEventListener('click', () => {
      this.state.openAddChapterModal(manga);
    });

    document.getElementById('btn-edit-manga-cover')?.addEventListener('click', () => {
      this.state.openEditMangaModal(manga);
    });

    document.getElementById('detail-cover-clickable')?.addEventListener('click', () => {
      this.state.openEditMangaModal(manga);
    });

    document.getElementById('btn-start-reading')?.addEventListener('click', () => {
      const firstChapter = manga.chapters?.[0];
      const targetChapterId = lastRead ? lastRead.chapterId : firstChapter?.id;
      if (targetChapterId) {
        this.onReadChapter(manga, targetChapterId);
      }
    });

    document.getElementById('btn-toggle-bookmark')?.addEventListener('click', () => {
      this.state.toggleBookmark(manga.id);
      this.showDetailView(manga, false); // Refresh view
    });

    // Chapter item click handlers (read chapter, download offline, or edit chapter link)
    this.detailContainer.querySelectorAll('.chapter-item').forEach(item => {
      const chEl = item as HTMLElement;
      const chId = chEl.dataset.chapterId;
      const chapterObj = manga.chapters.find(c => c.id === chId);

      chEl.querySelector('.chapter-info-click')?.addEventListener('click', () => {
        if (chId) this.onReadChapter(manga, chId);
      });

      chEl.querySelector('.btn-edit-chapter')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (chapterObj) this.state.openEditChapterModal(manga, chapterObj);
      });

      // Nút tải offline
      const btnDownload = chEl.querySelector('.btn-download-chapter');
      if (btnDownload && chapterObj) {
        btnDownload.addEventListener('click', async (e) => {
          e.stopPropagation();
          const actionBox = chEl.querySelector(`#offline-action-${chId}`);
          if (!actionBox) return;

          actionBox.innerHTML = `
            <div class="download-progress-box" title="Đang tải chương...">
              <div class="download-progress-bar" id="pbar-${chId}" style="width: 5%;"></div>
            </div>
          `;

          try {
            // Nạp danh sách ảnh nếu chương đang ở dạng lazy
            if (!chapterObj.pages || chapterObj.pages.length === 0) {
              if (SheetDatabase) {
                const fetched = await SheetDatabase.fetchChapterPages(manga.id, chapterObj.id);
                chapterObj.pages = fetched;
              }
            }

            const pBar = actionBox.querySelector(`#pbar-${chId}`) as HTMLElement | null;
            await OfflineService.downloadChapter(manga, chapterObj, (pct) => {
              if (pBar) pBar.style.width = `${pct}%`;
            });

            PwaService.showToast(`Đã tải thành công ${chapterObj.title} về máy để đọc ngoại tuyến!`, 'success');
            this.showDetailView(manga, false);
          } catch (err: any) {
            console.warn('Lỗi tải offline:', err);
            PwaService.showToast(err?.message || 'Không thể tải chương về máy!', 'warning');
            this.showDetailView(manga, false);
          }
        });
      }

      // Nút xóa dữ liệu offline của chương
      const btnDeleteOffline = chEl.querySelector('.btn-delete-offline');
      if (btnDeleteOffline && chapterObj) {
        btnDeleteOffline.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Bạn có chắc muốn xóa dữ liệu tải về của "${chapterObj.title}"?`)) {
            await OfflineService.deleteDownloadedChapter(manga.id, chId!);
            PwaService.showToast(`Đã xóa dữ liệu ngoại tuyến của ${chapterObj.title}!`, 'info');
            this.showDetailView(manga, false);
          }
        });
      }
    });
  }

  /**
   * Sắp xếp danh sách chương theo thứ tự tự nhiên của tên chương (Chương 1, Chương 2, ..., Chương 10)
   */
  sortChapters(chapters: Chapter[], order: 'asc' | 'desc' = 'asc'): Chapter[] {
    if (!Array.isArray(chapters)) return [];
    const sorted = [...chapters].sort((a, b) => {
      const titleA = a.title || '';
      const titleB = b.title || '';
      return titleA.localeCompare(titleB, 'vi', { numeric: true, sensitivity: 'base' });
    });
    return order === 'desc' ? sorted.reverse() : sorted;
  }
}

if (typeof window !== 'undefined') {
  window.LibraryComponent = LibraryComponent;
}
