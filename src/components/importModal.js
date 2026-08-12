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
            <input type="text" id="import-title" placeholder="VD: Solo Leveling (Bản PDF / Drive)" required>
          </div>

          <div class="form-group">
            <label>Tác Giả / Studio</label>
            <input type="text" id="import-author" placeholder="VD: DUBU / Chugong">
          </div>

          <div class="form-group">
            <label>Thể Loại (phân cách bằng dấu phẩy)</label>
            <input type="text" id="import-genres" placeholder="VD: Action, Fantasy, PDF, Google Drive">
          </div>

          <div class="form-group">
            <label>Loại Nguồn Truyện *</label>
            <select id="import-source-type" style="width: 100%; font-weight: 600;">
              <option value="images">🖼️ Danh sách nhiều link ảnh Google Drive (Mỗi trang 1 link)</option>
              <option value="pdf-drive">📂 Tệp PDF duy nhất lưu trên Google Drive (VD: drive.google.com/file/d/.../view)</option>
              <option value="pdf-link">🌐 Link tệp PDF từ trang web khác (.pdf URL)</option>
              <option value="pdf-file">📁 Tải tệp PDF trực tiếp từ máy tính</option>
            </select>
          </div>

          <div class="form-group">
            <label>Ảnh Bìa (Google Drive Link / File ID / Direct Image URL)</label>
            <input type="text" id="import-cover" placeholder="Dán link Google Drive hoặc File ID ảnh bìa">
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

          <!-- Container 1: Images Batch -->
          <div id="source-container-images" class="form-group">
            <label>Danh Sách Link / File IDs Google Drive Của Các Trang *</label>
            <textarea id="import-pages-batch" rows="5" placeholder="Dán danh sách đường dẫn Google Drive của các trang ảnh (Mỗi link hoặc ID 1 dòng)..."></textarea>
            <div class="form-hint" id="drive-parsed-count">Đã tìm thấy: 0 ảnh hợp lệ</div>
          </div>

          <!-- Container 2: PDF Google Drive Link -->
          <div id="source-container-pdf-drive" class="form-group hidden">
            <label>Đường Dẫn Tệp PDF Trên Google Drive *</label>
            <input type="text" id="import-pdf-drive-url" placeholder="VD: https://drive.google.com/file/d/1BxiMVs0XRA5.../view?usp=sharing">
            <div class="form-hint">Dán link Google Drive chứa tệp PDF. Đảm bảo cài đặt quyền "Bất kỳ ai có liên kết đều có thể xem".</div>
          </div>

          <!-- Container 3: PDF Web Link -->
          <div id="source-container-pdf-link" class="form-group hidden">
            <label>Đường Dẫn Tệp PDF Online (.pdf URL) *</label>
            <input type="text" id="import-pdf-url" placeholder="VD: https://example.com/manga.pdf">
            <div class="form-hint">Hỗ trợ đọc tệp PDF trực tiếp qua PDF.js engine</div>
          </div>

          <!-- Container 4: Local PDF File -->
          <div id="source-container-pdf-file" class="form-group hidden">
            <label>Chọn Tệp PDF Từ Máy Tính *</label>
            <input type="file" id="import-pdf-file-input" accept=".pdf">
            <div class="form-hint">Tệp PDF sẽ được tải và đọc trực tiếp trong trình duyệt</div>
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
    
    // Toggle source types UI
    const sourceTypeSelect = document.getElementById('import-source-type');
    const containerImages = document.getElementById('source-container-images');
    const containerPdfDrive = document.getElementById('source-container-pdf-drive');
    const containerPdfLink = document.getElementById('source-container-pdf-link');
    const containerPdfFile = document.getElementById('source-container-pdf-file');

    sourceTypeSelect.addEventListener('change', () => {
      const val = sourceTypeSelect.value;
      containerImages.classList.toggle('hidden', val !== 'images');
      containerPdfDrive.classList.toggle('hidden', val !== 'pdf-drive');
      containerPdfLink.classList.toggle('hidden', val !== 'pdf-link');
      containerPdfFile.classList.toggle('hidden', val !== 'pdf-file');
    });

    // Live update parsed count for images
    const pagesTextarea = document.getElementById('import-pages-batch');
    const countDisplay = document.getElementById('drive-parsed-count');
    
    pagesTextarea.addEventListener('input', () => {
      const ids = window.DriveHelper.parseBatchInput(pagesTextarea.value);
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

  async handleFormSubmit() {
    const title = document.getElementById('import-title').value.trim();
    const author = document.getElementById('import-author').value.trim() || 'Tác giả chưa cập nhật';
    const genresInput = document.getElementById('import-genres').value.trim();
    const coverInput = document.getElementById('import-cover').value.trim();
    const description = document.getElementById('import-description').value.trim();

    const chapterTitle = document.getElementById('import-chapter-title').value.trim();
    const sourceType = document.getElementById('import-source-type').value;

    let chapterPages = [];
    let pdfUrl = null;

    if (sourceType === 'images') {
      const pagesInput = document.getElementById('import-pages-batch').value.trim();
      chapterPages = window.DriveHelper.parseBatchInput(pagesInput);
      if (chapterPages.length === 0) {
        alert('Vui lòng dán ít nhất 1 link hoặc File ID Google Drive hợp lệ!');
        return;
      }
    } else if (sourceType === 'pdf-drive') {
      const rawDriveUrl = document.getElementById('import-pdf-drive-url').value.trim();
      const fileId = window.DriveHelper.extractFileId(rawDriveUrl);
      if (!fileId) {
        alert('Vui lòng dán đường dẫn tệp PDF trên Google Drive hoặc File ID hợp lệ!');
        return;
      }
      pdfUrl = rawDriveUrl;
      chapterPages = [rawDriveUrl];
    } else if (sourceType === 'pdf-link') {
      pdfUrl = document.getElementById('import-pdf-url').value.trim();
      if (!pdfUrl) {
        alert('Vui lòng dán URL tệp PDF online hợp lệ!');
        return;
      }
      chapterPages = [pdfUrl];
    } else if (sourceType === 'pdf-file') {
      const fileInput = document.getElementById('import-pdf-file-input');
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Vui lòng chọn tệp .pdf từ máy tính của bạn!');
        return;
      }
      const file = fileInput.files[0];
      // Read local file as Data URL
      pdfUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      chapterPages = [pdfUrl];
    }

    const defaultGenres = sourceType.includes('pdf') ? ['PDF', 'Google Drive', 'Custom'] : ['Google Drive', 'Custom'];

    const newManga = {
      id: 'custom-' + Date.now(),
      title: title,
      originalTitle: sourceType.includes('pdf') ? 'PDF Document Manga' : 'Google Drive User Manga',
      author: author,
      artist: author,
      status: 'Hoàn thành',
      coverUrl: coverInput && !window.DriveHelper.extractFileId(coverInput) ? coverInput : '',
      coverDriveId: window.DriveHelper.extractFileId(coverInput) || '',
      description: description || 'Bộ truyện PDF/Drive được tạo từ tệp người dùng.',
      genres: genresInput ? genresInput.split(',').map(g => g.trim()) : defaultGenres,
      rating: 5.0,
      views: '1',
      chapters: [
        {
          id: 'chap-1',
          title: chapterTitle,
          updatedAt: new Date().toISOString().split('T')[0],
          pages: chapterPages,
          pdfUrl: pdfUrl,
          isPdf: sourceType.includes('pdf')
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
