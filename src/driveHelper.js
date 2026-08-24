/**
 * Utility functions for parsing Google Drive links and transforming them into direct displayable image URLs.
 */

window.DriveHelper = {
  /**
   * Extract a Google Drive File ID from various link formats or raw ID strings.
   * @param {string} input 
   * @returns {string|null}
   */
  extractFileId(input) {
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
   * @param {string} input 
   * @returns {string|null}
   */
  extractFolderId(input) {
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
   * @param {string} folderIdOrUrl
   * @returns {Promise<{ success: boolean, images?: string[], count?: number, error?: string }>}
   */
  async fetchFolderImages(folderIdOrUrl) {
    const folderId = this.extractFolderId(folderIdOrUrl);
    if (!folderId) {
      return { success: false, error: 'Link thư mục Google Drive không hợp lệ! Vui lòng dán link có dạng: https://drive.google.com/drive/folders/...' };
    }

    const apiUrl = window.SheetDatabase ? window.SheetDatabase.apiUrl : null;
    if (!apiUrl) {
      return { success: false, error: 'Chưa kết nối Google Sheet/Apps Script API!' };
    }

    try {
      const response = await fetch(`${apiUrl}?action=getFolderImages&folderId=${encodeURIComponent(folderId)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (err) {
      console.warn('Lỗi lấy ảnh từ thư mục Google Drive:', err);
      return { success: false, error: err.message || 'Không thể kết nối với thư mục Google Drive.' };
    }
  },

  /**
   * Parse a batch text input containing multiple Drive links or IDs (one per line or space-separated).
   * @param {string} rawText 
   * @returns {string[]} List of valid File IDs extracted
   */
  parseBatchInput(rawText) {
    if (!rawText) return [];
    // Split by newlines, commas, or spaces
    const tokens = rawText.split(/[\r\n,\s]+/);
    const ids = [];
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
   * Returns primary CDN link and alternative fallback links (including WebP-friendly thumbnail endpoint).
   * @param {string} fileId 
   * @param {number} [width] Optional width target for thumbnail optimization (e.g. 500 for covers)
   * @returns {{ primary: string, fallback1: string, fallback2: string, fallback3: string }}
   */
  getImageUrls(fileId, width = null) {
    if (!fileId) return { primary: '', fallback1: '', fallback2: '', fallback3: '' };
    const cleanId = this.extractFileId(fileId) || fileId;
    const sizeParam = width ? `=w${width}` : '';
    const szParam = width ? `&sz=w${width}` : '&sz=w1000';
    return {
      primary: `https://lh3.googleusercontent.com/d/${cleanId}${sizeParam}`,
      fallback1: `https://drive.google.com/thumbnail?id=${cleanId}${szParam}`,
      fallback2: `https://drive.google.com/uc?export=view&id=${cleanId}`,
      fallback3: `https://drive.google.com/uc?export=download&id=${cleanId}`
    };
  },

  /**
   * Attach error-recovery listener to an image element to try fallbacks if loading fails.
   * @param {HTMLImageElement} imgElement 
   * @param {string} fileId 
   * @param {number} [targetWidth] Optional target width for image optimization
   */
  attachImageFallback(imgElement, fileId, targetWidth = null) {
    const urls = this.getImageUrls(fileId, targetWidth);
    let attempt = 0;
    imgElement.decoding = 'async';
    imgElement.src = urls.primary;

    imgElement.onerror = () => {
      attempt++;
      if (attempt === 1) {
        imgElement.src = urls.fallback1;
      } else if (attempt === 2) {
        imgElement.src = urls.fallback2;
      } else if (attempt === 3) {
        imgElement.src = urls.fallback3;
      } else if (attempt === 4) {
        imgElement.onerror = null;
        // Display placeholder or broken image indicator
        imgElement.classList.add('img-load-error');
        imgElement.alt = 'Không thể tải ảnh từ Google Drive. Vui lòng kiểm tra quyền chia sẻ ("Bất kỳ ai có liên kết").';
      }
    };
  }
};
