/**
 * Modal component cho phép thêm chương mới cho một bộ truyện đã có.
 * Tự động đồng bộ chương mới lên Google Sheet Database.
 */

window.AddChapterModalComponent = class AddChapterModalComponent {
  constructor(appState, onChapterAdded) {
    this.state = appState;
    this.onChapterAdded = onChapterAdded;
    this.targetManga = null;
    this.modalOverlay = null;

    this.initModalDOM();
  }

  initModalDOM() {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'add-chapter-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-plus-circle" style="color: #4285F4;"></i> Thêm Chương Mới</h2>
          <button id="btn-close-chapter-modal" class="btn-icon"><i class="fas fa-times"></i></button>
        </div>

        <form id="add-chapter-form">
          <div class="form-group">
            <label>Bộ Truyện</label>
            <input type="text" id="add-chapter-manga-title" disabled style="opacity: 0.7; font-weight: 600;">
          </div>

          <div class="form-group">
            <label>Tên Chương Mới *</label>
            <input type="text" id="add-chapter-title" placeholder="VD: Chương 2: Thức Tỉnh" required>
          </div>

          <div class="form-group">
            <label>Loại Nguồn Chương *</label>
            <select id="add-chapter-source-type" style="width: 100%; font-weight: 600;">
              <option value="images">🖼️ Danh sách nhiều link ảnh Google Drive (Mỗi trang 1 link)</option>
              <option value="pdf-drive">📂 Tệp PDF duy nhất trên Google Drive (VD: drive.google.com/file/d/.../view)</option>
              <option value="pdf-link">🌐 Link tệp PDF từ trang web khác (.pdf URL)</option>
              <option value="pdf-file">📁 Tải tệp PDF trực tiếp từ máy tính</option>
            </select>
          </div>

          <!-- Option 1: Images List -->
          <div id="add-chap-group-images" class="form-group">
            <label>Danh Sách Link Ảnh Trang Truyện (Google Drive / Direct URL)</label>
            <textarea id="add-chap-images" rows="5" placeholder="Dán các đường dẫn ảnh Google Drive (Mỗi trang 1 dòng)..."></textarea>
            <div class="form-hint">Mỗi dòng 1 đường dẫn ảnh hoặc File ID Google Drive</div>
          </div>

          <!-- Option 2 & 3: PDF Online Link -->
          <div id="add-chap-group-pdf-url" class="form-group hidden">
            <label>Đường Dẫn Tệp PDF Online (.pdf URL hoặc Link Google Drive File)</label>
            <input type="text" id="add-chap-pdf-url" placeholder="VD: https://drive.google.com/file/d/.../view hoặc URL file .pdf">
            <div class="form-hint">Hỗ trợ đọc tệp PDF trực tiếp qua PDF.js engine</div>
          </div>

          <!-- Option 4: Local PDF File -->
          <div id="add-chap-group-pdf-file" class="form-group hidden">
            <label>Tải Tệp PDF Từ Máy Tính</label>
            <input type="file" id="add-chap-pdf-file-input" accept=".pdf" style="background: var(--bg-card); padding: 8px; border-radius: var(--radius-sm);">
            <div class="form-hint">Tệp PDF sẽ được đọc trực tiếp trong trình duyệt</div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-chapter-modal" class="btn-secondary">Hủy</button>
            <button type="submit" class="btn-primary"><i class="fas fa-plus-circle"></i> Xác Nhận Thêm Chương</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Event Listeners
    document.getElementById('btn-close-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-chapter-modal').addEventListener('click', () => this.close());

    const sourceTypeSelect = document.getElementById('add-chapter-source-type');
    sourceTypeSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      document.getElementById('add-chap-group-images').classList.toggle('hidden', val !== 'images');
      document.getElementById('add-chap-group-pdf-url').classList.toggle('hidden', val !== 'pdf-drive' && val !== 'pdf-link');
      document.getElementById('add-chap-group-pdf-file').classList.toggle('hidden', val !== 'pdf-file');
    });

    document.getElementById('add-chapter-form').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open(manga) {
    if (!manga) return;
    this.targetManga = manga;

    const nextChapNum = (manga.chapters ? manga.chapters.length : 0) + 1;
    document.getElementById('add-chapter-manga-title').value = manga.title;
    document.getElementById('add-chapter-title').value = `Chương ${nextChapNum}`;
    document.getElementById('add-chap-images').value = '';
    document.getElementById('add-chap-pdf-url').value = '';
    
    this.modalOverlay.classList.remove('hidden');
  }

  close() {
    this.modalOverlay.classList.add('hidden');
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (!this.targetManga) return;

    const chapterTitle = document.getElementById('add-chapter-title').value.trim();
    const sourceType = document.getElementById('add-chapter-source-type').value;

    let chapterPages = [];
    let pdfUrl = '';

    if (sourceType === 'images') {
      const rawText = document.getElementById('add-chap-images').value;
      chapterPages = window.DriveHelper.parseBatchLinks(rawText);
      if (chapterPages.length === 0) {
        alert('Vui lòng dán ít nhất 1 đường dẫn ảnh hoặc File ID Google Drive!');
        return;
      }
    } else if (sourceType === 'pdf-drive' || sourceType === 'pdf-link') {
      pdfUrl = document.getElementById('add-chap-pdf-url').value.trim();
      if (!pdfUrl) {
        alert('Vui lòng nhập đường dẫn tệp PDF!');
        return;
      }
      chapterPages = [pdfUrl];
    } else if (sourceType === 'pdf-file') {
      const fileInput = document.getElementById('add-chap-pdf-file-input');
      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Vui lòng chọn 1 tệp PDF từ máy tính!');
        return;
      }
      const file = fileInput.files[0];
      pdfUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      chapterPages = [pdfUrl];
    }

    const newChapter = {
      id: 'chap-' + ((this.targetManga.chapters ? this.targetManga.chapters.length : 0) + 1) + '-' + Date.now(),
      title: chapterTitle,
      updatedAt: new Date().toISOString().split('T')[0],
      pages: chapterPages,
      pdfUrl: pdfUrl,
      isPdf: sourceType.includes('pdf')
    };

    if (!this.targetManga.chapters) {
      this.targetManga.chapters = [];
    }

    this.targetManga.chapters.push(newChapter);

    // Update manga to Google Sheet and state
    await this.state.updateManga(this.targetManga);
    this.close();

    if (this.onChapterAdded) {
      this.onChapterAdded(this.targetManga, newChapter);
    }
  }
};
