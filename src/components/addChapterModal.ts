/**
 * Modal dialog for adding new chapters to existing manga
 * Enhanced with modern Glassmorphism UI, Manga target preview banner,
 * live page counters, scanned thumbnail preview strip, and Admin password persistence.
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
      <div class="modal-content add-chapter-modal-content" style="max-width: 620px;">
        
        <!-- Modal Header -->
        <div class="modal-header">
          <div class="modal-header-title-group">
            <div class="modal-header-icon">
              <i class="fas fa-plus-circle"></i>
            </div>
            <div>
              <h2>Thêm Chương Mới</h2>
              <p class="modal-header-subtitle">Đăng tải nội dung chương tranh mới từ Google Drive</p>
            </div>
          </div>
          <button type="button" class="btn-icon" id="btn-close-add-chapter-modal" title="Đóng cửa sổ">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="add-chapter-form">
          <!-- Target Manga Preview Info Card -->
          <div class="modal-manga-target-card">
            <div class="target-card-cover" id="add-chapter-cover-preview">
              <img src="" alt="Cover" id="add-chapter-cover-img">
            </div>
            <div class="target-card-details">
              <div class="target-card-label">BỘ TRUYỆN MỤC TIÊU</div>
              <h3 id="add-chapter-manga-title-display">Solo Leveling</h3>
              <div class="target-card-meta">
                <span class="badge" id="add-chapter-current-count"><i class="fas fa-layer-group"></i> 0 chương</span>
                <span class="badge badge-accent" id="add-chapter-next-badge"><i class="fas fa-arrow-right"></i> Thêm chương mới</span>
              </div>
            </div>
          </div>

          <!-- Chapter Title Input -->
          <div class="form-group">
            <label for="add-chapter-title">
              <i class="fas fa-heading" style="color: #818cf8; margin-right: 4px;"></i> Tên Chương: *
            </label>
            <input type="text" id="add-chapter-title" placeholder="VD: Chương 4: Khởi Đầu Mới" required autocomplete="off">
          </div>

          <!-- Source Type Selector (Segmented Tabs) -->
          <div class="form-group">
            <label>
              <i class="fas fa-photo-video" style="color: #ec4899; margin-right: 4px;"></i> Nguồn Nội Dung Chương: *
            </label>
            <div class="modal-source-tabs">
              <button type="button" class="btn-source-tab active" id="btn-source-folder" data-source="folder">
                <i class="fas fa-folder-open tab-icon-folder"></i>
                <span>Quét Thư Mục Drive</span>
              </button>
              <button type="button" class="btn-source-tab" id="btn-source-images" data-source="images">
                <i class="fas fa-images tab-icon-images"></i>
                <span>Danh Sách Link Ảnh</span>
              </button>
              <button type="button" class="btn-source-tab" id="btn-source-pdf" data-source="pdf">
                <i class="fas fa-file-pdf tab-icon-pdf"></i>
                <span>Tệp PDF</span>
              </button>
            </div>
          </div>

          <!-- Tab 1: Folder Scan -->
          <div id="add-source-folder-tab" class="source-tab-content">
            <div class="form-group">
              <label for="add-chapter-folder-url">
                <i class="fab fa-google-drive" style="color: #4285F4; margin-right: 4px;"></i> Link Thư Mục Google Drive chứa ảnh chương:
              </label>
              <div class="input-with-action">
                <input type="text" id="add-chapter-folder-url" placeholder="https://drive.google.com/drive/folders/1abcxyz..." autocomplete="off">
                <button type="button" class="btn-secondary btn-scan-folder" id="btn-scan-add-chapter-folder">
                  <i class="fas fa-magic"></i> <span>Quét Ảnh</span>
                </button>
              </div>
              <div class="form-hint">
                <i class="fas fa-info-circle"></i> Thư mục Google Drive cần bật quyền <em>"Bất kỳ ai có liên kết đều có thể xem"</em>.
              </div>
            </div>

            <!-- Folder Scan Result & Preview Strip -->
            <div id="add-folder-scan-status" class="scan-status-box" style="display: none;"></div>
            <div id="add-folder-scan-preview" class="scan-preview-strip" style="display: none;"></div>
          </div>

          <!-- Tab 2: Batch Images -->
          <div id="add-source-images-tab" class="source-tab-content" style="display: none;">
            <div class="form-group">
              <label for="add-chapter-images-text">
                <i class="fas fa-list-ol" style="color: #34d399; margin-right: 4px;"></i> Dán danh sách ID / Link ảnh Google Drive (mỗi link 1 dòng):
              </label>
              <textarea id="add-chapter-images-text" rows="5" placeholder="https://drive.google.com/file/d/1abc...&#10;https://drive.google.com/file/d/2xyz...&#10;hoặc dán trực tiếp File ID"></textarea>
              <div class="form-counter-row">
                <span class="form-hint"><i class="fas fa-magic"></i> Tự động nhận diện Google Drive URL, Direct URL và ID.</span>
                <span class="badge" id="badge-images-count"><i class="fas fa-image"></i> 0 trang ảnh</span>
              </div>
            </div>
          </div>

          <!-- Tab 3: PDF File -->
          <div id="add-source-pdf-tab" class="source-tab-content" style="display: none;">
            <div class="form-group">
              <label for="add-chapter-pdf-url">
                <i class="fas fa-file-pdf" style="color: #ef4444; margin-right: 4px;"></i> Link Google Drive hoặc URL trực tiếp tệp PDF:
              </label>
              <input type="text" id="add-chapter-pdf-url" placeholder="https://drive.google.com/file/d/1abc.../view hoặc link .pdf" autocomplete="off">
              <div class="form-hint">
                <i class="fas fa-info-circle"></i> Hỗ trợ tệp PDF lưu trên Google Drive hoặc link trực tiếp .pdf chất lượng cao.
              </div>
            </div>
          </div>

          <!-- Optional Facebook Comment Thread -->
          <div class="form-group">
            <label for="add-chapter-fb-url">
              <i class="fab fa-facebook" style="color: #1877f2; margin-right: 4px;"></i> Link Bài Đăng Facebook Bình Luận (Tùy chọn):
            </label>
            <input type="text" id="add-chapter-fb-url" placeholder="https://www.facebook.com/.../posts/123456789" autocomplete="off">
            <div class="form-hint">Nhúng bài viết Facebook nếu muốn đồng bộ khung bình luận Facebook ở chương này.</div>
          </div>

          <!-- Admin Password Verification Card -->
          <div class="admin-auth-card">
            <div class="admin-auth-header">
              <div class="admin-auth-title">
                <i class="fas fa-shield-alt" style="color: #fbbf24;"></i>
                <span>Xác Thực Mật Khẩu Admin</span>
              </div>
              <span class="admin-auth-tag">Bảo mật Google Sheet</span>
            </div>
            
            <div class="admin-password-input-group">
              <div class="password-input-wrapper">
                <input type="password" id="add-chapter-admin-password" placeholder="Nhập mật khẩu Admin của bạn..." required autocomplete="current-password">
                <button type="button" class="btn-toggle-pw" id="btn-toggle-add-pw" title="Ẩn/Hiện mật khẩu">
                  <i class="fas fa-eye"></i>
                </button>
              </div>
            </div>

            <div class="admin-remember-row">
              <label class="remember-label">
                <input type="checkbox" id="add-chapter-remember-pw" checked>
                <span>Ghi nhớ mật khẩu trên thiết bị này</span>
              </label>
            </div>
          </div>

          <!-- Modal Action Buttons -->
          <div class="modal-actions-footer">
            <button type="button" class="btn-secondary btn-modal-cancel" id="btn-cancel-add-chapter">
              <i class="fas fa-times"></i> Hủy
            </button>
            <button type="submit" class="btn-primary btn-modal-submit" id="btn-submit-add-chapter">
              <i class="fas fa-plus-circle"></i> <span>Xác Nhận Thêm Chương</span>
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

    // Close buttons
    this.modalOverlay.querySelector('#btn-close-add-chapter-modal')?.addEventListener('click', () => this.close());
    this.modalOverlay.querySelector('#btn-cancel-add-chapter')?.addEventListener('click', () => this.close());

    // Switch Content Source Tabs
    const folderBtn = this.modalOverlay.querySelector('#btn-source-folder');
    const imagesBtn = this.modalOverlay.querySelector('#btn-source-images');
    const pdfBtn = this.modalOverlay.querySelector('#btn-source-pdf');

    const folderTab = this.modalOverlay.querySelector('#add-source-folder-tab') as HTMLElement | null;
    const imagesTab = this.modalOverlay.querySelector('#add-source-images-tab') as HTMLElement | null;
    const pdfTab = this.modalOverlay.querySelector('#add-source-pdf-tab') as HTMLElement | null;

    const setSourceTab = (type: 'folder' | 'images' | 'pdf') => {
      this.currentSourceType = type;
      folderBtn?.classList.toggle('active', type === 'folder');
      imagesBtn?.classList.toggle('active', type === 'images');
      pdfBtn?.classList.toggle('active', type === 'pdf');

      if (folderTab) folderTab.style.display = type === 'folder' ? 'block' : 'none';
      if (imagesTab) imagesTab.style.display = type === 'images' ? 'block' : 'none';
      if (pdfTab) pdfTab.style.display = type === 'pdf' ? 'block' : 'none';
    };

    folderBtn?.addEventListener('click', () => setSourceTab('folder'));
    imagesBtn?.addEventListener('click', () => setSourceTab('images'));
    pdfBtn?.addEventListener('click', () => setSourceTab('pdf'));

    // Live Batch Images Counter
    const imagesTextarea = this.modalOverlay.querySelector('#add-chapter-images-text') as HTMLTextAreaElement | null;
    const imagesCountBadge = this.modalOverlay.querySelector('#badge-images-count');
    imagesTextarea?.addEventListener('input', () => {
      const text = imagesTextarea.value.trim();
      const count = text ? DriveHelper.parseBatchInput(text).length : 0;
      if (imagesCountBadge) {
        imagesCountBadge.innerHTML = `<i class="fas fa-image"></i> ${count} trang ảnh`;
      }
    });

    // Scan Folder Button
    const btnScan = this.modalOverlay.querySelector('#btn-scan-add-chapter-folder') as HTMLButtonElement | null;
    const statusDiv = this.modalOverlay.querySelector('#add-folder-scan-status') as HTMLElement | null;
    const previewStrip = this.modalOverlay.querySelector('#add-folder-scan-preview') as HTMLElement | null;
    const folderInput = this.modalOverlay.querySelector('#add-chapter-folder-url') as HTMLInputElement | null;

    btnScan?.addEventListener('click', async () => {
      const folderVal = folderInput?.value.trim();
      if (!folderVal) {
        alert('Vui lòng nhập link thư mục Google Drive!');
        folderInput?.focus();
        return;
      }

      if (btnScan) {
        btnScan.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Đang quét...</span>';
        btnScan.disabled = true;
      }
      if (statusDiv) {
        statusDiv.style.display = 'flex';
        statusDiv.className = 'scan-status-box is-loading';
        statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin status-icon"></i> <span>Đang kết nối Google Drive và trích xuất danh sách trang ảnh...</span>';
      }
      if (previewStrip) {
        previewStrip.style.display = 'none';
        previewStrip.innerHTML = '';
      }

      try {
        const result = await DriveHelper.fetchFolderImages(folderVal);
        if (result && result.success && result.images && result.images.length > 0) {
          this.scannedPages = result.images;
          if (statusDiv) {
            statusDiv.className = 'scan-status-box is-success';
            statusDiv.innerHTML = `
              <i class="fas fa-check-circle status-icon"></i>
              <div>
                <strong>Quét thành công!</strong> Tìm thấy <strong>${result.images.length}</strong> trang ảnh từ thư mục.
              </div>
            `;
          }

          // Hiển thị dải ảnh xem trước (Thumbnail Strip)
          if (previewStrip) {
            previewStrip.style.display = 'flex';
            previewStrip.innerHTML = '';

            const previewCount = Math.min(result.images.length, 6);
            for (let i = 0; i < previewCount; i++) {
              const item = result.images[i];
              const thumbDiv = document.createElement('div');
              thumbDiv.className = 'scan-thumb-item';
              thumbDiv.title = `Trang ${i + 1}`;

              const thumbImg = document.createElement('img');
              thumbImg.alt = `Trang ${i + 1}`;
              thumbImg.referrerPolicy = 'no-referrer';
              thumbImg.loading = 'lazy';

              const fileId = DriveHelper.extractFileId(item);
              if (fileId) {
                DriveHelper.attachImageFallback(thumbImg, fileId, 160);
              } else {
                thumbImg.src = item;
              }

              const numBadge = document.createElement('span');
              numBadge.className = 'thumb-num';
              numBadge.textContent = String(i + 1);

              thumbDiv.appendChild(thumbImg);
              thumbDiv.appendChild(numBadge);
              previewStrip.appendChild(thumbDiv);
            }

            if (result.images.length > 6) {
              const moreDiv = document.createElement('div');
              moreDiv.className = 'scan-thumb-more';
              moreDiv.textContent = `+${result.images.length - 6} trang nữa`;
              previewStrip.appendChild(moreDiv);
            }
          }
        } else {
          this.scannedPages = [];
          if (statusDiv) {
            statusDiv.className = 'scan-status-box is-error';
            const errorMsg = String(result?.error || 'Không tìm thấy ảnh trong thư mục hoặc thư mục chưa bật quyền xem công khai!');
            statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle status-icon"></i> <div><strong>Lỗi quét ảnh:</strong> ${errorMsg}</div>`;
          }
        }
      } catch (err: any) {
        this.scannedPages = [];
        if (statusDiv) {
          statusDiv.className = 'scan-status-box is-error';
          const errorMsg = String(err?.message || err);
          statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle status-icon"></i> <div><strong>Lỗi kết nối:</strong> ${errorMsg}</div>`;
        }
      } finally {
        if (btnScan) {
          btnScan.innerHTML = '<i class="fas fa-magic"></i> <span>Quét Lại</span>';
          btnScan.disabled = false;
        }
      }
    });

    // Password Toggle Show/Hide
    const btnTogglePw = this.modalOverlay.querySelector('#btn-toggle-add-pw');
    const pwInput = this.modalOverlay.querySelector('#add-chapter-admin-password') as HTMLInputElement | null;
    btnTogglePw?.addEventListener('click', () => {
      if (!pwInput) return;
      const isPassword = pwInput.type === 'password';
      pwInput.type = isPassword ? 'text' : 'password';
      btnTogglePw.innerHTML = `<i class="fas fa-${isPassword ? 'eye-slash' : 'eye'}"></i>`;
    });

    // Form submit
    this.modalOverlay.querySelector('#add-chapter-form')?.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  open(manga: Manga): void {
    this.targetManga = manga;
    this.scannedPages = [];

    // Cập nhật thông tin truyện mục tiêu
    const mangaTitleDisplay = this.modalOverlay?.querySelector('#add-chapter-manga-title-display');
    const coverImg = this.modalOverlay?.querySelector('#add-chapter-cover-img') as HTMLImageElement | null;
    const currentCountBadge = this.modalOverlay?.querySelector('#add-chapter-current-count');
    const chapterTitleInput = this.modalOverlay?.querySelector('#add-chapter-title') as HTMLInputElement | null;
    const folderInput = this.modalOverlay?.querySelector('#add-chapter-folder-url') as HTMLInputElement | null;
    const imagesInput = this.modalOverlay?.querySelector('#add-chapter-images-text') as HTMLTextAreaElement | null;
    const pdfInput = this.modalOverlay?.querySelector('#add-chapter-pdf-url') as HTMLInputElement | null;
    const fbUrlInput = this.modalOverlay?.querySelector('#add-chapter-fb-url') as HTMLInputElement | null;
    const pwInput = this.modalOverlay?.querySelector('#add-chapter-admin-password') as HTMLInputElement | null;
    const statusDiv = this.modalOverlay?.querySelector('#add-folder-scan-status') as HTMLElement | null;
    const previewStrip = this.modalOverlay?.querySelector('#add-folder-scan-preview') as HTMLElement | null;
    const countBadge = this.modalOverlay?.querySelector('#badge-images-count');

    if (mangaTitleDisplay) mangaTitleDisplay.textContent = manga.title;

    const totalChapters = manga.chapters ? manga.chapters.length : 0;
    if (currentCountBadge) {
      currentCountBadge.innerHTML = `<i class="fas fa-layer-group"></i> ${totalChapters} chương hiện có`;
    }

    // Cover Image Fallback
    if (coverImg) {
      const coverFileId = manga.coverDriveId || DriveHelper.extractFileId(manga.coverUrl);
      if (coverFileId) {
        DriveHelper.attachImageFallback(coverImg, coverFileId, 160);
      } else if (manga.coverUrl) {
        coverImg.src = manga.coverUrl;
      } else {
        coverImg.src = 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=80';
      }
    }

    // Auto-calculate next chapter title
    if (chapterTitleInput) {
      const nextNum = totalChapters + 1;
      chapterTitleInput.value = `Chương ${nextNum}`;
    }

    // Reset inputs
    if (folderInput) folderInput.value = '';
    if (imagesInput) imagesInput.value = '';
    if (pdfInput) pdfInput.value = '';
    if (fbUrlInput) fbUrlInput.value = '';
    if (countBadge) countBadge.innerHTML = '<i class="fas fa-image"></i> 0 trang ảnh';
    if (statusDiv) statusDiv.style.display = 'none';
    if (previewStrip) {
      previewStrip.style.display = 'none';
      previewStrip.innerHTML = '';
    }

    // Auto-fill saved Admin Password from localStorage
    const savedPw = localStorage.getItem('drive_manga_admin_pw');
    if (pwInput && savedPw) {
      pwInput.value = savedPw;
    }

    this.modalOverlay?.classList.remove('hidden');
    chapterTitleInput?.focus();
  }

  close(): void {
    this.modalOverlay?.classList.add('hidden');
  }

  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.isSubmitting || !this.targetManga || !this.modalOverlay) return;

    const chapterTitle = (document.getElementById('add-chapter-title') as HTMLInputElement).value.trim();
    const adminPassword = (document.getElementById('add-chapter-admin-password') as HTMLInputElement).value.trim();
    const fbCommentUrl = (document.getElementById('add-chapter-fb-url') as HTMLInputElement)?.value.trim() || '';
    const rememberPw = (document.getElementById('add-chapter-remember-pw') as HTMLInputElement)?.checked;

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
      if (pages.length === 0) {
        alert('Không tìm thấy link ảnh hoặc File ID hợp lệ trong nội dung đã dán!');
        return;
      }
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

    // Save Admin Password if remember option checked
    if (rememberPw) {
      localStorage.setItem('drive_manga_admin_pw', adminPassword);
    }

    const submitBtn = this.modalOverlay.querySelector('#btn-submit-add-chapter') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Đang lưu lên Google Sheet...</span>';
    }
    this.isSubmitting = true;

    try {
      const newChapter: Chapter = {
        id: 'chap-' + ((this.targetManga.chapters ? this.targetManga.chapters.length : 0) + 1) + '-' + Date.now(),
        title: chapterTitle,
        updatedAt: new Date().toISOString().split('T')[0],
        pages: pages,
        pdfUrl: pdfUrl,
        isPdf: isPdf,
        fbCommentUrl: fbCommentUrl || undefined
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
    } catch (err: any) {
      console.error('Lỗi thêm chương:', err);
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> <span>Xác Nhận Thêm Chương</span>';
      }
    }
  }
}

if (typeof window !== 'undefined') {
  (window as any).AddChapterModalComponent = AddChapterModalComponent;
}
