/**
 * Utility for loading and rendering PDF files (from Google Drive or Direct PDF URLs)
 * using Mozilla PDF.js and Google Drive Embed Fallbacks.
 */

window.PdfHelper = {
  /**
   * Initialize PDF.js worker configuration if available
   */
  initWorker() {
    if (window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  },

  /**
   * Check if a string is a PDF URL or Google Drive PDF link
   * @param {string} input 
   * @returns {boolean}
   */
  isPdfSource(input) {
    if (!input || typeof input !== 'string') return false;
    const lower = input.toLowerCase();
    return lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf') || input.startsWith('data:application/pdf');
  },

  /**
   * Get direct download/fetch URL for a Google Drive PDF File ID
   * @param {string} fileId 
   * @returns {string}
   */
  getDrivePdfDownloadUrl(fileId) {
    const cleanId = window.DriveHelper ? window.DriveHelper.extractFileId(fileId) || fileId : fileId;
    return `https://drive.google.com/uc?export=download&id=${cleanId}`;
  },

  /**
   * Get Google Drive PDF Embedded Preview URL (IFrame fallback)
   * @param {string} fileId 
   * @returns {string}
   */
  getDrivePdfEmbedUrl(fileId) {
    const cleanId = window.DriveHelper ? window.DriveHelper.extractFileId(fileId) || fileId : fileId;
    return `https://drive.google.com/file/d/${cleanId}/preview`;
  },

  /**
   * Render PDF pages into a target container element using PDF.js.
   * If CORS prevents direct binary fetch, fallback to Google Drive Embed Preview iframe.
   * @param {string} pdfSource (URL, File ID, or Data URL)
   * @param {HTMLElement} container 
   * @param {Function} onProgress (pageCount) callback
   */
  async renderPdfToContainer(pdfSource, container, onProgress) {
    this.initWorker();
    container.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: var(--text-secondary);">
        <i class="fas fa-spinner fa-spin" style="font-size: 2.5rem; margin-bottom: 1rem; color: var(--accent-primary);"></i>
        <h3>Đang giải mã tệp PDF...</h3>
        <p>Vui lòng chờ trong giây lát</p>
      </div>
    `;

    // Extract File ID if it's a Google Drive link
    const fileId = window.DriveHelper ? window.DriveHelper.extractFileId(pdfSource) : null;
    const loadUrl = fileId ? this.getDrivePdfDownloadUrl(fileId) : pdfSource;

    if (!window.pdfjsLib) {
      // PDF.js CDN not available, fallback to embed iframe if Drive ID available
      if (fileId) {
        this.renderDriveEmbedFallback(fileId, container);
        return;
      } else {
        container.innerHTML = `<div style="padding:2rem; color:#f87171;">Thư viện PDF.js chưa được tải.</div>`;
        return;
      }
    }

    try {
      const loadingTask = window.pdfjsLib.getDocument({
        url: loadUrl,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true,
      });

      const pdfDoc = await loadingTask.promise;
      const numPages = pdfDoc.numPages;

      if (onProgress) onProgress(numPages);

      container.innerHTML = ''; // Clear loading spinner

      // Render each page of PDF as a canvas item
      for (let i = 1; i <= numPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'reader-page-item pdf-page-item';
        pageDiv.dataset.pageIndex = i - 1;

        const canvas = document.createElement('canvas');
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto';

        pageDiv.appendChild(canvas);
        container.appendChild(pageDiv);

        // Render page asynchronously
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.8 }); // High quality render scale
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: canvas.getContext('2d'),
          viewport: viewport
        };

        page.render(renderContext);
      }
    } catch (err) {
      console.warn('PDF.js direct fetch failed (likely CORS on Drive link), switching to Google Drive Embed Preview player:', err);
      if (fileId) {
        this.renderDriveEmbedFallback(fileId, container);
      } else {
        container.innerHTML = `
          <div style="padding: 4rem; text-align: center; color: #f87171;">
            <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
            <h3>Không thể tải tệp PDF</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem;">${err.message || 'Kiểm tra lại đường dẫn tệp PDF hoặc quyền truy cập Google Drive.'}</p>
          </div>
        `;
      }
    }
  },

  /**
   * Render Google Drive Native Embedded Viewer inside the container as fallback
   */
  renderDriveEmbedFallback(fileId, container) {
    const embedUrl = this.getDrivePdfEmbedUrl(fileId);
    container.innerHTML = `
      <div style="width: 100%; height: calc(100vh - 120px); border-radius: var(--radius-md); overflow: hidden; border: 1px solid var(--bg-glass-border);">
        <div style="padding: 8px 16px; background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fab fa-google-drive"></i> Đang hiển thị trình đọc Google Drive PDF nhúng</span>
          <a href="https://drive.google.com/file/d/${fileId}/view" target="_blank" style="color: #fff; text-decoration: underline;">Mở trên Google Drive <i class="fas fa-external-link-alt"></i></a>
        </div>
        <iframe src="${embedUrl}" style="width: 100%; height: calc(100% - 36px); border: none;" allow="autoplay"></iframe>
      </div>
    `;
  }
};
