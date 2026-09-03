/**
 * Modal dialog for editing existing chapter (content, title, PDF, images)
 * Upgraded with modern glassmorphism design system matching AddChapterModal.
 */

import { Manga, Chapter } from '../types/manga';
import { DriveHelper } from '../driveHelper';
import { getAdminSession, setAdminSession, escapeHtml } from '../utils/security';

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
      <div class="modal-content edit-chapter-modal-content" style="max-width: 620px;">
        
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-header-title-group">
            <div class="modal-header-icon" style="background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);">
              <i class="fas fa-edit"></i>
            </div>
            <div>
              <h2>Chỉnh Sửa Chương Truyện</h2>
              <p class="modal-header-subtitle">Cập nhật tiêu đề, nguồn ảnh Google Drive hoặc tệp PDF</p>
            </div>
          </div>
          <button type="button" class="btn-icon" id="btn-close-edit-chapter-modal" title="Đóng cửa sổ">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="edit-chapter-form">
          <!-- Target Manga & Chapter Info Card -->
          <div class="modal-manga-target-card">
            <div class="target-card-cover" id="edit-chapter-cover-preview">
              <img src="" alt="Cover" id="edit-chapter-cover-img">
            </div>
            <div class="target-card-details">
              <div class="target-card-label">BỘ TRUYỆN HIỆN TẠI</div>
              <h3 id="edit-chapter-manga-title-display">...</h3>
              <div class="target-card-meta">
                <span class="badge" id="edit-chapter-badge-chap"><i class="fas fa-bookmark"></i> Đang sửa chương</span>
                <span class="badge badge-accent" id="edit-chapter-pages-count"><i class="fas fa-layer-group"></i> 0 trang</span>
              </div>
            </div>
          </div>

          <!-- Chapter Title Input -->
          <div class="form-group">
            <label for="edit-chapter-title">
              <i class="fas fa-heading" style="color: #818cf8; margin-right: 4px;"></i> Tên Chương: *
            </label>
            <input type="text" id="edit-chapter-title" placeholder="VD: Chương 1: Khởi Đầu Mới" required autocomplete="off">
          </div>

          <!-- Source Type Selector (Segmented Tabs) -->
          <div class="form-group">
            <label>
              <i class="fas fa-photo-video" style="color: #ec4899; margin-right: 4px;"></i> Nguồn Nội Dung Chương: *
            </label>
            <div class="modal-source-tabs">
              <button type="button" class="btn-source-tab active" id="btn-edit-source-images" data-source="images">
                <i class="fas fa-images tab-icon-images"></i>
                <span>Danh Sách Link Ảnh</span>
              </button>
              <button type="button" class="btn-source-tab" id="btn-edit-source-folder" data-source="folder">
                <i class="fas fa-folder-open tab-icon-folder"></i>
                <span>Quét Lại Thư Mục</span>
              </button>
              <button type="button" class="btn-source-tab" id="btn-edit-source-pdf" data-source="pdf">
                <i class="fas fa-file-pdf tab-icon-pdf"></i>
                <span>Tệp PDF</span>
              </button>
            </div>
          </div>

          <!-- Tab 1: Batch Images List -->
          <div id="edit-source-images-tab" class="source-tab-content">
            <div class="form-group">
              <label for="edit-chapter-images-text">
                <i class="fas fa-list-ol" style="color: #38bdf8; margin-right: 4px;"></i> Danh sách ID / Link ảnh Google Drive (mỗi link một dòng):
              </label>
              <textarea id="edit-chapter-images-text" rows="6" placeholder="https://drive.google.com/file/d/1abc...&#10;https://drive.google.com/file/d/2xyz..."></textarea>
              <div class="form-hint">
                <i class="fas fa-info-circle"></i> Có thể dán trực tiếp ID hoặc toàn bộ URL ảnh Google Drive.
              </div>
            </div>
          </div>

          <!-- Tab 2: Folder Scan -->
          <div id="edit-source-folder-tab" class="source-tab-content" style="display: none;">
            <div class="form-group">
              <label for="edit-chapter-folder-url">
                <i class="fab fa-google-drive" style="color: #4285f4; margin-right: 4px;"></i> Link Thư Mục Google Drive mới:
              </label>
              <div class="input-with-action">
                <input type="text" id="edit-chapter-folder-url" placeholder="https://drive.google.com/drive/folders/1abcxyz..." autocomplete="off">
                <button type="button" class="btn-secondary btn-scan-folder" id="btn-scan-edit-chapter-folder">
                  <i class="fas fa-magic"></i> <span>Quét Ảnh</span>
                </button>
              </div>
              <div class="form-hint">
                <i class="fas fa-info-circle"></i> Quét lại toàn bộ thư mục nếu bạn vừa cập nhật thêm ảnh mới trên Google Drive.
              </div>
            </div>
            <div id="edit-folder-scan-status" style="display: none; padding: 12px; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem; line-height: 1.4;"></div>
          </div>

          <!-- Tab 3: PDF File -->
          <div id="edit-source-pdf-tab" class="source-tab-content" style="display: none;">
            <div class="form-group">
              <label for="edit-chapter-pdf-url">
                <i class="fas fa-file-pdf" style="color: #f43f5e; margin-right: 4px;"></i> Link Google Drive hoặc URL trực tiếp tệp PDF:
              </label>
              <input type="text" id="edit-chapter-pdf-url" placeholder="https://drive.google.com/file/d/1abc.../view hoặc link .pdf" autocomplete="off">
              <div class="form-hint">
                <i class="fas fa-info-circle"></i> Link tệp PDF từ Google Drive sẽ được nhúng chế độ xem cuộn toàn màn hình.
              </div>
            </div>
          </div>

          <!-- Admin Password Authenticator -->
          <div class="form-group">
            <label for="edit-chapter-admin-password">
              <i class="fas fa-shield-halved" style="color: #fbbf24; margin-right: 4px;"></i> Mật Khẩu Admin (Xác thực Google Sheet): *
            </label>
            <div style="position: relative;">
              <input type="password" id="edit-chapter-admin-password" placeholder="Nhập mật khẩu quản trị viên" required autocomplete="current-password">
            </div>
            <div class="form-hint">
              <i class="fas fa-lock"></i> Mật khẩu được mã hóa an toàn và tự hủy khi đóng tab trình duyệt.
            </div>
          </div>

          <!-- Modal Actions Footer -->
          <div class="modal-actions-footer">
            <button type="button" class="btn-secondary btn-modal-cancel" id="btn-cancel-edit-chapter">Hủy</button>
            <button type="submit" class="btn-primary btn-modal-submit" id="btn-submit-edit-chapter">
              <i class="fas fa-save"></i> <span>Lưu Thay Đổi</span>
            </button>
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

    const switchTab = (type: 'images' | 'folder' | 'pdf') => {
      this.currentSourceType = type;

      imagesBtn?.classList.toggle('active', type === 'images');
      folderBtn?.classList.toggle('active', type === 'folder');
      pdfBtn?.classList.toggle('active', type === 'pdf');

      if (imagesTab) imagesTab.style.display = type === 'images' ? 'block' : 'none';
      if (folderTab) folderTab.style.display = type === 'folder' ? 'block' : 'none';
      if (pdfTab) pdfTab.style.display = type === 'pdf' ? 'block' : 'none';
    };

    imagesBtn?.addEventListener('click', () => switchTab('images'));
    folderBtn?.addEventListener('click', () => switchTab('folder'));
    pdfBtn?.addEventListener('click', () => switchTab('pdf'));

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
        btnScan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Đang quét...</span>';
        (btnScan as HTMLButtonElement).disabled = true;
      }
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(99, 102, 241, 0.15)';
        statusDiv.style.color = '#818cf8';
        statusDiv.style.border = '1px solid rgba(99, 102, 241, 0.3)';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang kết nối và quét danh sách trang ảnh...';
      }

      try {
        const result = await DriveHelper.fetchFolderImages(folderVal);
        if (result && result.success && result.images && result.images.length > 0) {
          this.scannedPages = result.images;
          if (statusDiv) {
            statusDiv.style.background = 'rgba(16, 185, 129, 0.15)';
            statusDiv.style.color = '#34d399';
            statusDiv.style.border = '1px solid rgba(16, 185, 129, 0.3)';
            statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> Đã quét thành công <strong>${result.images.length}</strong> trang ảnh từ thư mục Drive!`;
          }
        } else {
          this.scannedPages = [];
          if (statusDiv) {
            statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
            statusDiv.style.color = '#f87171';
            statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
            const errorMsg = document.createTextNode(String(result?.error || 'Không tìm thấy ảnh trong thư mục!'));
            statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi: ';
            statusDiv.appendChild(errorMsg);
          }
        }
      } catch (err: any) {
        if (statusDiv) {
          statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
          statusDiv.style.color = '#f87171';
          statusDiv.style.border = '1px solid rgba(239, 68, 68, 0.3)';
          const errorMsg = document.createTextNode(String(err?.message || err));
          statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi kết nối: ';
          statusDiv.appendChild(errorMsg);
        }
      } finally {
        if (btnScan) {
          btnScan.innerHTML = '<i class="fas fa-magic"></i> <span>Quét Lại</span>';
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

    // Cập nhật Manga Target Card
    const mangaTitleDisplay = this.modalOverlay?.querySelector('#edit-chapter-manga-title-display') as HTMLElement | null;
    const badgeChap = this.modalOverlay?.querySelector('#edit-chapter-badge-chap') as HTMLElement | null;
    const pagesCount = this.modalOverlay?.querySelector('#edit-chapter-pages-count') as HTMLElement | null;
    const coverImg = this.modalOverlay?.querySelector('#edit-chapter-cover-img') as HTMLImageElement | null;

    if (mangaTitleDisplay) mangaTitleDisplay.textContent = manga.title;
    if (badgeChap) badgeChap.innerHTML = `<i class="fas fa-bookmark"></i> ${escapeHtml(chapter.title)}`;
    if (pagesCount) pagesCount.innerHTML = `<i class="fas fa-layer-group"></i> ${chapter.pages?.length || 0} trang`;

    const coverFileId = manga.coverDriveId || DriveHelper.extractFileId(manga.coverUrl);
    if (coverImg && coverFileId) {
      DriveHelper.attachImageFallback(coverImg, coverFileId, 200);
    } else if (coverImg && manga.coverUrl) {
      coverImg.src = manga.coverUrl;
    }

    // Cập nhật các trường input
    const chapterTitleInput = this.modalOverlay?.querySelector('#edit-chapter-title') as HTMLInputElement | null;
    const imagesTextarea = this.modalOverlay?.querySelector('#edit-chapter-images-text') as HTMLTextAreaElement | null;
    const pdfInput = this.modalOverlay?.querySelector('#edit-chapter-pdf-url') as HTMLInputElement | null;
    const statusDiv = this.modalOverlay?.querySelector('#edit-folder-scan-status') as HTMLElement | null;

    if (chapterTitleInput) chapterTitleInput.value = chapter.title;
    if (statusDiv) statusDiv.style.display = 'none';

    if (chapter.isPdf || chapter.pdfUrl) {
      if (pdfInput) pdfInput.value = chapter.pdfUrl || (chapter.pages ? chapter.pages[0] : '');
      const btnPdf = this.modalOverlay?.querySelector('#btn-edit-source-pdf') as HTMLButtonElement | null;
      btnPdf?.click();
    } else {
      if (imagesTextarea) {
        imagesTextarea.value = (chapter.pages || []).join('\n');
      }
      const btnImages = this.modalOverlay?.querySelector('#btn-edit-source-images') as HTMLButtonElement | null;
      btnImages?.click();
    }

    const pwInput = this.modalOverlay?.querySelector('#edit-chapter-admin-password') as HTMLInputElement | null;
    const savedPw = getAdminSession();
    if (pwInput && savedPw) {
      pwInput.value = savedPw;
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
    setAdminSession(adminPassword);

    const submitBtn = this.modalOverlay.querySelector('#btn-submit-edit-chapter') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Đang lưu...</span>';
    }
    this.isSubmitting = true;

    try {
      this.targetChapter.title = newTitle;
      this.targetChapter.pages = newPages;
      this.targetChapter.pdfUrl = newPdfUrl;
      this.targetChapter.isPdf = isPdf;
      this.targetChapter.updatedAt = new Date().toISOString().split('T')[0];

      // Sắp xếp danh sách chương theo thứ tự tự nhiên của tên chương
      if (this.targetManga.chapters && this.targetManga.chapters.length > 1) {
        this.targetManga.chapters.sort((a, b) =>
          (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' })
        );
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
        submitBtn.innerHTML = '<i class="fas fa-save"></i> <span>Lưu Thay Đổi</span>';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.EditChapterModalComponent = EditChapterModalComponent;
}
