/**
 * Modal component cho phép SỬA THÔNG TIN & THAY ĐỔI ĐƯỜNG DẪN / DRIVE ID ẢNH BÌA TRUYỆN.
 * Tự động cập nhật và lưu trực tiếp lên Google Sheet Database.
 */

window.EditMangaModalComponent = class EditMangaModalComponent {
  constructor(appState, onMangaUpdated) {
    this.state = appState;
    this.onMangaUpdated = onMangaUpdated;
    this.targetManga = null;
    this.modalOverlay = null;

    this.initModalDOM();
  }

  initModalDOM() {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'edit-manga-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content" style="max-width: 540px;">
        <div class="modal-header">
          <h2><i class="fas fa-image" style="color: #a855f7;"></i> Thay Đổi Ảnh Bìa / Thông Tin Truyện</h2>
          <button id="btn-close-edit-manga-modal" class="btn-icon"><i class="fas fa-times"></i></button>
        </div>

        <form id="edit-manga-form">
          <div class="form-group">
            <label>Tên Truyện *</label>
            <input type="text" id="edit-manga-title" required>
          </div>

          <div class="form-group">
            <label>Tác Giả / Tên Gốc</label>
            <input type="text" id="edit-manga-author" placeholder="VD: Tác giả, Họa sĩ...">
          </div>

          <!-- Cover Link / Drive ID Input with Live Preview -->
          <div class="form-group">
            <label><i class="fas fa-link" style="color: #a855f7;"></i> Link Ảnh Bìa Mới (Google Drive / Direct Image URL) *</label>
            <input type="text" id="edit-manga-cover-url" placeholder="Dán link ảnh Google Drive hoặc URL ảnh (.jpg, .png...)" required>
            <div class="form-hint">Hỗ trợ link xem ảnh Google Drive, File ID Drive hoặc link URL ảnh bất kỳ.</div>
          </div>

          <!-- Live Image Preview Box -->
          <div id="edit-manga-preview-box" style="margin-bottom: 1rem; text-align: center; display: none;">
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 6px;">Xem trước ảnh bìa:</div>
            <img id="edit-manga-preview-img" style="max-height: 180px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); object-fit: cover;" alt="Xem trước ảnh bìa">
          </div>

          <div class="form-group">
            <label>Mô Tả Truyện</label>
            <textarea id="edit-manga-description" rows="3" placeholder="Nhập tóm tắt hoặc nội dung chính của bộ truyện..."></textarea>
          </div>

          <div class="form-group">
            <label>Thể Loại (Phân cách bằng dấu phẩy)</label>
            <input type="text" id="edit-manga-genres" placeholder="VD: Action, Fantasy, Manhwa">
          </div>

          <!-- Admin Password Field -->
          <div class="form-group" style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: var(--radius-sm); border: 1px solid rgba(129, 140, 248, 0.3);">
            <label style="color: #818cf8; font-weight: 700;"><i class="fas fa-lock"></i> Mật Khẩu Admin *</label>
            <input type="password" id="edit-manga-admin-password" placeholder="Nhập mật khẩu Admin để lưu lên Google Sheet..." required>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
            <button type="button" id="btn-cancel-edit-manga-modal" class="btn-secondary">Hủy</button>
            <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Lưu Ảnh Bìa & Thông Tin</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Event Listeners
    document.getElementById('btn-close-edit-manga-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-edit-manga-modal').addEventListener('click', () => this.close());
    document.getElementById('edit-manga-form').addEventListener('submit', (e) => this.handleSubmit(e));

    // Live preview listener on input
    const coverInput = document.getElementById('edit-manga-cover-url');
    coverInput.addEventListener('input', () => this.updateLivePreview(coverInput.value));
  }

  updateLivePreview(inputVal) {
    const previewBox = document.getElementById('edit-manga-preview-box');
    const previewImg = document.getElementById('edit-manga-preview-img');
    if (!inputVal || !inputVal.trim()) {
      if (previewBox) previewBox.style.display = 'none';
      return;
    }

    const val = inputVal.trim();
    const fileId = window.DriveHelper ? window.DriveHelper.extractFileId(val) : null;

    if (previewImg && previewBox) {
      previewImg.classList.remove('img-load-error');
      previewBox.style.display = 'block';

      if (fileId) {
        window.DriveHelper.attachImageFallback(previewImg, fileId, 500);
      } else {
        previewImg.src = val;
        previewImg.onerror = () => {
          previewImg.classList.add('img-load-error');
          previewImg.alt = 'Không thể tải ảnh từ URL.';
        };
      }
    }
  }

  open(manga) {
    if (!manga) return;
    this.targetManga = manga;

    document.getElementById('edit-manga-title').value = manga.title || '';
    document.getElementById('edit-manga-author').value = manga.author || manga.originalTitle || '';
    const currentCover = manga.coverUrl || manga.coverDriveId || '';
    document.getElementById('edit-manga-cover-url').value = currentCover;
    document.getElementById('edit-manga-description').value = manga.description || '';
    document.getElementById('edit-manga-genres').value = (manga.genres || []).join(', ');
    const passInput = document.getElementById('edit-manga-admin-password');
    if (passInput) passInput.value = '';

    this.updateLivePreview(currentCover);
    this.modalOverlay.classList.remove('hidden');
  }

  close() {
    this.modalOverlay.classList.add('hidden');
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (this.isSubmitting || !this.targetManga) return;

    const newTitle = document.getElementById('edit-manga-title').value.trim();
    const newAuthor = document.getElementById('edit-manga-author').value.trim();
    const newCoverInput = document.getElementById('edit-manga-cover-url').value.trim();
    const newDesc = document.getElementById('edit-manga-description').value.trim();
    const genresInput = document.getElementById('edit-manga-genres').value.trim();
    const adminPassword = document.getElementById('edit-manga-admin-password').value.trim();

    if (!newTitle || !newCoverInput || !adminPassword) {
      alert('Vui lòng điền đầy đủ Tên truyện, Link ảnh bìa và Mật khẩu Admin!');
      return;
    }

    this.isSubmitting = true;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    submitBtn.disabled = true;

    try {
      // Update targetManga fields
      this.targetManga.title = newTitle;
      this.targetManga.author = newAuthor;
      this.targetManga.description = newDesc;
      this.targetManga.genres = genresInput ? genresInput.split(',').map(g => g.trim()).filter(Boolean) : ['Google Drive'];

      const fileId = window.DriveHelper ? window.DriveHelper.extractFileId(newCoverInput) : null;
      if (fileId) {
        this.targetManga.coverDriveId = fileId;
        this.targetManga.coverUrl = newCoverInput;
      } else {
        this.targetManga.coverUrl = newCoverInput;
        this.targetManga.coverDriveId = '';
      }

      await this.state.updateManga(this.targetManga, adminPassword);

      this.close();
      if (this.onMangaUpdated) {
        this.onMangaUpdated(this.targetManga);
      }
    } catch (err) {
      console.error(err);
      alert('⚠️ Có lỗi xảy ra khi cập nhật ảnh bìa: ' + err.message);
    } finally {
      this.isSubmitting = false;
      submitBtn.innerHTML = originalBtnHtml;
      submitBtn.disabled = false;
    }
  }
};
