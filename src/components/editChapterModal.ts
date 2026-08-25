/**
 * Modal dialog for editing existing chapter (content, title, FB comments, PDF, images)
 */

import { Manga, Chapter } from '../types/manga';
import { DriveHelper } from '../driveHelper';

export class EditChapterModalComponent {
  state: any;
  onChapterUpdated?: (manga: Manga, updatedChapter: Chapter) => void;
  targetManga: Manga | null = null;
  targetChapter: Chapter | null = null;
  currentSourceType: 'folder' | 'images' | 'pdf' = 'images';
  isSubmitting = false;
  modalOverlay: HTMLElement | null = null;
  scannedPages: string[] = [];

  constructor(appState: any, onChapterUpdated?: (manga: Manga, updatedChapter: Chapter) => void) {
    this.state = appState;
    this.onChapterUpdated = onChapterUpdated;
    this.createModal();
  }

  createModal(): void {
    const existing = document.getElementById('edit-chapter-modal-overlay');
    if (existing) existing.remove();

    this.modalOverlay = document.createElement('div');
    this.modalOverlay.id = 'edit-chapter-modal-overlay';
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.innerHTML = `
      <div class="modal-card glass-panel" style="max-width: 600px;">
        <div class="modal-header">
          <h2><i class="fas fa-edit" style="color: #6366f1;"></i> Chỉnh Sửa Chương Truyện</h2>
          <button class="btn-icon" id="btn-close-edit-chapter-modal"><i class="fas fa-times"></i></button>
        </div>

        <form id="edit-chapter-form">
          <div class="form-group">
            <label>Tên Truyện:</label>
            <input type="text" id="edit-chapter-manga-title" disabled style="background: rgba(0,0,0,0.2); color: var(--text-secondary);">
          </div>

          <div class="form-group">
            <label for="edit-chapter-title">Tên Chương: *</label>
            <input type="text" id="edit-chapter-title" placeholder="VD: Chương 1: Khởi Đầu Mới" required>
          </div>

          <div class="form-group">
            <label>Cập Nhật Nguồn Nội Dung Chương:</label>
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <button type="button" class="chip-filter active" id="btn-edit-source-images" style="font-size: 0.85rem;"><i class="fas fa-images"></i> Danh Sách Link Ảnh</button>
              <button type="button" class="chip-filter" id="btn-edit-source-folder" style="font-size: 0.85rem;"><i class="fas fa-folder-open"></i> Quét Lại Thư Mục</button>
              <button type="button" class="chip-filter" id="btn-edit-source-pdf" style="font-size: 0.85rem;"><i class="fas fa-file-pdf"></i> Tệp PDF</button>
            </div>
          </div>

          <!-- Tab 1: Batch Images -->
          <div id="edit-source-images-tab">
            <div class="form-group">
              <label for="edit-chapter-images-text">Danh sách ID / Link ảnh Google Drive hiện tại (mỗi link 1 dòng):</label>
              <textarea id="edit-chapter-images-text" rows="6" placeholder="https://drive.google.com/file/d/1abc...&#10;https://drive.google.com/file/d/2xyz..."></textarea>
            </div>
          </div>

          <!-- Tab 2: Folder Scan -->
          <div id="edit-source-folder-tab" style="display: none;">
            <div class="form-group">
              <label for="edit-chapter-folder-url">Link Thư Mục Google Drive mới:</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="edit-chapter-folder-url" placeholder="https://drive.google.com/drive/folders/1abcxyz..." style="flex: 1;">
                <button type="button" class="btn-secondary" id="btn-scan-edit-chapter-folder" style="white-space: nowrap;">
                  <i class="fas fa-magic"></i> Quét Ảnh
                </button>
              </div>
            </div>
            <div id="edit-folder-scan-status" style="display: none; padding: 10px; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem;"></div>
          </div>

          <!-- Tab 3: PDF File -->
          <div id="edit-source-pdf-tab" style="display: none;">
            <div class="form-group">
              <label for="edit-chapter-pdf-url">Link Google Drive hoặc URL trực tiếp tệp PDF:</label>
              <input type="text" id="edit-chapter-pdf-url" placeholder="https://drive.google.com/file/d/1abc.../view hoặc link .pdf">
            </div>
          </div>

          <div class="form-group">
            <label for="edit-chapter-fb-url"><i class="fab fa-facebook" style="color: #1877f2;"></i> Link Bài Đăng Facebook Bình Luận Chương (Tùy chọn):</label>
            <input type="text" id="edit-chapter-fb-url" placeholder="https://www.facebook.com/.../posts/123456789">
            <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">
              Dán URL bài viết Facebook nếu muốn nhúng khung bình luận của bài viết đó vào cuối chương đọc.
            </small>
          </div>

          <div class="form-group">
            <label for="edit-chapter-admin-password"><i class="fas fa-lock" style="color: #fbbf24;"></i> Mật Khẩu Admin (Xác thực với Google Sheet): *</label>
            <input type="password" id="edit-chapter-admin-password" placeholder="Nhập mã bảo mật để lưu lên Google Sheet" required>
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem;">
            <button type="button" class="btn-secondary" id="btn-cancel-edit-chapter">Hủy</button>
            <button type="submit" class="btn-primary"><i class="fas fa-save"></i> Lưu Thay Đổi</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);
    this.bindEvents();
  }

  bindEvents(): void {
    if (!this.modalOverlay) return;

    this.modalOverlay.querySelector('#btn-close-edit-chapter-modal')?.addEventListener('click', () => this.close());
    this.modalOverlay.querySelector('#btn-cancel-edit-chapter')?.addEventListener('click', () => this.close());

    // Switch Content Source Tabs
    const folderBtn = this.modalOverlay.querySelector('#btn-edit-source-folder');
    const imagesBtn = this.modalOverlay.querySelector('#btn-edit-source-images');
    const pdfBtn = this.modalOverlay.querySelector('#btn-edit-source-pdf');

    const folderTab = this.modalOverlay.querySelector('#edit-source-folder-tab') as HTMLElement | null;
    const imagesTab = this.modalOverlay.querySelector('#edit-source-images-tab') as HTMLElement | null;
    const pdfTab = this.modalOverlay.querySelector('#edit-source-pdf-tab') as HTMLElement | null;

    folderBtn?.addEventListener('click', () => {
      folderBtn.classList.add('active');
      imagesBtn?.classList.remove('active');
      pdfBtn?.classList.remove('active');
      if (folderTab) folderTab.style.display = 'block';
      if (imagesTab) imagesTab.style.display = 'none';
      if (pdfTab) pdfTab.style.display = 'none';
      this.currentSourceType = 'folder';
    });

    imagesBtn?.addEventListener('click', () => {
      imagesBtn.classList.add('active');
      folderBtn?.classList.remove('active');
      pdfBtn?.classList.remove('active');
      if (folderTab) folderTab.style.display = 'none';
      if (imagesTab) imagesTab.style.display = 'block';
      if (pdfTab) pdfTab.style.display = 'none';
      this.currentSourceType = 'images';
    });

    pdfBtn?.addEventListener('click', () => {
      pdfBtn.classList.add('active');
      folderBtn?.classList.remove('active');
      imagesBtn?.classList.remove('active');
      if (folderTab) folderTab.style.display = 'none';
      if (imagesTab) imagesTab.style.display = 'none';
      if (pdfTab) pdfTab.style.display = 'block';
      this.currentSourceType = 'pdf';
    });

    // Scan Folder Button
    const btnScan = this.modalOverlay.querySelector('#btn-scan-edit-chapter-folder');
    const statusDiv = this.modalOverlay.querySelector('#edit-folder-scan-status') as HTMLElement | null;
    const folderInput = this.modalOverlay.querySelector('#edit-chapter-folder-url') as HTMLInputElement | null;

    btnScan?.addEventListener('click', async () => {
      const folderVal = folderInput?.value.trim();
      if (!folderVal) {
        alert('Vui lòng nhập link thư mục Google Drive!');
        return;
      }

      if (btnScan) {
        btnScan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang quét...';
        (btnScan as HTMLButtonElement).disabled = true;
      }
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(99, 102, 241, 0.15)';
        statusDiv.style.color = '#818cf8';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kết nối và quét danh sách trang ảnh...';
      }

      try {
        const result = await DriveHelper.fetchFolderImages(folderVal);
        if (result && result.success && result.images && result.images.length > 0) {
          this.scannedPages = result.images;
          if (statusDiv) {
            statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
            statusDiv.style.color = '#34d399';
            statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> Đã quét thành công <strong>${result.images.length}</strong> trang ảnh từ thư mục!`;
          }
        } else {
          this.scannedPages = [];
          if (statusDiv) {
            statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            statusDiv.style.color = '#f87171';
            const errorMsg = document.createTextNode(String(result?.error || 'Không tìm thấy ảnh trong thư mục!'));
            statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi: ';
            statusDiv.appendChild(errorMsg);
          }
        }
      } catch (err: any) {
        if (statusDiv) {
          statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
          statusDiv.style.color = '#f87171';
          const errorMsg = document.createTextNode(String(err?.message || err));
          statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi kết nối: ';
          statusDiv.appendChild(errorMsg);
        }
      } finally {
        if (btnScan) {
          btnScan.innerHTML = '<i class="fas fa-magic"></i> Quét Lại';
          (btnScan as HTMLButtonElement).disabled = false;
        }
      }
    });

    // Form submit
    this.modalOverlay.querySelector('#edit-chapter-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open(manga: Manga, chapter: Chapter): void {
    this.targetManga = manga;
    this.targetChapter = chapter;
    this.scannedPages = [];

    const mangaTitleInput = this.modalOverlay?.querySelector('#edit-chapter-manga-title') as HTMLInputElement | null;
    const chapterTitleInput = this.modalOverlay?.querySelector('#edit-chapter-title') as HTMLInputElement | null;
    const imagesTextarea = this.modalOverlay?.querySelector('#edit-chapter-images-text') as HTMLTextAreaElement | null;
    const pdfInput = this.modalOverlay?.querySelector('#edit-chapter-pdf-url') as HTMLInputElement | null;
    const fbInput = this.modalOverlay?.querySelector('#edit-chapter-fb-url') as HTMLInputElement | null;
    const statusDiv = this.modalOverlay?.querySelector('#edit-folder-scan-status') as HTMLElement | null;

    if (mangaTitleInput) mangaTitleInput.value = manga.title;
    if (chapterTitleInput) chapterTitleInput.value = chapter.title;
    if (fbInput) fbInput.value = chapter.fbCommentUrl || '';
    if (statusDiv) statusDiv.style.display = 'none';

    if (chapter.isPdf || chapter.pdfUrl) {
      if (pdfInput) pdfInput.value = chapter.pdfUrl || (chapter.pages ? chapter.pages[0] : '');
      const btnPdf = this.modalOverlay?.querySelector('#btn-edit-source-pdf') as HTMLElement | null;
      btnPdf?.click();
    } else {
      if (imagesTextarea) {
        imagesTextarea.value = (chapter.pages || []).join('\n');
      }
      const btnImages = this.modalOverlay?.querySelector('#btn-edit-source-images') as HTMLElement | null;
      btnImages?.click();
    }

    this.modalOverlay?.classList.remove('hidden');
  }

  close(): void {
    this.modalOverlay?.classList.add('hidden');
  }

  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.isSubmitting || !this.targetManga || !this.targetChapter || !this.modalOverlay) return;

    const newTitle = (document.getElementById('edit-chapter-title') as HTMLInputElement).value.trim();
    const newFbUrl = (document.getElementById('edit-chapter-fb-url') as HTMLInputElement).value.trim();
    const adminPassword = (document.getElementById('edit-chapter-admin-password') as HTMLInputElement).value.trim();

    let newPages = this.targetChapter.pages || [];
    let newPdfUrl = this.targetChapter.pdfUrl || '';
    let isPdf = this.targetChapter.isPdf || false;

    if (this.currentSourceType === 'folder') {
      const folderUrl = (document.getElementById('edit-chapter-folder-url') as HTMLInputElement).value.trim();
      if (folderUrl) {
        if (this.scannedPages.length > 0) {
          newPages = this.scannedPages;
          isPdf = false;
          newPdfUrl = '';
        } else {
          const res = await DriveHelper.fetchFolderImages(folderUrl);
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
      const imagesText = (document.getElementById('edit-chapter-images-text') as HTMLTextAreaElement).value.trim();
      if (imagesText) {
        newPages = DriveHelper.parseBatchInput(imagesText);
        isPdf = false;
        newPdfUrl = '';
      }
    } else if (this.currentSourceType === 'pdf') {
      const pdfInput = (document.getElementById('edit-chapter-pdf-url') as HTMLInputElement).value.trim();
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

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]') as HTMLButtonElement | null;
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
}

if (typeof window !== 'undefined') {
  window.EditChapterModalComponent = EditChapterModalComponent;
}
