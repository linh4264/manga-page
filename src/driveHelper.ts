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
   * Check if a given string is a safe image URL (http, https, or data:image).
   */
  isValidImageUrl(url?: string | null): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return true;
    try {
      const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  /**
   * Get direct displayable image URLs for a Google Drive File ID.
   * Returns primary Edge CDN proxy, Google Thumbnail link, Google UserContent CDN link, and alternative fallback links.
   */
  getImageUrls(fileId?: string | null, width: number | null = null): DriveImageUrls {
    if (!fileId) return { edgeProxy: null, primary: '', fallback1: '', fallback2: '', fallback3: '' };
    const cleanId = this.extractFileId(fileId) || (/^[a-zA-Z0-9_-]{20,60}$/.test(fileId.trim()) ? fileId.trim() : null);
    if (!cleanId) return { edgeProxy: null, primary: '', fallback1: '', fallback2: '', fallback3: '' };

    const encodedId = encodeURIComponent(cleanId);
    const validWidth = (width && width > 0 && width <= 4000) ? Math.floor(width) : null;
    const sizeParam = validWidth ? `=w${validWidth}` : '=w1600';
    const szParam = validWidth ? `&sz=w${validWidth}` : '&sz=w1600';

    // Edge CDN Proxy Endpoint (Tự động kích hoạt khi chạy trên Live Domain Cloudflare)
    const isLiveDomain = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    const proxyEndpoint = `/api/image-proxy?id=${encodedId}${validWidth ? '&w=' + validWidth : '&w=1600'}`;

    return {
      edgeProxy: isLiveDomain ? proxyEndpoint : null,
      primary: `https://lh3.googleusercontent.com/d/${encodedId}${sizeParam}`,
      fallback1: `https://drive.google.com/thumbnail?id=${encodedId}${szParam}`,
      fallback2: `https://drive.google.com/uc?export=view&id=${encodedId}`,
      fallback3: `https://drive.google.com/uc?export=download&id=${encodedId}`
    };
  },

  /**
   * Attach error-recovery listener to an image element to try multi-tier CDN fallbacks if loading fails.
   */
  attachImageFallback(imgElement: HTMLImageElement, fileId?: string | null, targetWidth: number | null = null): void {
    if (!fileId || !imgElement) return;
    const urls = this.getImageUrls(fileId, targetWidth);
    imgElement.referrerPolicy = 'no-referrer';
    imgElement.decoding = 'async';

    const cleanId = this.extractFileId(fileId) || (/^[a-zA-Z0-9_-]{20,60}$/.test(fileId.trim()) ? fileId.trim() : null);
    const encodedId = cleanId ? encodeURIComponent(cleanId) : '';
    const validWidth = (targetWidth && targetWidth > 0 && targetWidth <= 4000) ? Math.floor(targetWidth) : null;

    // Danh sách nguồn tải theo thứ tự ưu tiên:
    // 1. First-Party Cloudflare Edge Proxy (/api/image-proxy)
    // 2. Google Direct UserContent CDN (lh3.googleusercontent.com/d/...)
    // 3. Google Drive Thumbnail CDN (drive.google.com/thumbnail)
    // 4. Google User Content alternative (lh3.google.com)
    // 5. Google Drive direct export view (drive.google.com/uc?export=view)
    // 6. Google Drive direct download (drive.google.com/uc?export=download)
    // 7. Global Edge CDN Backup (wsrv.nl - dự phòng cuối cùng nếu toàn bộ hạ tầng trên bị nghẽn IP)
    const candidateSources = [
      urls.edgeProxy,
      urls.primary,
      urls.fallback1,
      encodedId ? `https://lh3.google.com/u/0/d/${encodedId}` : null,
      urls.fallback2,
      urls.fallback3,
      encodedId ? `https://docs.google.com/uc?export=download&id=${encodedId}` : null,
      encodedId ? `https://wsrv.nl/?url=https%3A%2F%2Fdrive.google.com%2Fthumbnail%3Fid%3D${encodedId}%26sz%3Dw${validWidth || 1600}&output=webp` : null
    ].filter((url): url is string => Boolean(url) && (url.startsWith('https://') || url.startsWith('/api/image-proxy')));

    if (candidateSources.length === 0) {
      imgElement.classList.add('img-load-error');
      imgElement.alt = 'ID tệp Google Drive không hợp lệ.';
      return;
    }

    let currentIndex = 0;
    let retryCycles = 0;
    const maxRetryCycles = 2;
    let timer: any = null;

    const onRetryClick = () => {
      imgElement.classList.remove('img-load-error');
      imgElement.style.cursor = '';
      currentIndex = 0;
      retryCycles = 0;
      tryNext();
    };

    const handleLoad = () => {
      if (timer) clearTimeout(timer);
      imgElement.classList.remove('img-load-error');
      imgElement.style.cursor = '';
      imgElement.removeEventListener('click', onRetryClick);
    };

    const handleError = () => {
      if (timer) clearTimeout(timer);
      // Giãn cách 200ms trước khi chuyển nguồn tiếp theo để tránh bão request gây 429
      timer = setTimeout(tryNext, 200);
    };

    imgElement.addEventListener('load', handleLoad);
    imgElement.addEventListener('error', handleError);

    const tryNext = () => {
      if (currentIndex < candidateSources.length) {
        const nextUrl = candidateSources[currentIndex];
        currentIndex++;
        imgElement.src = nextUrl;
      } else if (retryCycles < maxRetryCycles) {
        retryCycles++;
        currentIndex = 0;
        // Đợi một khoảng ngắn (backoff) trước khi thử lại toàn bộ các nguồn
        timer = setTimeout(() => {
          tryNext();
        }, 400 * retryCycles);
      } else {
        imgElement.removeEventListener('error', handleError);
        imgElement.classList.add('img-load-error');
        imgElement.alt = 'Không thể tải ảnh từ Google Drive. Nhấn vào đây để thử tải lại.';
        imgElement.title = 'Nhấn vào đây để thử tải lại ảnh';
        imgElement.style.cursor = 'pointer';
        imgElement.addEventListener('click', onRetryClick, { once: true });
      }
    };

    tryNext();
  }
};

if (typeof window !== 'undefined') {
  window.DriveHelper = DriveHelper;
}
