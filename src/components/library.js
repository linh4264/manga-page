window.LibraryComponent = class LibraryComponent {
  constructor(appState, onSelectManga, onReadChapter) {
    this.state = appState;
    this.onSelectManga = onSelectManga;
    this.onReadChapter = onReadChapter;
    this.activeGenre = 'All';
    this.searchQuery = '';
    
    this.initDOMReferences();
  }

  initDOMReferences() {
    this.libraryContainer = document.getElementById('library-view');
    this.detailContainer = document.getElementById('detail-view');
    this.mangaGrid = document.getElementById('manga-grid');
    this.searchInput = document.getElementById('search-input');
    this.genreBar = document.getElementById('genre-filter-bar');
    
    this.searchInput?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderCatalog();
    });

    this.setupGenreFilter();
  }

  setupGenreFilter() {
    if (!this.genreBar) return;
    const genres = ['All', 'Action', 'Fantasy', 'Sci-Fi', 'Manhwa', 'Shounen', 'Google Drive', 'Bookmarks'];
    
    this.genreBar.innerHTML = '';
    genres.forEach(genre => {
      const btn = document.createElement('button');
      btn.className = `chip-filter ${genre === this.activeGenre ? 'active' : ''}`;
      btn.textContent = genre === 'Bookmarks' ? '⭐ Yêu thích' : genre;
      btn.addEventListener('click', () => {
        this.genreBar.querySelectorAll('.chip-filter').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeGenre = genre;
        this.renderCatalog();
      });
      this.genreBar.appendChild(btn);
    });
  }

  renderCatalog() {
    if (!this.mangaGrid) return;
    
    let catalog = this.state.getAllManga();
    const bookmarks = JSON.parse(localStorage.getItem('manga_bookmarks') || '[]');

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
      this.mangaGrid.appendChild(card);
    });

    if (window.FirebaseService) {
      window.FirebaseService.updateAllViewElementsOnPage();
    }
  }

  createMangaCard(manga, isBookmarked) {
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

    const liveViews = window.FirebaseService ? window.FirebaseService.getViewCount(manga.id) : 0;
    const formattedViews = window.FirebaseService ? window.FirebaseService.formatViewCount(liveViews) : (manga.views || '0');

    card.innerHTML = `
      <div class="card-cover">
        <img src="${coverSrc || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80'}" alt="${manga.title}" loading="lazy">
        <div class="card-badge-top">
          <span class="badge">${manga.status || 'Đang tiến hành'}</span>
        </div>
        <div class="card-rating">
          <i class="fas fa-star"></i> ${manga.rating || '4.9'}
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${manga.title}</h3>
        <div class="card-meta">
          <span><i class="far fa-file-alt"></i> ${manga.chapters?.length || 0} tập</span>
          <span><i class="far fa-eye"></i> <span data-manga-view-id="${manga.id}">${formattedViews}</span></span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      this.showDetailView(manga);
    });

    return card;
  }

  showDetailView(manga, pushState = true) {
    if (pushState && this.state?.router) {
      this.state.router.goManga(manga.id);
      return;
    }

    // Tự động ghi nhận lượt xem thật khi vào trang chi tiết truyện
    if (window.FirebaseService) {
      window.FirebaseService.recordView(manga.id);
    }

    document.getElementById('reader-wrapper')?.classList.add('hidden');
    document.querySelector('.view-container')?.classList.remove('hidden');
    document.querySelector('.app-header')?.classList.remove('hidden');
    document.body.classList.remove('is-webtoon-reading');
    document.documentElement.classList.remove('is-webtoon-reading');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    this.libraryContainer.classList.add('hidden');
    this.detailContainer.classList.remove('hidden');
    
    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const bookmarks = JSON.parse(localStorage.getItem('manga_bookmarks') || '[]');
    const isBookmarked = bookmarks.includes(manga.id);

    // Resolve cover image (Trực tiếp URL ảnh hoặc Link Google Drive)
    let coverSrc = manga.coverUrl;
    if (manga.coverDriveId) {
      coverSrc = DriveHelper.getImageUrls(manga.coverDriveId).primary;
    } else if (manga.coverUrl && DriveHelper.extractFileId(manga.coverUrl)) {
      const fileId = DriveHelper.extractFileId(manga.coverUrl);
      coverSrc = DriveHelper.getImageUrls(fileId).primary;
    }

    const history = JSON.parse(localStorage.getItem('manga_history') || '{}');
    const lastRead = history[manga.id];

    const liveViews = window.FirebaseService ? window.FirebaseService.getViewCount(manga.id) : 0;
    const formattedViews = window.FirebaseService ? window.FirebaseService.formatViewCount(liveViews) : (manga.views || '0');

    this.detailContainer.innerHTML = `
      <button id="btn-back-library" class="btn-secondary" style="margin-bottom: 1.5rem;">
        <i class="fas fa-arrow-left"></i> Quay lại Thư viện
      </button>

      <div class="glass-panel detail-header-card">
        <div class="detail-cover" id="detail-cover-clickable" style="cursor: pointer; position: relative;" title="Bấm để thay đổi ảnh bìa">
          <img src="${coverSrc || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=80'}" alt="${manga.title}">
          <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(15, 23, 42, 0.85); color: #a5b4fc; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 0.72rem; border: 1px solid rgba(255, 255, 255, 0.15);">
            <i class="fas fa-camera"></i> Đổi ảnh
          </div>
        </div>
        <div class="detail-info">
          <h1>${manga.title}</h1>
          <div class="alt-title">${manga.originalTitle || manga.author || ''}</div>
          
          <div class="detail-stats-bar" style="display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: center; margin-bottom: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
            <span><i class="far fa-eye" style="color: #60a5fa;"></i> <strong style="color: #ffffff;" data-manga-view-id="${manga.id}">${formattedViews}</strong> lượt xem</span>
            <span><i class="far fa-file-alt" style="color: #a855f7;"></i> <strong style="color: #ffffff;">${manga.chapters?.length || 0}</strong> tập</span>
            <span><i class="fas fa-star" style="color: #fbbf24;"></i> <strong style="color: #ffffff;">${manga.rating || '4.9'}</strong></span>
            <span><i class="fas fa-check-circle" style="color: #34d399;"></i> ${manga.status || 'Đang tiến hành'}</span>
          </div>

          <div class="detail-tags">
            ${(manga.genres || []).map(g => `<span class="badge">${g}</span>`).join('')}
          </div>

          <p class="detail-description">${manga.description || 'Chưa có mô tả cho bộ truyện này.'}</p>

          <div class="detail-actions">
            <button id="btn-start-reading" class="btn-primary">
              <i class="fas fa-book-open"></i> ${lastRead ? 'Đọc tiếp (' + lastRead.chapterTitle + ')' : 'Đọc từ chương 1'}
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
        <div class="chapter-list-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 class="section-title" style="margin-bottom: 0;"><i class="fas fa-list"></i> Danh Sách Chương (${manga.chapters?.length || 0})</h2>
          <button id="btn-add-chapter" class="btn-primary" style="font-size: 0.85rem; padding: 6px 14px;">
            <i class="fas fa-plus-circle"></i> + Thêm Chương Mới
          </button>
        </div>
        <div class="chapter-grid">
          ${(manga.chapters || []).map(ch => `
            <div class="chapter-item" data-chapter-id="${ch.id}" style="display: flex; align-items: center; justify-content: space-between;">
              <div class="chapter-info-click" style="flex: 1; display: flex; justify-content: space-between; align-items: center; margin-right: 12px; cursor: pointer;">
                <span class="chapter-title-text">${ch.title}</span>
                <span class="chapter-date"><i class="far fa-clock"></i> ${ch.updatedAt || 'Hôm nay'}</span>
              </div>
              <button class="btn-edit-chapter btn-secondary" data-chapter-id="${ch.id}" style="padding: 4px 10px; font-size: 0.75rem; border-radius: var(--radius-sm);" title="Chỉnh sửa nội dung chương">
                <i class="fas fa-edit" style="color: #818cf8;"></i> Sửa Chương
              </button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Bind event listener to detail cover image fallback
    const detailCoverImg = this.detailContainer.querySelector('#detail-cover-clickable img');
    const coverFileId = manga.coverDriveId || DriveHelper.extractFileId(manga.coverUrl);
    if (detailCoverImg && coverFileId) {
      DriveHelper.attachImageFallback(detailCoverImg, coverFileId, 600);
    }

    // Event handlers for detail view buttons
    document.getElementById('btn-back-library').addEventListener('click', () => {
      if (this.state?.router) {
        this.state.router.goHome();
      } else {
        this.detailContainer.classList.add('hidden');
        this.libraryContainer.classList.remove('hidden');
      }
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

    document.getElementById('btn-start-reading').addEventListener('click', () => {
      const targetChapterId = lastRead ? lastRead.chapterId : manga.chapters[0]?.id;
      if (targetChapterId) {
        this.onReadChapter(manga, targetChapterId);
      }
    });

    document.getElementById('btn-toggle-bookmark').addEventListener('click', (e) => {
      let bMarks = JSON.parse(localStorage.getItem('manga_bookmarks') || '[]');
      if (bMarks.includes(manga.id)) {
        bMarks = bMarks.filter(id => id !== manga.id);
      } else {
        bMarks.push(manga.id);
      }
      localStorage.setItem('manga_bookmarks', JSON.stringify(bMarks));
      this.showDetailView(manga); // Refresh view
    });

    // Chapter item click handlers (read chapter or edit chapter link)
    this.detailContainer.querySelectorAll('.chapter-item').forEach(item => {
      const chId = item.dataset.chapterId;
      const chapterObj = manga.chapters.find(c => c.id === chId);

      item.querySelector('.chapter-info-click')?.addEventListener('click', () => {
        this.onReadChapter(manga, chId);
      });

      item.querySelector('.btn-edit-chapter')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.state.openEditChapterModal(manga, chapterObj);
      });
    });
  }
}
