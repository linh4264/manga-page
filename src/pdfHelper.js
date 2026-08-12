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
   * Check if a string is a PDF URL or Google Drive PDF link/ID
   * @param {string} input 
   * @returns {boolean}
   */
  isPdfSource(input) {
    if (!input || typeof input !== 'string') return false;
    const lower = input.toLowerCase();
    if (lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf') || input.startsWith('data:application/pdf')) {
      return true;
    }
    // Check if string contains drive.google.com and has a valid file ID
    if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
      const fileId = window.DriveHelper ? window.DriveHelper.extractFileId(input) : null;
      return !!fileId;
    }
    return false;
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
   * Get Google Drive PDF Embedded Preview URL
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
        <h3>Đang giải mã tệp PDF sang Canvas...</h3>
        <p>Vui lòng chờ trong giây lát</p>
      </div>
    `;

    // Extract File ID if it's a Google Drive link
    const fileId = window.DriveHelper ? window.DriveHelper.extractFileId(pdfSource) : null;
    const loadUrl = fileId ? this.getDrivePdfDownloadUrl(fileId) : pdfSource;

    let pdfDoc = null;

    if (window.pdfjsLib) {
      try {
        let pdfData = null;

        // Ưu tiên 1: Đọc trực tiếp ArrayBuffer (Cho tệp local / base64 / direct PDF URL)
        try {
          if (pdfSource.startsWith('data:application/pdf')) {
            pdfData = pdfSource;
          } else {
            const resp = await fetch(loadUrl);
            if (resp.ok) {
              pdfData = await resp.arrayBuffer();
            }
          }
        } catch (e1) {
          console.log('Trực tiếp fetch PDF bị rào cản CORS Google Drive, chuyển sang đọc qua CORS Proxy...');
        }

        // Ưu tiên 2: Nếu dính CORS Google Drive, dùng CORS Proxy đọc mảng byte ArrayBuffer
        if (!pdfData && fileId) {
          try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(loadUrl)}`;
            const respProxy = await fetch(proxyUrl);
            if (respProxy.ok) {
              pdfData = await respProxy.arrayBuffer();
            }
          } catch (e2) {
            console.log('CORS Proxy 1 không khả dụng, dùng Proxy 2...');
            try {
              const proxyUrl2 = `https://api.allorigins.win/raw?url=${encodeURIComponent(loadUrl)}`;
              const respProxy2 = await fetch(proxyUrl2);
              if (respProxy2.ok) {
                pdfData = await respProxy2.arrayBuffer();
              }
            } catch (e3) {}
          }
        }

        const sourceParam = pdfData ? { data: pdfData } : { url: loadUrl };
        const loadingTask = window.pdfjsLib.getDocument({
          ...sourceParam,
          cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
          cMapPacked: true,
        });

        pdfDoc = await loadingTask.promise;
      } catch (err) {
        console.warn('Không thể đọc PDF bằng Canvas PDF.js:', err);
      }
    }

    // Nếu vẽ thành công bằng Canvas HTML5 thuần (100% KHÔNG CÓ IFRAME, KHÔNG CÓ NÚT POP-OUT, KHÔNG CÓ THANH TRANG)
    if (pdfDoc) {
      const numPages = pdfDoc.numPages;
      if (onProgress) onProgress(numPages);

      container.innerHTML = ''; // Clear spinner

      for (let i = 1; i <= numPages; i++) {
        const pageDiv = document.createElement('div');
        pageDiv.className = 'reader-page-item pdf-page-item';
        pageDiv.dataset.pageIndex = i - 1;

        const canvas = document.createElement('canvas');
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.margin = '0 auto 12px auto';
        canvas.style.borderRadius = 'var(--radius-sm)';

        pageDiv.appendChild(canvas);
        container.appendChild(pageDiv);

        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.8 });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: canvas.getContext('2d'),
          viewport: viewport
        };

        page.render(renderContext);
      }
      return;
    }

    // Dự phòng cực hạn nếu tất cả các cổng fetch Canvas thất bại
    if (fileId) {
      this.renderDriveEmbedFallback(fileId, container);
    } else {
      container.innerHTML = `
        <div style="padding: 4rem; text-align: center; color: #f87171;">
          <i class="fas fa-exclamation-triangle" style="font-size: 2.5rem; margin-bottom: 1rem;"></i>
          <h3>Không thể giải mã tệp PDF</h3>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Vui lòng kiểm tra lại quyền chia sẻ file PDF trên Google Drive (Cần để chế độ Bất kỳ ai có liên kết).</p>
        </div>
      `;
    }
  },

  /**
   * Render Google Drive Embedded Viewer dự phòng (Iframe gốc của Google Drive)
   */
  renderDriveEmbedFallback(fileId, container) {
    const embedUrl = this.getDrivePdfEmbedUrl(fileId);
    container.innerHTML = `
      <iframe src="${embedUrl}" style="width: 100%; height: 100vh; border: none; background: transparent; display: block; margin-top: 0;" allow="autoplay"></iframe>
    `;
  }
};
