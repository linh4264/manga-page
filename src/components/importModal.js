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
          <h2><i class="fab fa-google-drive" style="color: #4285F4;"></i> Thêm Truyện Từ Google Drive</h2>
          <button id="btn-close-import-modal" class="btn-icon"><i class="fas fa-times"></i></button>
        </div>

        <form id="import-manga-form">
          <div class="form-group">
            <label>Tên Truyện *</label>
            <input type="text" id="import-title" placeholder="VD: One Piece (Đảo Hải Tặc)" required>
          </div>

          <div class="form-group">
            <label>Tác Giả / Studio</label>
            <input type="text" id="import-author" placeholder="VD: Eiichiro Oda">
          </div>

          <div class="form-group">
            <label>Thể Loại (phân cách bằng dấu phẩy)</label>
            <input type="text" id="import-genres" placeholder="VD: Action, Adventure, Fantasy, Google Drive">
          </div>

          <div class="form-group">
            <label>Ảnh Bìa (Google Drive Link / File ID / Direct Image URL)</label>
            <input type="text" id="import-cover" placeholder="Dán link Google Drive hoặc File ID ảnh bìa">
            <div class="form-hint">Ví dụ: https://drive.google.com/file/d/1BxiMVs0XRA5.../view</div>
          </div>

          <div class="form-group">
            <label>Mô Tả Truyện</label>
            <textarea id="import-description" rows="3" placeholder="Nhập mô tả ngắn về bộ truyện..."></textarea>
          </div>

          <hr style="border-color: var(--border-subtle); margin: 1.5rem 0;">

          <h3 style="font-size: 1.1rem; margin-bottom: 1rem; font-family: 'Outfit', sans-serif;">
            <i class="fas fa-layer-group"></i> Thông Tin Chương 1
          </h3>

          <div class="form-group">
            <label>Tên Chương *</label>
            <input type="text" id="import-chapter-title" value="Chương 1: Khởi Đầu" required>
          </div>

          <div class="form-group">
            <label>Danh Sách Link / File IDs Google Drive Của Các Trang *</label>
            <textarea id="import-pages-batch" rows="6" placeholder="Dán danh sách đường dẫn Google Drive của các trang ảnh (Mỗi link hoặc ID 1 dòng)..." required></textarea>
            <div class="form-hint" id="drive-parsed-count">Đã tìm thấy: 0 ảnh hợp lệ</div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-import" class="btn-secondary">Hủy</button>
            <button type="submit" class="btn-primary"><i class="fas fa-plus-circle"></i> Thêm Vào Thư Viện</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Event listeners
    document.getElementById('btn-close-import-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-import').addEventListener('click', () => this.close());
    
    // Live update parsed count
    const pagesTextarea = document.getElementById('import-pages-batch');
    const countDisplay = document.getElementById('drive-parsed-count');
    
    pagesTextarea.addEventListener('input', () => {
      const ids = DriveHelper.parseBatchInput(pagesTextarea.value);
      countDisplay.textContent = `Đã tìm thấy: ${ids.length} trang ảnh hợp lệ`;
    });

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

  handleFormSubmit() {
    const title = document.getElementById('import-title').value.trim();
    const author = document.getElementById('import-author').value.trim() || 'Tác giả chưa cập nhật';
    const genresInput = document.getElementById('import-genres').value.trim();
    const coverInput = document.getElementById('import-cover').value.trim();
    const description = document.getElementById('import-description').value.trim();

    const chapterTitle = document.getElementById('import-chapter-title').value.trim();
    const pagesInput = document.getElementById('import-pages-batch').value.trim();

    const extractedPages = DriveHelper.parseBatchInput(pagesInput);
    
    if (extractedPages.length === 0) {
      alert('Vui lòng dán ít nhất 1 link hoặc File ID Google Drive hợp lệ cho trang truyện!');
      return;
    }

    const newManga = {
      id: 'custom-' + Date.now(),
      title: title,
      originalTitle: 'Google Drive User Manga',
      author: author,
      artist: author,
      status: 'Đang tiến hành',
      coverUrl: coverInput && !DriveHelper.extractFileId(coverInput) ? coverInput : '',
      coverDriveId: DriveHelper.extractFileId(coverInput) || '',
      description: description || 'Bộ truyện được tạo thủ công từ các tập tin Google Drive của người dùng.',
      genres: genresInput ? genresInput.split(',').map(g => g.trim()) : ['Google Drive', 'Custom'],
      rating: 5.0,
      views: '1',
      chapters: [
        {
          id: 'chap-1',
          title: chapterTitle,
          updatedAt: new Date().toISOString().split('T')[0],
          pages: extractedPages
        }
      ]
    };

    this.state.addCustomManga(newManga);
    this.close();
    
    if (this.onMangaAdded) {
      this.onMangaAdded(newManga);
    }
  }
}
