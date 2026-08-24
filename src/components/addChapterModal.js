/**
 * Modal component cho phép thêm chương mới cho một bộ truyện đã có.
 * Hỗ trợ 3 nguồn: Link Thư mục Google Drive (Tự quét toàn bộ ảnh), Dán danh sách ảnh hàng loạt, hoặc Tệp PDF.
 * Tự động đồng bộ chương mới lên Google Sheet Database.
 */

window.AddChapterModalComponent = class AddChapterModalComponent {
  constructor(appState, onChapterAdded) {
    this.state = appState;
    this.onChapterAdded = onChapterAdded;
    this.targetManga = null;
    this.modalOverlay = null;
    this.currentSourceType = 'folder'; // 'folder' | 'images' | 'pdf'
    this.scannedPages = [];

    this.initModalDOM();
  }

  initModalDOM() {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'add-chapter-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content" style="max-width: 580px;">
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

          <!-- Nguồn Đọc Chương (Tabs / Radio) -->
          <div class="form-group">
            <label><i class="fas fa-layer-group" style="color: #818cf8;"></i> Định Dạng Nguồn Đọc *</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 4px;">
              <button type="button" class="btn-source-tab active" data-source="folder" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: rgba(99, 102, 241, 0.2); color: #ffffff; cursor: pointer; text-align: center;">
                <i class="fas fa-folder-open" style="color: #fbbf24; margin-right: 4px;"></i> Thư Mục Drive
              </button>
              <button type="button" class="btn-source-tab" data-source="images" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-align: center;">
                <i class="fas fa-images" style="color: #34d399; margin-right: 4px;"></i> Danh Sách Ảnh
              </button>
              <button type="button" class="btn-source-tab" data-source="pdf" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-align: center;">
                <i class="fas fa-file-pdf" style="color: #ef4444; margin-right: 4px;"></i> Tệp PDF
              </button>
            </div>
          </div>

          <!-- Tab 1: Link Thư Mục Google Drive (Khuyên Dùng) -->
          <div id="source-box-folder" class="source-input-box">
            <div class="form-group">
              <label><i class="fab fa-google-drive" style="color: #4285F4;"></i> Link Thư Mục Google Drive * (Chứa tất cả ảnh của chương)</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="add-chap-folder-url" placeholder="VD: https://drive.google.com/drive/folders/1aBcDeFgHi..." style="flex: 1;">
                <button type="button" id="btn-scan-folder" class="btn-secondary" style="padding: 0 14px; font-size: 0.82rem; white-space: nowrap;">
                  <i class="fas fa-search"></i> Quét Ảnh
                </button>
              </div>
              <div class="form-hint">Hệ thống sẽ tự động quét tất cả file ảnh trong thư mục và sắp xếp từ trang 1 đến hết.</div>
              <div id="folder-scan-status" style="margin-top: 8px; font-size: 0.82rem; display: none;"></div>
            </div>
          </div>

          <!-- Tab 2: Danh Sách Link Ảnh Hàng Loạt -->
          <div id="source-box-images" class="source-input-box" style="display: none;">
            <div class="form-group">
              <label><i class="fas fa-images" style="color: #34d399;"></i> Danh Sách Link Ảnh / File ID (Mỗi dòng 1 ảnh hoặc dán hàng loạt)</label>
              <textarea id="add-chap-images-text" rows="4" placeholder="Dán các đường link ảnh Google Drive hoặc File ID vào đây (cách nhau bởi dấu xuống dòng)..."></textarea>
              <div class="form-hint">Hỗ trợ dán đồng thời hàng chục link ảnh Google Drive.</div>
            </div>
          </div>

          <!-- Tab 3: Tệp PDF -->
          <div id="source-box-pdf" class="source-input-box" style="display: none;">
            <div class="form-group">
              <label><i class="fas fa-file-pdf" style="color: #ef4444;"></i> Đường Dẫn Tệp PDF (Link Google Drive / URL .pdf)</label>
              <input type="text" id="add-chap-pdf-url" placeholder="VD: https://drive.google.com/file/d/.../view">
              <div class="form-hint">Dán đường dẫn tệp PDF Google Drive hoặc link PDF online.</div>
            </div>
          </div>

          <!-- Admin Password Field -->
          <div class="form-group" style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: var(--radius-sm); border: 1px solid rgba(129, 140, 248, 0.3);">
            <label style="color: #818cf8; font-weight: 700;"><i class="fas fa-lock"></i> Mật Khẩu Admin *</label>
            <input type="password" id="add-chap-admin-password" placeholder="Nhập mật khẩu Admin để xác thực..." required>
          </div>

          <div class="modal-footer-row" style="justify-content: flex-end;">
            <div class="modal-footer-actions" style="width: 100%;">
              <button type="button" id="btn-cancel-chapter-modal" class="btn-secondary">Hủy</button>
              <button type="submit" class="btn-primary"><i class="fas fa-plus"></i> Xác Nhận Thêm Chương</button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Bind Source Tabs Switcher
    this.modalOverlay.querySelectorAll('.btn-source-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.modalOverlay.querySelectorAll('.btn-source-tab').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.background = 'rgba(99, 102, 241, 0.2)';
        btn.style.color = '#ffffff';

        const source = btn.dataset.source;
        this.currentSourceType = source;

        document.getElementById('source-box-folder').style.display = source === 'folder' ? 'block' : 'none';
        document.getElementById('source-box-images').style.display = source === 'images' ? 'block' : 'none';
        document.getElementById('source-box-pdf').style.display = source === 'pdf' ? 'block' : 'none';
      });
    });

    // Bind Folder Scanner Button
    document.getElementById('btn-scan-folder')?.addEventListener('click', () => this.handleScanFolder());
    document.getElementById('add-chap-folder-url')?.addEventListener('change', () => this.handleScanFolder());

    // Event Listeners
    document.getElementById('btn-close-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('add-chapter-form').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleScanFolder() {
    const folderInput = document.getElementById('add-chap-folder-url').value.trim();
    const statusEl = document.getElementById('folder-scan-status');
    const scanBtn = document.getElementById('btn-scan-folder');

    if (!folderInput) {
      if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.innerHTML = '<span style="color: #ef4444;"><i class="fas fa-exclamation-circle"></i> Vui lòng dán link Thư mục Google Drive!</span>';
      }
      return;
    }

    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang quét...';
    }
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.innerHTML = '<span style="color: #818cf8;"><i class="fas fa-spinner fa-spin"></i> Đang quét toàn bộ ảnh trong thư mục...</span>';
    }

    const res = await window.DriveHelper.fetchFolderImages(folderInput);
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = '<i class="fas fa-search"></i> Quét Lại';
    }

    if (res && res.success && res.images && res.images.length > 0) {
      this.scannedPages = res.images;
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #34d399; font-weight: 600;"><i class="fas fa-check-circle"></i> Thành công! Đã tìm thấy <strong>${res.images.length}</strong> trang ảnh và sắp xếp chuẩn từ trang 1 đến ${res.images.length}.</span>`;
      }
    } else {
      this.scannedPages = [];
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> ${res.error || 'Không thể quét ảnh trong thư mục. Vui lòng đảm bảo thư mục đã bật quyền "Bất kỳ ai có đường liên kết".'}</span>`;
      }
    }
  }

  open(manga) {
    if (!manga) return;
    this.targetManga = manga;
    this.scannedPages = [];

    const nextChapNum = (manga.chapters ? manga.chapters.length : 0) + 1;
    document.getElementById('add-chapter-manga-title').value = manga.title;
    document.getElementById('add-chapter-title').value = `Chương ${nextChapNum}`;
    document.getElementById('add-chap-folder-url').value = '';
    document.getElementById('add-chap-images-text').value = '';
    document.getElementById('add-chap-pdf-url').value = '';
    const statusEl = document.getElementById('folder-scan-status');
    if (statusEl) statusEl.style.display = 'none';

    const passInput = document.getElementById('add-chap-admin-password');
    if (passInput) passInput.value = '';

    this.modalOverlay.classList.remove('hidden');
  }

  close() {
    this.modalOverlay.classList.add('hidden');
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting || !this.targetManga) return;

    const chapterTitle = document.getElementById('add-chapter-title').value.trim();
    const adminPassword = document.getElementById('add-chap-admin-password').value.trim();

    let pages = [];
    let pdfUrl = '';
    let isPdf = false;

    if (this.currentSourceType === 'folder') {
      const folderUrl = document.getElementById('add-chap-folder-url').value.trim();
      if (!folderUrl) {
        alert('Vui lòng dán link Thư mục Google Drive!');
        return;
      }

      if (this.scannedPages.length > 0) {
        pages = this.scannedPages;
      } else {
        // Tự động quét trước khi submit nếu chưa bấm nút quét
        const res = await window.DriveHelper.fetchFolderImages(folderUrl);
        if (res && res.success && res.images && res.images.length > 0) {
          pages = res.images;
        } else {
          alert('Không thể lấy ảnh từ Thư mục Google Drive!\n\nLỗi: ' + (res.error || 'Thư mục trống hoặc chưa mở quyền chia sẻ.'));
          return;
        }
      }
    } else if (this.currentSourceType === 'images') {
      const imagesText = document.getElementById('add-chap-images-text').value.trim();
      pages = window.DriveHelper.parseBatchInput(imagesText);
      if (pages.length === 0) {
        alert('Vui lòng dán ít nhất 1 link hoặc File ID ảnh!');
        return;
      }
    } else if (this.currentSourceType === 'pdf') {
      pdfUrl = document.getElementById('add-chap-pdf-url').value.trim();
      if (!pdfUrl) {
        alert('Vui lòng dán đường dẫn tệp PDF!');
        return;
      }
      pages = [pdfUrl];
      isPdf = true;
    }

    if (!adminPassword) {
      alert('Vui lòng nhập Mật khẩu Admin để xác thực quyền thêm chương!');
      return;
    }

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang thêm chương...';
    }
    this.isSubmitting = true;

    try {
      const newChapter = {
        id: 'chap-' + ((this.targetManga.chapters ? this.targetManga.chapters.length : 0) + 1) + '-' + Date.now(),
        title: chapterTitle,
        updatedAt: new Date().toISOString().split('T')[0],
        pages: pages,
        pdfUrl: pdfUrl,
        isPdf: isPdf
      };

      if (!this.targetManga.chapters) {
        this.targetManga.chapters = [];
      }

      this.targetManga.chapters.push(newChapter);

      // Update manga to Google Sheet and state with Admin Password
      await this.state.updateManga(this.targetManga, adminPassword);
      this.close();

      if (this.onChapterAdded) {
        this.onChapterAdded(this.targetManga, newChapter);
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Xác Nhận Thêm Chương';
      }
    }
  }
};
