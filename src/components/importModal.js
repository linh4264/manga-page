window.ImportModalComponent = class ImportModalComponent {
  constructor(appState, onMangaAdded) {
    this.state = appState;
    this.onMangaAdded = onMangaAdded;
    this.modalOverlay = null;

    this.initModalDOM();
  }

  initModalDOM() {
    // Create modal wrapper in body
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'import-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fab fa-google-drive" style="color: #4285F4;"></i> Thêm Truyện Drive / File PDF</h2>
          <button id="btn-close-import-modal" class="btn-icon"><i class="fas fa-times"></i></button>
        </div>

        <form id="import-manga-form">
          <div class="form-group">
            <label>Tên Truyện *</label>
            <input type="text" id="import-title" placeholder="VD: Solo Leveling (Bản PDF)" required>
          </div>

          <div class="form-group">
            <label>Tác Giả / Studio</label>
            <input type="text" id="import-author" placeholder="VD: DUBU / Chugong">
          </div>

          <div class="form-group">
            <label>Thể Loại (phân cách bằng dấu phẩy)</label>
            <input type="text" id="import-genres" placeholder="VD: Action, Fantasy, PDF">
          </div>

          <div class="form-group">
            <label>Ảnh Bìa (Google Drive Link / Direct Image URL)</label>
            <input type="text" id="import-cover" placeholder="Dán link Google Drive hoặc URL ảnh bìa">
          </div>

          <div class="form-group">
            <label>Mô Tả Truyện</label>
            <textarea id="import-description" rows="2" placeholder="Nhập mô tả ngắn về bộ truyện..."></textarea>
          </div>

          <hr style="border-color: var(--border-subtle); margin: 1.2rem 0;">

          <h3 style="font-size: 1.1rem; margin-bottom: 1rem; font-family: 'Outfit', sans-serif;">
            <i class="fas fa-layer-group"></i> Thông Tin Chương 1
          </h3>

          <div class="form-group">
            <label>Tên Chương *</label>
            <input type="text" id="import-chapter-title" value="Chương 1: Khởi Đầu" required>
          </div>

          <!-- PDF Link Only -->
          <div class="form-group">
            <label>Đường Dẫn Tệp PDF (Link Google Drive / URL .pdf) *</label>
            <input type="text" id="import-pdf-url" placeholder="VD: https://drive.google.com/file/d/1BxiMVs0XRA5.../view" required>
            <div class="form-hint">Dán đường dẫn tệp PDF Google Drive hoặc tệp PDF online</div>
          </div>

          <!-- Admin Password Verification Field -->
          <div class="form-group" style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: var(--radius-sm); border: 1px solid rgba(129, 140, 248, 0.3);">
            <label style="color: #818cf8; font-weight: 700;"><i class="fas fa-lock"></i> Mật Khẩu Admin *</label>
            <input type="password" id="import-admin-password" placeholder="Nhập mật khẩu Admin để xác thực..." required>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; gap: 1rem;">
            <button type="button" id="btn-export-catalog" class="btn-secondary" style="font-size: 0.8rem;" title="Tải về file sampleManga.js để đè vào dự án trước khi deploy">
              <i class="fas fa-download" style="color: #818cf8;"></i> Xuất File Dữ Liệu Để Deploy Web
            </button>

            <div style="display: flex; gap: 0.75rem;">
              <button type="button" id="btn-cancel-import" class="btn-secondary">Hủy</button>
              <button type="submit" class="btn-primary"><i class="fas fa-plus-circle"></i> Thêm Vào Thư Viện</button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Event listeners
    document.getElementById('btn-close-import-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-import').addEventListener('click', () => this.close());
    document.getElementById('btn-export-catalog')?.addEventListener('click', () => this.exportCatalogFile());

    document.getElementById('import-manga-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
  }

  open() {
    this.modalOverlay.classList.remove('hidden');
  }

  close() {
    this.modalOverlay.classList.add('hidden');
    document.getElementById('import-manga-form').reset();
  }

  async handleFormSubmit() {
    if (this.isSubmitting) return;

    const title = document.getElementById('import-title').value.trim();
    const author = document.getElementById('import-author').value.trim() || 'Tác giả chưa cập nhật';
    const genresInput = document.getElementById('import-genres').value.trim();
    const coverInput = document.getElementById('import-cover').value.trim();
    const description = document.getElementById('import-description').value.trim();

    const chapterTitle = document.getElementById('import-chapter-title').value.trim();
    const pdfUrl = document.getElementById('import-pdf-url').value.trim();
    const adminPassword = document.getElementById('import-admin-password').value.trim();

    if (!pdfUrl) {
      alert('Vui lòng dán đường dẫn tệp PDF Google Drive hoặc PDF URL!');
      return;
    }

    if (!adminPassword) {
      alert('Vui lòng nhập Mật khẩu Admin để xác thực quyền đăng truyện!');
      return;
    }

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng...';
    }
    this.isSubmitting = true;

    try {
      const defaultGenres = ['PDF', 'Google Drive'];

      const newManga = {
        id: 'custom-' + Date.now(),
        title: title,
        originalTitle: 'PDF Manga',
        author: author,
        artist: author,
        status: 'Hoàn thành',
        coverUrl: coverInput && !window.DriveHelper.extractFileId(coverInput) ? coverInput : '',
        coverDriveId: window.DriveHelper.extractFileId(coverInput) || '',
        description: description || 'Bộ truyện PDF được tạo từ người dùng.',
        genres: genresInput ? genresInput.split(',').map(g => g.trim()) : defaultGenres,
        rating: 5.0,
        views: '1',
        chapters: [
          {
            id: 'chap-1',
            title: chapterTitle,
            updatedAt: new Date().toISOString().split('T')[0],
            pages: [pdfUrl],
            pdfUrl: pdfUrl,
            isPdf: true
          }
        ]
      };

      await this.state.addCustomManga(newManga, adminPassword);
      this.close();
      
      if (this.onMangaAdded) {
        this.onMangaAdded(newManga);
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Thêm Vào Thư Viện';
      }
    }
  }

  exportCatalogFile() {
    const allManga = this.state.getAllManga();
    const fileContent = `/**\n * Manga Catalog Database for Public Deployment.\n * Formatted automatically for DriveManga.\n */\n\nwindow.SAMPLE_MANGA_DATA = ${JSON.stringify(allManga, null, 2)};\n`;
    
    const blob = new Blob([fileContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sampleManga.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Đã tải tệp sampleManga.js mới về máy! Bạn chỉ cần thay tệp này vào thư mục src/data/sampleManga.js trong dự án rồi push/deploy lên GitHub/Vercel để mọi người cùng xem.');
  }
}
