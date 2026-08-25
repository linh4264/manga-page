/**
 * Modal dialog for adding new chapters to existing manga
 */

import { Manga, Chapter } from '../types/manga';
import { DriveHelper } from '../driveHelper';

export class AddChapterModalComponent {
  state: any;
  onChapterAdded?: (manga: Manga, newChapter: Chapter) => void;
  targetManga: Manga | null = null;
  currentSourceType: 'folder' | 'images' | 'pdf' = 'folder';
  isSubmitting = false;
  modalOverlay: HTMLElement | null = null;
  scannedPages: string[] = [];

  constructor(appState: any, onChapterAdded?: (manga: Manga, newChapter: Chapter) => void) {
    this.state = appState;
    this.onChapterAdded = onChapterAdded;
    this.createModal();
  }

  createModal(): void {
    const existing = document.getElementById('add-chapter-modal-overlay');
    if (existing) existing.remove();

    this.modalOverlay = document.createElement('div');
    this.modalOverlay.id = 'add-chapter-modal-overlay';
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.innerHTML = `
      <div class="modal-card glass-panel" style="max-width: 600px;">
        <div class="modal-header">
          <h2><i class="fas fa-plus-circle" style="color: #6366f1;"></i> Thêm Chương Mới</h2>
          <button class="btn-icon" id="btn-close-add-chapter-modal"><i class="fas fa-times"></i></button>
        </div>

        <form id="add-chapter-form">
          <div class="form-group">
            <label>Tên Truyện:</label>
            <input type="text" id="add-chapter-manga-title" disabled style="background: rgba(0,0,0,0.2); color: var(--text-secondary);">
          </div>

          <div class="form-group">
            <label for="add-chapter-title">Tên Chương: *</label>
            <input type="text" id="add-chapter-title" placeholder="VD: Chương 4: Khởi Đầu Mới" required>
          </div>

          <div class="form-group">
            <label>Nguồn Nội Dung Chương: *</label>
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
              <button type="button" class="chip-filter active" id="btn-source-folder" style="font-size: 0.85rem;"><i class="fas fa-folder-open"></i> Quét Thư Mục Drive</button>
              <button type="button" class="chip-filter" id="btn-source-images" style="font-size: 0.85rem;"><i class="fas fa-images"></i> Danh Sách Link Ảnh</button>
              <button type="button" class="chip-filter" id="btn-source-pdf" style="font-size: 0.85rem;"><i class="fas fa-file-pdf"></i> Tệp PDF</button>
            </div>
          </div>

          <!-- Tab 1: Folder Scan -->
          <div id="add-source-folder-tab">
            <div class="form-group">
              <label for="add-chapter-folder-url">Link Thư Mục Google Drive chứa ảnh chương:</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="add-chapter-folder-url" placeholder="https://drive.google.com/drive/folders/1abcxyz..." style="flex: 1;">
                <button type="button" class="btn-secondary" id="btn-scan-add-chapter-folder" style="white-space: nowrap;">
                  <i class="fas fa-magic"></i> Quét Ảnh
                </button>
              </div>
              <small style="color: var(--text-muted); font-size: 0.75rem; margin-top: 4px; display: block;">
                Thư mục cần bật quyền <em>"Bất kỳ ai có liên kết đều có thể xem"</em>.
              </small>
            </div>
            <div id="add-folder-scan-status" style="display: none; padding: 10px; border-radius: var(--radius-sm); margin-bottom: 1rem; font-size: 0.85rem;"></div>
          </div>

          <!-- Tab 2: Batch Images -->
          <div id="add-source-images-tab" style="display: none;">
            <div class="form-group">
              <label for="add-chapter-images-text">Dán danh sách ID / Link ảnh Google Drive (mỗi link 1 dòng):</label>
              <textarea id="add-chapter-images-text" rows="5" placeholder="https://drive.google.com/file/d/1abc...&#10;https://drive.google.com/file/d/2xyz..."></textarea>
            </div>
          </div>

          <!-- Tab 3: PDF File -->
          <div id="add-source-pdf-tab" style="display: none;">
            <div class="form-group">
              <label for="add-chapter-pdf-url">Link Google Drive hoặc URL trực tiếp tệp PDF:</label>
              <input type="text" id="add-chapter-pdf-url" placeholder="https://drive.google.com/file/d/1abc.../view hoặc link .pdf">
            </div>
          </div>

          <div class="form-group">
            <label for="add-chapter-admin-password"><i class="fas fa-lock" style="color: #fbbf24;"></i> Mật Khẩu Admin (Xác thực với Google Sheet): *</label>
            <input type="password" id="add-chapter-admin-password" placeholder="Nhập mã bảo mật để lưu lên Google Sheet" required>
          </div>

          <div class="modal-actions" style="margin-top: 1.5rem;">
            <button type="button" class="btn-secondary" id="btn-cancel-add-chapter">Hủy</button>
            <button type="submit" class="btn-primary"><i class="fas fa-plus-circle"></i> Xác Nhận Thêm Chương</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);
    this.bindEvents();
  }

  bindEvents(): void {
    if (!this.modalOverlay) return;

    this.modalOverlay.querySelector('#btn-close-add-chapter-modal')?.addEventListener('click', () => this.close());
    this.modalOverlay.querySelector('#btn-cancel-add-chapter')?.addEventListener('click', () => this.close());

    // Switch Content Source Tabs
    const folderBtn = this.modalOverlay.querySelector('#btn-source-folder');
    const imagesBtn = this.modalOverlay.querySelector('#btn-source-images');
    const pdfBtn = this.modalOverlay.querySelector('#btn-source-pdf');

    const folderTab = this.modalOverlay.querySelector('#add-source-folder-tab') as HTMLElement | null;
    const imagesTab = this.modalOverlay.querySelector('#add-source-images-tab') as HTMLElement | null;
    const pdfTab = this.modalOverlay.querySelector('#add-source-pdf-tab') as HTMLElement | null;

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
    const btnScan = this.modalOverlay.querySelector('#btn-scan-add-chapter-folder');
    const statusDiv = this.modalOverlay.querySelector('#add-folder-scan-status') as HTMLElement | null;
    const folderInput = this.modalOverlay.querySelector('#add-chapter-folder-url') as HTMLInputElement | null;

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
            statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Lỗi: ${result?.error || 'Không tìm thấy ảnh trong thư mục!'}`;
          }
        }
      } catch (err: any) {
        if (statusDiv) {
          statusDiv.style.background = 'rgba(239, 68, 68, 0.15)';
          statusDiv.style.color = '#f87171';
          statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Lỗi kết nối: ${err.message || err}`;
        }
      } finally {
        if (btnScan) {
          btnScan.innerHTML = '<i class="fas fa-magic"></i> Quét Lại';
          (btnScan as HTMLButtonElement).disabled = false;
        }
      }
    });

    // Form submit
    this.modalOverlay.querySelector('#add-chapter-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open(manga: Manga): void {
    this.targetManga = manga;
    this.scannedPages = [];

    const mangaTitleInput = this.modalOverlay?.querySelector('#add-chapter-manga-title') as HTMLInputElement | null;
    const chapterTitleInput = this.modalOverlay?.querySelector('#add-chapter-title') as HTMLInputElement | null;
    const statusDiv = this.modalOverlay?.querySelector('#add-folder-scan-status') as HTMLElement | null;

    if (mangaTitleInput) mangaTitleInput.value = manga.title;
    if (chapterTitleInput) {
      const nextNum = (manga.chapters ? manga.chapters.length : 0) + 1;
      chapterTitleInput.value = `Chương ${nextNum}`;
    }
    if (statusDiv) statusDiv.style.display = 'none';

    this.modalOverlay?.classList.remove('hidden');
  }

  close(): void {
    this.modalOverlay?.classList.add('hidden');
  }

  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.isSubmitting || !this.targetManga || !this.modalOverlay) return;

    const chapterTitle = (document.getElementById('add-chapter-title') as HTMLInputElement).value.trim();
    const adminPassword = (document.getElementById('add-chapter-admin-password') as HTMLInputElement).value.trim();

    let pages: string[] = [];
    let pdfUrl = '';
    let isPdf = false;

    if (this.currentSourceType === 'folder') {
      const folderUrl = (document.getElementById('add-chapter-folder-url') as HTMLInputElement).value.trim();
      if (!folderUrl) {
        alert('Vui lòng nhập link thư mục Google Drive chứa ảnh!');
        return;
      }
      if (this.scannedPages.length > 0) {
        pages = this.scannedPages;
      } else {
        const res = await DriveHelper.fetchFolderImages(folderUrl);
        if (res && res.success && res.images && res.images.length > 0) {
          pages = res.images;
        } else {
          alert('Không thể quét ảnh từ thư mục Google Drive: ' + (res.error || 'Lỗi'));
          return;
        }
      }
    } else if (this.currentSourceType === 'images') {
      const imagesText = (document.getElementById('add-chapter-images-text') as HTMLTextAreaElement).value.trim();
      if (!imagesText) {
        alert('Vui lòng dán danh sách ID / link ảnh!');
        return;
      }
      pages = DriveHelper.parseBatchInput(imagesText);
    } else if (this.currentSourceType === 'pdf') {
      pdfUrl = (document.getElementById('add-chapter-pdf-url') as HTMLInputElement).value.trim();
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

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang thêm chương...';
    }
    this.isSubmitting = true;

    try {
      const newChapter: Chapter = {
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

      // Sắp xếp danh sách chương theo thứ tự tự nhiên của tên chương
      this.targetManga.chapters.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' }));

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
}

if (typeof window !== 'undefined') {
  window.AddChapterModalComponent = AddChapterModalComponent;
}
