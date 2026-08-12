/**
 * Modal component cho phép SỬA ĐỔI LINK PDF của một chương đã có.
 * Tự động cập nhật trực tiếp lên Google Sheet Database.
 */

window.EditChapterModalComponent = class EditChapterModalComponent {
  constructor(appState, onChapterUpdated) {
    this.state = appState;
    this.onChapterUpdated = onChapterUpdated;
    this.targetManga = null;
    this.targetChapter = null;
    this.modalOverlay = null;

    this.initModalDOM();
  }

  initModalDOM() {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'edit-chapter-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-edit" style="color: #4285F4;"></i> Chỉnh Sửa Link PDF Chương</h2>
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

          <!-- PDF Link Input -->
          <div class="form-group">
            <label>Đường Dẫn Tệp PDF Mới (Link Google Drive / URL .pdf) *</label>
            <input type="text" id="edit-chapter-pdf-url" placeholder="VD: https://drive.google.com/file/d/.../view" required>
            <div class="form-hint">Dán đường dẫn tệp PDF Google Drive mới hoặc link PDF online</div>
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

    // Event Listeners
    document.getElementById('btn-close-edit-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-edit-chapter-modal').addEventListener('click', () => this.close());
    document.getElementById('edit-chapter-form').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open(manga, chapter) {
    if (!manga || !chapter) return;
    this.targetManga = manga;
    this.targetChapter = chapter;

    document.getElementById('edit-chapter-manga-title').value = manga.title;
    document.getElementById('edit-chapter-title').value = chapter.title;
    document.getElementById('edit-chapter-pdf-url').value = chapter.pdfUrl || (chapter.pages ? chapter.pages[0] : '');
    document.getElementById('edit-chapter-fb-url').value = chapter.fbCommentUrl || '';
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
    const newPdfUrl = document.getElementById('edit-chapter-pdf-url').value.trim();
    const fbCommentUrl = document.getElementById('edit-chapter-fb-url').value.trim();
    const adminPassword = document.getElementById('edit-chapter-admin-password').value.trim();

    if (!newPdfUrl) {
      alert('Vui lòng dán đường dẫn tệp PDF mới!');
      return;
    }

    if (!adminPassword) {
      alert('Vui lòng nhập Mật khẩu Admin để xác thực quyền sửa chương!');
      return;
    }

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
    }
    this.isSubmitting = true;

    try {
      // Update chapter properties
      this.targetChapter.title = newTitle;
      this.targetChapter.pdfUrl = newPdfUrl;
      this.targetChapter.pages = [newPdfUrl];
      this.targetChapter.fbCommentUrl = fbCommentUrl;
      this.targetChapter.isPdf = true;
      this.targetChapter.updatedAt = new Date().toISOString().split('T')[0];

      // Update manga to Google Sheet and state with Admin Password
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
