/**
 * Import Modal: Create and import new manga from Google Drive folders, batch images, or PDF.
 */

import { Manga } from '../types/manga';
import { DriveHelper } from '../driveHelper';

export class ImportModalComponent {
  state: any;
  onMangaAdded?: (manga: Manga) => void;
  modalOverlay: HTMLElement | null = null;
  currentSourceType: 'folder' | 'images' | 'pdf' = 'folder';
  scannedPages: string[] = [];
  isSubmitting = false;

  constructor(appState: any, onMangaAdded?: (manga: Manga) => void) {
    this.state = appState;
    this.onMangaAdded = onMangaAdded;
    this.initModalDOM();
  }

  initModalDOM(): void {
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'modal-overlay hidden';
    this.modalOverlay.id = 'import-modal-overlay';

    this.modalOverlay.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2><i class="fab fa-google-drive" style="color: #4285F4;"></i> Thêm Truyện Drive Mới</h2>
          <button id="btn-close-import-modal" class="btn-icon"><i class="fas fa-times"></i></button>
        </div>

        <form id="import-manga-form">
          <div class="form-group">
            <label>Tên Truyện *</label>
            <input type="text" id="import-title" placeholder="VD: Solo Leveling" required>
          </div>

          <div class="form-group">
            <label>Tác Giả / Studio</label>
            <input type="text" id="import-author" placeholder="VD: DUBU / Chugong">
          </div>

          <div class="form-group">
            <label>Thể Loại (phân cách bằng dấu phẩy)</label>
            <input type="text" id="import-genres" placeholder="VD: Action, Fantasy, Manhwa">
          </div>

          <div class="form-group">
            <label>Ảnh Bìa (Google Drive Link / Direct Image URL)</label>
            <input type="text" id="import-cover" placeholder="Dán link Google Drive hoặc URL ảnh bìa">
          </div>

          <div class="form-group">
            <label>Mô Tả Truyện</label>
            <textarea id="import-description" rows="2" placeholder="Nhập mô tả ngắn về bộ truyện..."></textarea>
          </div>

          <hr style="border-color: var(--border-subtle); margin: 1.2rem 0;">

          <h3 style="font-size: 1.1rem; margin-bottom: 0.8rem; font-family: 'Outfit', sans-serif;">
            <i class="fas fa-layer-group"></i> Thông Tin Chương 1
          </h3>

          <div class="form-group">
            <label>Tên Chương *</label>
            <input type="text" id="import-chapter-title" value="Chương 1: Khởi Đầu" required>
          </div>

          <!-- Định dạng nguồn ảnh/PDF -->
          <div class="form-group">
            <label><i class="fas fa-layer-group" style="color: #818cf8;"></i> Định Dạng Nguồn Đọc *</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 4px;">
              <button type="button" class="btn-import-source-tab active" data-source="folder" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: rgba(99, 102, 241, 0.2); color: #ffffff; cursor: pointer; text-align: center;">
                <i class="fas fa-folder-open" style="color: #fbbf24; margin-right: 4px;"></i> Thư Mục Drive
              </button>
              <button type="button" class="btn-import-source-tab" data-source="images" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-align: center;">
                <i class="fas fa-images" style="color: #34d399; margin-right: 4px;"></i> Danh Sách Ảnh
              </button>
              <button type="button" class="btn-import-source-tab" data-source="pdf" style="padding: 8px 6px; font-size: 0.8rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: transparent; color: var(--text-secondary); cursor: pointer; text-align: center;">
                <i class="fas fa-file-pdf" style="color: #ef4444; margin-right: 4px;"></i> Tệp PDF
              </button>
            </div>
          </div>

          <!-- Tab 1: Link Thư Mục Google Drive -->
          <div id="import-box-folder" class="import-source-box">
            <div class="form-group">
              <label><i class="fab fa-google-drive" style="color: #4285F4;"></i> Link Thư Mục Google Drive * (Chứa tất cả ảnh của chương 1)</label>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="import-folder-url" placeholder="VD: https://drive.google.com/drive/folders/1aBcDeFgHi..." style="flex: 1;">
                <button type="button" id="btn-scan-import-folder" class="btn-secondary" style="padding: 0 14px; font-size: 0.82rem; white-space: nowrap;">
                  <i class="fas fa-search"></i> Quét Ảnh
                </button>
              </div>
              <div class="form-hint">Hệ thống sẽ tự động quét tất cả file ảnh trong thư mục và sắp xếp từ trang 1 đến hết.</div>
              <div id="import-folder-scan-status" style="margin-top: 8px; font-size: 0.82rem; display: none;"></div>
            </div>
          </div>

          <!-- Tab 2: Danh Sách Link Ảnh Hàng Loạt -->
          <div id="import-box-images" class="import-source-box" style="display: none;">
            <div class="form-group">
              <label><i class="fas fa-images" style="color: #34d399;"></i> Danh Sách Link Ảnh / File ID (Mỗi dòng 1 ảnh hoặc dán hàng loạt)</label>
              <textarea id="import-images-text" rows="3" placeholder="Dán các đường link ảnh Google Drive hoặc File ID vào đây (cách nhau bởi dấu xuống dòng)..."></textarea>
            </div>
          </div>

          <!-- Tab 3: Tệp PDF -->
          <div id="import-box-pdf" class="import-source-box" style="display: none;">
            <div class="form-group">
              <label><i class="fas fa-file-pdf" style="color: #ef4444;"></i> Đường Dẫn Tệp PDF (Link Google Drive / URL .pdf)</label>
              <input type="text" id="import-pdf-url" placeholder="VD: https://drive.google.com/file/d/1BxiMVs0XRA5.../view">
            </div>
          </div>

          <!-- Admin Password Verification Field -->
          <div class="form-group" style="background: rgba(99, 102, 241, 0.1); padding: 10px; border-radius: var(--radius-sm); border: 1px solid rgba(129, 140, 248, 0.3);">
            <label style="color: #818cf8; font-weight: 700;"><i class="fas fa-lock"></i> Mật Khẩu Admin *</label>
            <input type="password" id="import-admin-password" placeholder="Nhập mật khẩu Admin để xác thực..." required>
          </div>

          <div class="modal-footer-row">
            <button type="button" id="btn-export-catalog" class="btn-secondary" title="Tải về file sampleManga.ts để đè vào dự án trước khi deploy">
              <i class="fas fa-download" style="color: #818cf8;"></i> Xuất File Dữ Liệu
            </button>

            <div class="modal-footer-actions">
              <button type="button" id="btn-cancel-import" class="btn-secondary">Hủy</button>
              <button type="submit" class="btn-primary"><i class="fas fa-plus"></i> Thêm Vào Thư Viện</button>
            </div>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    // Bind Source Tabs Switcher
    this.modalOverlay.querySelectorAll('.btn-import-source-tab').forEach(btnEl => {
      const btn = btnEl as HTMLElement;
      btn.addEventListener('click', () => {
        this.modalOverlay?.querySelectorAll('.btn-import-source-tab').forEach(b => {
          const el = b as HTMLElement;
          el.classList.remove('active');
          el.style.background = 'transparent';
          el.style.color = 'var(--text-secondary)';
        });
        btn.classList.add('active');
        btn.style.background = 'rgba(99, 102, 241, 0.2)';
        btn.style.color = '#ffffff';

        const source = btn.dataset.source as 'folder' | 'images' | 'pdf';
        this.currentSourceType = source;

        const boxFolder = document.getElementById('import-box-folder');
        const boxImages = document.getElementById('import-box-images');
        const boxPdf = document.getElementById('import-box-pdf');

        if (boxFolder) boxFolder.style.display = source === 'folder' ? 'block' : 'none';
        if (boxImages) boxImages.style.display = source === 'images' ? 'block' : 'none';
        if (boxPdf) boxPdf.style.display = source === 'pdf' ? 'block' : 'none';
      });
    });

    // Bind Scan Button
    document.getElementById('btn-scan-import-folder')?.addEventListener('click', () => this.handleScanFolder());
    document.getElementById('import-folder-url')?.addEventListener('change', () => this.handleScanFolder());

    // Event listeners
    document.getElementById('btn-close-import-modal')?.addEventListener('click', () => this.close());
    document.getElementById('btn-cancel-import')?.addEventListener('click', () => this.close());
    document.getElementById('btn-export-catalog')?.addEventListener('click', () => this.exportCatalogFile());

    document.getElementById('import-manga-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
  }

  async handleScanFolder(): Promise<void> {
    const folderInput = (document.getElementById('import-folder-url') as HTMLInputElement | null)?.value.trim() || '';
    const statusEl = document.getElementById('import-folder-scan-status');
    const scanBtn = document.getElementById('btn-scan-import-folder') as HTMLButtonElement | null;

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

    const res = await DriveHelper.fetchFolderImages(folderInput);
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

  open(): void {
    this.scannedPages = [];
    const statusEl = document.getElementById('import-folder-scan-status');
    if (statusEl) statusEl.style.display = 'none';
    this.modalOverlay?.classList.remove('hidden');
  }

  close(): void {
    this.modalOverlay?.classList.add('hidden');
    (document.getElementById('import-manga-form') as HTMLFormElement | null)?.reset();
  }

  async handleFormSubmit(): Promise<void> {
    if (this.isSubmitting || !this.modalOverlay) return;

    const title = (document.getElementById('import-title') as HTMLInputElement).value.trim();
    const author = (document.getElementById('import-author') as HTMLInputElement).value.trim() || 'Tác giả chưa cập nhật';
    const genresInput = (document.getElementById('import-genres') as HTMLInputElement).value.trim();
    const coverInput = (document.getElementById('import-cover') as HTMLInputElement).value.trim();
    const description = (document.getElementById('import-description') as HTMLTextAreaElement).value.trim();
    const chapterTitle = (document.getElementById('import-chapter-title') as HTMLInputElement).value.trim();
    const adminPassword = (document.getElementById('import-admin-password') as HTMLInputElement).value.trim();

    let pages: string[] = [];
    let pdfUrl = '';
    let isPdf = false;

    if (this.currentSourceType === 'folder') {
      const folderUrl = (document.getElementById('import-folder-url') as HTMLInputElement).value.trim();
      if (!folderUrl) {
        alert('Vui lòng dán link Thư mục Google Drive!');
        return;
      }

      if (this.scannedPages.length > 0) {
        pages = this.scannedPages;
      } else {
        const res = await DriveHelper.fetchFolderImages(folderUrl);
        if (res && res.success && res.images && res.images.length > 0) {
          pages = res.images;
        } else {
          alert('Không thể lấy ảnh từ Thư mục Google Drive!\n\nLỗi: ' + (res.error || 'Thư mục trống hoặc chưa mở quyền chia sẻ.'));
          return;
        }
      }
    } else if (this.currentSourceType === 'images') {
      const imagesText = (document.getElementById('import-images-text') as HTMLTextAreaElement).value.trim();
      pages = DriveHelper.parseBatchInput(imagesText);
      if (pages.length === 0) {
        alert('Vui lòng dán ít nhất 1 link hoặc File ID ảnh!');
        return;
      }
    } else if (this.currentSourceType === 'pdf') {
      pdfUrl = (document.getElementById('import-pdf-url') as HTMLInputElement).value.trim();
      if (!pdfUrl) {
        alert('Vui lòng dán đường dẫn tệp PDF Google Drive hoặc PDF URL!');
        return;
      }
      pages = [pdfUrl];
      isPdf = true;
    }

    if (!adminPassword) {
      alert('Vui lòng nhập Mật khẩu Admin để xác thực quyền đăng truyện!');
      return;
    }

    const submitBtn = this.modalOverlay.querySelector('button[type="submit"]') as HTMLButtonElement | null;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang đăng...';
    }
    this.isSubmitting = true;

    try {
      const defaultGenres = ['Google Drive', 'Webtoon'];

      const newManga: Manga = {
        id: 'custom-' + Date.now(),
        title: title,
        originalTitle: title,
        author: author,
        artist: author,
        status: 'Đang tiến hành',
        coverUrl: coverInput && !DriveHelper.extractFileId(coverInput) ? coverInput : '',
        coverDriveId: DriveHelper.extractFileId(coverInput) || '',
        description: description || 'Bộ truyện được tạo từ Google Drive.',
        genres: genresInput ? genresInput.split(',').map(g => g.trim()) : defaultGenres,
        rating: 5.0,
        views: '1',
        chapters: [
          {
            id: 'chap-1',
            title: chapterTitle,
            updatedAt: new Date().toISOString().split('T')[0],
            pages: pages,
            pdfUrl: pdfUrl,
            isPdf: isPdf
          }
        ]
      };

      await this.state.addCustomManga(newManga, adminPassword);
      this.close();
      
      if (this.onMangaAdded) {
        this.onMangaAdded(newManga);
      }
    } finally {
      this.isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Thêm Vào Thư Viện';
      }
    }
  }

  exportCatalogFile(): void {
    const allManga = this.state.getAllManga();
    const fileContent = `/**\n * Manga Catalog Database for Public Deployment.\n * Formatted automatically for DriveManga.\n */\n\nimport { Manga } from '../types/manga';\n\nexport const SAMPLE_MANGA_DATA: Manga[] = ${JSON.stringify(allManga, null, 2)};\n\nif (typeof window !== 'undefined') {\n  window.SAMPLE_MANGA_DATA = SAMPLE_MANGA_DATA;\n}\n`;
    
    const blob = new Blob([fileContent], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sampleManga.ts';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('Đã xuất tệp sampleManga.ts thành công! Bạn có thể lưu vào thư mục src/data/sampleManga.ts để làm dữ liệu offline mặc định.');
  }
}

if (typeof window !== 'undefined') {
  window.ImportModalComponent = ImportModalComponent;
}
