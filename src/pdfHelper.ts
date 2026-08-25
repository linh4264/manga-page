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
   * Check if a string is a PDF URL or Google Drive PDF link/ID
   */
  isPdfSource(input?: string | null): boolean {
    if (!input || typeof input !== 'string') return false;
    const lower = input.toLowerCase();
    if (lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('/pdf') || input.startsWith('data:application/pdf')) {
      return true;
    }
    // Check if string contains drive.google.com and has a valid file ID
    if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
      const fileId = DriveHelper.extractFileId(input);
      return !!fileId;
    }
    return false;
  },

  /**
   * Get direct download/fetch URL for a Google Drive PDF File ID
   */
  getDrivePdfDownloadUrl(fileId: string): string {
    const cleanId = DriveHelper.extractFileId(fileId) || fileId;
    return `https://drive.google.com/uc?export=download&id=${cleanId}`;
  },

  /**
   * Get Google Drive PDF Embedded Preview URL
   */
  getDrivePdfEmbedUrl(fileId: string): string {
    const cleanId = DriveHelper.extractFileId(fileId) || fileId;
    return `https://drive.google.com/file/d/${cleanId}/preview`;
  },

  /**
   * Render tệp PDF trực tiếp bằng Google Drive PDF Embedded Viewer Iframe chuẩn.
   */
  renderPdfToContainer(pdfSource: string, container: HTMLElement, onProgress?: (totalPages: number) => void): void {
    const fileId = DriveHelper.extractFileId(pdfSource) || pdfSource;
    const embedUrl = (fileId && !fileId.startsWith('http')) ? this.getDrivePdfEmbedUrl(fileId) : pdfSource;

    container.innerHTML = `
      <iframe src="${embedUrl}" style="width: 100%; height: 100vh; border: none; background: transparent; display: block; margin: 0; padding: 0;" allow="autoplay"></iframe>
    `;

    if (onProgress) onProgress(1);
  }
};

if (typeof window !== 'undefined') {
  window.PdfHelper = PdfHelper;
}
