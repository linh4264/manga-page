/**
 * Utility for loading and rendering PDF files (from Google Drive or Direct PDF URLs)
 * using Mozilla PDF.js and Google Drive Embed Fallbacks.
 */

import { DriveHelper } from './driveHelper';

export const PdfHelper = {
  /**
   * Initialize PDF.js worker configuration if available
   */
  initWorker(): void {
    if (typeof window !== 'undefined' && window.pdfjsLib && !window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  },

  /**
   * Check if a string is a PDF URL or PDF data URI
   */
  isPdfSource(input?: string | null): boolean {
    if (!input || typeof input !== 'string') return false;
    const trimmed = input.trim();
    const lower = trimmed.toLowerCase();
    if (
      lower.endsWith('.pdf') ||
      lower.includes('.pdf?') ||
      lower.includes('.pdf#') ||
      lower.includes('/pdf') ||
      trimmed.startsWith('data:application/pdf')
    ) {
      return true;
    }
    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.toLowerCase();
      if (pathname.endsWith('.pdf') || pathname.includes('/pdf')) {
        return true;
      }
    } catch {
      // Not a full URL
    }
    return false;
  },

  /**
   * Get direct download/fetch URL for a Google Drive PDF File ID
   */
  getDrivePdfDownloadUrl(fileId: string): string {
    const cleanId = DriveHelper.extractFileId(fileId) || (/^[a-zA-Z0-9_-]{20,60}$/.test(fileId.trim()) ? fileId.trim() : null);
    if (!cleanId) return '';
    return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(cleanId)}`;
  },

  /**
   * Get Google Drive PDF Embedded Preview URL
   */
  getDrivePdfEmbedUrl(fileId: string): string {
    const cleanId = DriveHelper.extractFileId(fileId) || (/^[a-zA-Z0-9_-]{20,60}$/.test(fileId.trim()) ? fileId.trim() : null);
    if (!cleanId) return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(cleanId)}/preview`;
  },

  /**
   * Render tệp PDF trực tiếp bằng Google Drive PDF Embedded Viewer Iframe chuẩn.
   */
  renderPdfToContainer(pdfSource: string, container: HTMLElement, onProgress?: (totalPages: number) => void): void {
    if (!container) return;
    const fileId = DriveHelper.extractFileId(pdfSource);
    let embedUrl = fileId ? this.getDrivePdfEmbedUrl(fileId) : '';

    if (!embedUrl && typeof pdfSource === 'string') {
      const trimmed = pdfSource.trim();
      if (DriveHelper.isValidImageUrl(trimmed) || trimmed.startsWith('blob:')) {
        embedUrl = trimmed;
      }
    }

    container.innerHTML = '';
    if (!embedUrl) {
      const errDiv = document.createElement('div');
      errDiv.className = 'img-load-error';
      errDiv.style.cssText = 'padding: 2rem; text-align: center; color: var(--text-muted);';
      errDiv.textContent = 'Nguồn PDF không hợp lệ hoặc không an toàn.';
      container.appendChild(errDiv);
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.src = embedUrl;
    iframe.style.width = '100%';
    iframe.style.height = '100vh';
    iframe.style.border = 'none';
    iframe.style.background = 'transparent';
    iframe.style.display = 'block';
    iframe.style.margin = '0';
    iframe.style.padding = '0';
    iframe.allow = 'autoplay';
    container.appendChild(iframe);

    if (onProgress) onProgress(1);
  }
};

if (typeof window !== 'undefined') {
  window.PdfHelper = PdfHelper;
}
