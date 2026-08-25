/**
 * Modal component cho phép SỬA ĐỔI NỘI DUNG (Link Thư Mục, Danh Sách Ảnh, hoặc PDF) của một chương đã có.
 * Tự động cập nhật trực tiếp lên Google Sheet Database.
 */

window.EditChapterModalComponent = class EditChapterModalComponent {
  constructor(appState, onChapterUpdated) {
    this.state = appState;
    this.onChapterUpdated = onChapterUpdated;
    this.targetManga = null;
    this.targetChapter = null;
    this.modalOverlay = null;
    this.currentSourceType = 'folder';
    this.scannedPages = [];

    this.initModalDOM();
  }

  initModalDOM() {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'edit-chapter-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content" style="max-width: 580px;">
        <div class="modal-header">
          <h2><i class="fas fa-edit" style="color: #4285F4;"></i> Chỉnh Sửa Nội Dung Chương</h2>
          <button id="btn-close-edit-chapter-modal" class="btn-icon"><i class="fas fa-times"></i></button>
        </div>

        <form id="edit-chapter-form">
          <div class="form-group">
            <label>Bộ Truyện</label>
            <input type="text" id="edit-chapter-manga-title" disabled style="opacity: 0.7; font-weight: 600;">
          </div>

          <div class="form-group">
            <label>Tên Chương *</label>
            <input type="text" id="edit-chapter-title" required>
          </div>

          <!-- Nguồn Đọc Chương -->
          <div class="form-group">
            <label><i class="fas fa-layer-group" style="color: #818cf8;"></i> Định Dạng Nguồn Đọc *</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 4px;">
              <button type="button" class="btn-edit-source-tab active" data-source="folder" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: rgba(99, 102, 241, 0.2); color: #ffffff; cursor: pointer; text-align: center;">
                <i class="fas fa-folder-open" style="color: #fbbf24; margin-right: 4px;"></i> Thư Mục Drive
              </button>
              <button type="button" class="btn-edit-source-tab" data-source="images" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-align: center;">
                <i class="fas fa-images" style="color: #34d399; margin-right: 4px;"></i> Danh Sách Ảnh
              </button>
              <button type="button" class="btn-edit-source-tab" data-source="pdf" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-align: center;">
                <i class="fas fa-file-pdf" style="color: #ef4444; margin-right: 4px;"></i> Tệp PDF
              </button>
            </div>
          </div>

          <!-- Tab 1: Thư Mục Drive -->
          <div id="edit-box-folder" class="edit-source-box">
            <div class="form-group">
              <label><i class="fab fa-google-drive" style="color: #4285F4;"></i> Link Thư Mục Google Drive Mới</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="edit-chapter-folder-url" placeholder="VD: https://drive.google.com/drive/folders/1aBcDeFgHi..." style="flex: 1;">
                <button type="button" id="btn-scan-edit-folder" class="btn-secondary" style="padding: 0 14px; font-size: 0.82rem; white-space: nowrap;">
                  <i class="fas fa-search"></i> Quét Ảnh
                </button>
              </div>
              <div id="edit-folder-scan-status" style="margin-top: 8px; font-size: 0.82rem; display: none;"></div>
            </div>
          </div>

          <!-- Tab 2: Danh Sách Ảnh -->
          <div id="edit-box-images" class="edit-source-box" style="display: none;">
            <div class="form-group">
              <label><i class="fas fa-images" style="color: #34d399;"></i> Danh Sách Link Ảnh / File ID Mới (Mỗi dòng 1 ảnh)</label>
              <textarea id="edit-chapter-images-text" rows="4" placeholder="Dán danh sách link ảnh hoặc File ID (mỗi dòng 1 trang)..."></textarea>
            </div>
          </div>

          <!-- Tab 3: Tệp PDF -->
          <div id="edit-box-pdf" class="edit-source-box" style="display: none;">
            <div class="form-group">
              <label><i class="fas fa-file-pdf" style="color: #ef4444;"></i> Đường Dẫn Tệp PDF Mới</label>
              <input type="text" id="edit-chapter-pdf-url" placeholder="VD: https://drive.google.com/file/d/.../view">
            </div>
          </div>

          <!-- Optional Facebook Post URL Input -->
          <div class="form-group">
            <label><i class="fab fa-facebook-messenger" style="color: #0084FF;"></i> Link Bài Viết Facebook (Tùy chọn)</label>
            <input type="text" id="edit-chapter-fb-url" placeholder="VD: https://www.facebook.com/fanpage/posts/12345678">
            <div class="form-hint">Dán link bài viết Facebook nếu muốn lấy bình luận từ một bài đăng Facebook có sẵn</div>
          </div>

          <!-- Admin Password Field -->
          <div class="form-group" style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: var(--radius-sm); border: 1px solid rgba(129, 140, 248, 0.3);">
            <label style="color: #818cf8; font-weight: 700;"><i class="fas fa-lock"></i> Mật Khẩu Admin *</label>
            <input type="password" id="edit-chapter-admin-password" placeholder="Nhập mật khẩu Admin để xác thực..." required>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-edit-chapter-modal" class="btn-secondary">Hủy</button>
            <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Lưu Thay Đổi</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Bind Tabs Switcher
    this.modalOverlay.querySelectorAll('.btn-edit-source-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        this.modalOverlay.querySelectorAll('.btn-edit-source-tab').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.background = 'rgba(99, 102, 241, 0.2)';
        btn.style.color = '#ffffff';

        const source = btn.dataset.source;
        this.currentSourceType = source;

        document.getElementById('edit-box-folder').style.display = source === 'folder' ? 'block' : 'none';
        document.getElementById('edit-box-images').style.display = source === 'images' ? 'block' : 'none';
        document.getElementById('edit-box-pdf').style.display = source === 'pdf' ? 'block' : 'none';
      });
    });

    // Bind Scan Button
    document.getElementById('btn-scan-edit-folder')?.addEventListener('click', () => this.handleScanFolder());
    document.getElementById('edit-chapter-folder-url')?.addEventListener('change', () => this.handleScanFolder());

    // Event Listeners
    document.getElementById('btn-close-edit-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-edit-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('edit-chapter-form').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleScanFolder() {
    const folderInput = document.getElementById('edit-chapter-folder-url').value.trim();
    const statusEl = document.getElementById('edit-folder-scan-status');
    const scanBtn = document.getElementById('btn-scan-edit-folder');

    if (!folderInput) return;

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
        statusEl.innerHTML = `<span style="color: #34d399; font-weight: 600;"><i class="fas fa-check-circle"></i> Thành công! Đã tìm thấy <strong>${res.images.length}</strong> trang ảnh.</span>`;
      }
    } else {
      this.scannedPages = [];
      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #ef4444;"><i class="fas fa-exclamation-triangle"></i> ${res.error || 'Không thể quét ảnh trong thư mục.'}</span>`;
      }
    }
  }

  open(manga, chapter) {
    if (!manga || !chapter) return;
    this.targetManga = manga;
    this.targetChapter = chapter;
    this.scannedPages = [];

    document.getElementById('edit-chapter-manga-title').value = manga.title;
    document.getElementById('edit-chapter-title').value = chapter.title;
    document.getElementById('edit-chapter-fb-url').value = chapter.fbCommentUrl || '';
    document.getElementById('edit-chapter-folder-url').value = '';
    document.getElementById('edit-chapter-pdf-url').value = chapter.pdfUrl || '';

    // If chapter has pages, fill images textarea
    if (chapter.pages && chapter.pages.length > 0 && !chapter.isPdf) {
      document.getElementById('edit-chapter-images-text').value = chapter.pages.join('\n');
    } else {
      document.getElementById('edit-chapter-images-text').value = '';
    }

    const statusEl = document.getElementById('edit-folder-scan-status');
    if (statusEl) statusEl.style.display = 'none';

    const passInput = document.getElementById('edit-chapter-admin-password');
    if (passInput) passInput.value = '';

    this.modalOverlay.classList.remove('hidden');
  }

  close() {
    this.modalOverlay.classList.add('hidden');
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting || !this.targetManga || !this.targetChapter) return;

    const newTitle = document.getElementById('edit-chapter-title').value.trim();
    const newFbUrl = document.getElementById('edit-chapter-fb-url').value.trim();
    const adminPassword = document.getElementById('edit-chapter-admin-password').value.trim();

    let newPages = this.targetChapter.pages || [];
    let newPdfUrl = this.targetChapter.pdfUrl || '';
    let isPdf = this.targetChapter.isPdf || false;

    if (this.currentSourceType === 'folder') {
      const folderUrl = document.getElementById('edit-chapter-folder-url').value.trim();
      if (folderUrl) {
        if (this.scannedPages.length > 0) {
          newPages = this.scannedPages;
          isPdf = false;
          newPdfUrl = '';
        } else {
          const res = await window.DriveHelper.fetchFolderImages(folderUrl);
          if (res && res.success && res.images && res.images.length > 0) {
            newPages = res.images;
            isPdf = false;
            newPdfUrl = '';
          } else {
            alert('Không thể quét ảnh từ thư mục Google Drive: ' + (res.error || 'Lỗi'));
            return;
          }
        }
      }
    } else if (this.currentSourceType === 'images') {
      const imagesText = document.getElementById('edit-chapter-images-text').value.trim();
      if (imagesText) {
        newPages = window.DriveHelper.parseBatchInput(imagesText);
        isPdf = false;
        newPdfUrl = '';
      }
    } else if (this.currentSourceType === 'pdf') {
      const pdfInput = document.getElementById('edit-chapter-pdf-url').value.trim();
      if (pdfInput) {
        newPdfUrl = pdfInput;
        newPages = [pdfInput];
        isPdf = true;
      }
    }

    if (!adminPassword) {
      alert('Vui lòng nhập Mật khẩu Admin để xác thực quyền chỉnh sửa!');
      return;
    }

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    }
    this.isSubmitting = true;

    try {
      this.targetChapter.title = newTitle;
      this.targetChapter.pages = newPages;
      this.targetChapter.pdfUrl = newPdfUrl;
      this.targetChapter.isPdf = isPdf;
      this.targetChapter.fbCommentUrl = newFbUrl;
      this.targetChapter.updatedAt = new Date().toISOString().split('T')[0];

      // Sắp xếp danh sách chương theo thứ tự tự nhiên của tên chương
      if (this.targetManga.chapters && this.targetManga.chapters.length > 1) {
        this.targetManga.chapters.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' }));
      }

      await this.state.updateManga(this.targetManga, adminPassword);
      this.close();

      if (this.onChapterUpdated) {
        this.onChapterUpdated(this.targetManga, this.targetChapter);
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Lưu Thay Đổi';
      }
    }
  }
};
