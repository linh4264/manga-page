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

          <!-- PDF Link Input -->
          <div class="form-group">
            <label>Đường Dẫn Tệp PDF (Link Google Drive / URL .pdf) *</label>
            <input type="text" id="add-chap-pdf-url" placeholder="VD: https://drive.google.com/file/d/.../view hoặc URL tệp .pdf" required>
            <div class="form-hint">Dán đường dẫn tệp PDF trên Google Drive hoặc link PDF online</div>
          </div>

          <!-- Admin Password Field -->
          <div class="form-group" style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: var(--radius-sm); border: 1px solid rgba(129, 140, 248, 0.3);">
            <label style="color: #818cf8; font-weight: 700;"><i class="fas fa-lock"></i> Mật Khẩu Admin *</label>
            <input type="password" id="add-chap-admin-password" placeholder="Nhập mật khẩu Admin để xác thực..." required>
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
    document.getElementById('add-chapter-form').addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open(manga) {
    if (!manga) return;
    this.targetManga = manga;

    const nextChapNum = (manga.chapters ? manga.chapters.length : 0) + 1;
    document.getElementById('add-chapter-manga-title').value = manga.title;
    document.getElementById('add-chapter-title').value = `Chương ${nextChapNum}`;
    document.getElementById('add-chap-pdf-url').value = '';
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
    const pdfUrl = document.getElementById('add-chap-pdf-url').value.trim();
    const adminPassword = document.getElementById('add-chap-admin-password').value.trim();

    if (!pdfUrl) {
      alert('Vui lòng dán đường dẫn tệp PDF!');
      return;
    }

    if (!adminPassword) {
      alert('Vui lòng nhập Mật khẩu Admin để xác thực quyền thêm chương!');
      return;
    }

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang thêm...';
    }
    this.isSubmitting = true;

    try {
      const newChapter = {
        id: 'chap-' + ((this.targetManga.chapters ? this.targetManga.chapters.length : 0) + 1) + '-' + Date.now(),
        title: chapterTitle,
        updatedAt: new Date().toISOString().split('T')[0],
        pages: [pdfUrl],
        pdfUrl: pdfUrl,
        isPdf: true
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
