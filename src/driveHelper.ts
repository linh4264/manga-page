/**
 * Utility functions for parsing Google Drive links and transforming them into direct displayable image URLs.
 */

import { DriveImageUrls, FolderScanResult } from './types/manga';
import { SheetDatabase } from './sheetDatabase';

export const DriveHelper = {
  /**
   * Extract a Google Drive File ID from various link formats or raw ID strings.
   */
  extractFileId(input?: string | null): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    // Direct match for standard /file/d/{id}/ format
    const fileDMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
    if (fileDMatch) return fileDMatch[1];

    // Match for id={id} parameter format
    const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (idParamMatch) return idParamMatch[1];

    // Match for googleusercontent /d/{id} format
    const userContentMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
    if (userContentMatch) return userContentMatch[1];

    // If string itself looks like a raw Google Drive File ID
    if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  },

  /**
   * Extract Google Drive Folder ID from a folder link or raw ID
   */
  extractFolderId(input?: string | null): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();

    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]{20,})/);
    if (folderMatch) return folderMatch[1];

    const folderParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
    if (folderParamMatch && trimmed.includes('folder')) return folderParamMatch[1];

    if (/^[a-zA-Z0-9_-]{25,50}$/.test(trimmed)) {
      return trimmed;
    }

    return null;
  },

  /**
   * Lấy danh sách toàn bộ ID ảnh từ thư mục Google Drive qua Google Apps Script
   */
  async fetchFolderImages(folderIdOrUrl: string): Promise<FolderScanResult> {
    const folderId = this.extractFolderId(folderIdOrUrl);
    if (!folderId) {
      return { success: false, error: 'Link thư mục Google Drive không hợp lệ! Vui lòng dán link có dạng: https://drive.google.com/drive/folders/...' };
    }

    const apiUrl = SheetDatabase?.apiUrl || (typeof window !== 'undefined' ? window.SheetDatabase?.apiUrl : null);
    if (!apiUrl) {
      return { success: false, error: 'Chưa kết nối Google Sheet/Apps Script API!' };
    }

    try {
      const response = await fetch(`${apiUrl}?action=getFolderImages&folderId=${encodeURIComponent(folderId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: FolderScanResult = await response.json();
      return data;
    } catch (err: any) {
      console.warn('Lỗi lấy ảnh từ thư mục Google Drive:', err);
      return { success: false, error: err.message || 'Không thể kết nối với thư mục Google Drive.' };
    }
  },

  /**
   * Parse a batch text input containing multiple Drive links or IDs (one per line or space-separated).
   */
  parseBatchInput(rawText?: string | null): string[] {
    if (!rawText) return [];
    const tokens = rawText.split(/[\r\n,\s]+/);
    const ids: string[] = [];
    for (const token of tokens) {
      const extracted = this.extractFileId(token);
      if (extracted && !ids.includes(extracted)) {
        ids.push(extracted);
      }
    }
    return ids;
  },

  /**
   * Get direct displayable image URLs for a Google Drive File ID.
   * Returns primary Edge CDN proxy, Google UserContent CDN link, and alternative fallback links.
   */
  getImageUrls(fileId?: string | null, width: number | null = null): DriveImageUrls {
    if (!fileId) return { edgeProxy: null, primary: '', fallback1: '', fallback2: '', fallback3: '' };
    const cleanId = this.extractFileId(fileId) || fileId;
    const sizeParam = width ? `=w${width}` : '';
    const szParam = width ? `&sz=w${width}` : '&sz=w1000';

    // Edge CDN Proxy Endpoint (Tự động kích hoạt khi chạy trên Live Domain Cloudflare)
    const isLiveDomain = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const proxyEndpoint = `/api/image-proxy?id=${encodeURIComponent(cleanId)}${width ? '&w=' + width : '&w=1000'}`;

    return {
      edgeProxy: isLiveDomain ? proxyEndpoint : null,
      primary: `https://lh3.googleusercontent.com/d/${cleanId}${sizeParam}`,
      fallback1: `https://drive.google.com/thumbnail?id=${cleanId}${szParam}`,
      fallback2: `https://drive.google.com/uc?export=view&id=${cleanId}`,
      fallback3: `https://drive.google.com/uc?export=download&id=${cleanId}`
    };
  },

  /**
   * Attach error-recovery listener to an image element to try multi-tier CDN fallbacks if loading fails.
   */
  attachImageFallback(imgElement: HTMLImageElement, fileId?: string | null, targetWidth: number | null = null): void {
    if (!fileId) return;
    const urls = this.getImageUrls(fileId, targetWidth);
    imgElement.decoding = 'async';

    // Danh sách nguồn tải theo thứ tự ưu tiên: Edge Proxy -> Google UserContent CDN -> Google Thumbnail -> Direct Views
    const candidateSources = [
      urls.edgeProxy,
      urls.primary,
      urls.fallback1,
      urls.fallback2,
      urls.fallback3
    ].filter(Boolean) as string[];

    let currentIndex = 0;
    imgElement.src = candidateSources[0];

    imgElement.onerror = () => {
      currentIndex++;
      if (currentIndex < candidateSources.length) {
        imgElement.src = candidateSources[currentIndex];
      } else {
        imgElement.onerror = null;
        imgElement.classList.add('img-load-error');
        imgElement.alt = 'Không thể tải ảnh từ Google Drive. Vui lòng kiểm tra quyền chia sẻ ("Bất kỳ ai có liên kết").';
      }
    };
  }
};

if (typeof window !== 'undefined') {
  window.DriveHelper = DriveHelper;
}
