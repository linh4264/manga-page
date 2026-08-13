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
   * Render tệp PDF trực tiếp bằng Google Drive PDF Embedded Viewer Iframe chuẩn.
   * @param {string} pdfSource (URL hoặc File ID)
   * @param {HTMLElement} container 
   * @param {Function} onProgress callback
   */
  renderPdfToContainer(pdfSource, container, onProgress) {
    const fileId = window.DriveHelper ? window.DriveHelper.extractFileId(pdfSource) || pdfSource : pdfSource;
    const embedUrl = (fileId && !fileId.startsWith('http')) ? this.getDrivePdfEmbedUrl(fileId) : pdfSource;

    container.innerHTML = `
      <iframe src="${embedUrl}" style="width: 100%; height: 100vh; border: none; background: transparent; display: block; margin: 0; padding: 0;" allow="autoplay"></iframe>
    `;

    if (onProgress) onProgress(1);
  }
};
