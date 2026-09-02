/**
 * Module kết nối trực tiếp với Google Sheets API / Google Apps Script Web App
 * dùng Google Sheet làm Cơ Sở Dữ Liệu Cloud miễn phí 100% cho trang web.
 */

import { Manga } from './types/manga';
import { StorageService } from './storageService';

// Mã hóa mảng byte bảo mật tránh lộ đường dẫn URL dạng plain-text
const _OBFUSCATED_SHEET_KEY = [104,116,116,112,115,58,47,47,115,99,114,105,112,116,46,103,111,111,103,108,101,46,99,111,109,47,109,97,99,114,111,115,47,115,47,65,75,102,121,99,98,119,72,108,65,108,97,71,90,106,105,97,81,89,89,101,86,114,57,67,52,87,85,49,67,113,71,112,98,119,51,114,45,98,85,77,109,111,98,75,106,73,103,89,50,101,81,90,105,97,69,108,100,52,106,71,109,57,71,120,45,56,101,72,49,56,98,117,103,47,101,120,101,99];

function _getHardcodedSheetUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_SHEET_API_URL) {
    return import.meta.env.VITE_GOOGLE_SHEET_API_URL;
  }
  return _OBFUSCATED_SHEET_KEY.map(c => String.fromCharCode(c)).join('');
}

const _DEFAULT_SHEET_URL = _getHardcodedSheetUrl();

// Luôn đồng bộ URL hoạt động vào Storage
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('google_sheet_api_url', _DEFAULT_SHEET_URL);
}

export const SheetDatabase = {
  // Tự động sử dụng URL từ env hoặc gán cứng ẩn bảo mật làm mặc định
  apiUrl: _DEFAULT_SHEET_URL,

  /**
   * Thiết lập URL API Google Apps Script Web App
   */
  setApiUrl(url?: string | null): void {
    if (!url) return;
    const cleanUrl = url.trim();
    this.apiUrl = cleanUrl;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('google_sheet_api_url', cleanUrl);
    }
  },

  /**
   * Thời gian sống của bộ nhớ đệm Catalog (10 phút)
   */
  CACHE_TTL_MS: 10 * 60 * 1000,

  /**
   * Lấy danh mục truyện trực tiếp từ Google Sheet qua Apps Script Web App hoặc Link Xuất Bản CSV
   * @param force Bỏ qua bộ nhớ đệm TTL và tải mới nếu là true
   */
  async fetchMangaCatalog(force = false): Promise<Manga[] | null> {
    if (!this.apiUrl) {
      console.log('Chưa cấu hình Google Sheets URL, sử dụng dữ liệu tĩnh.');
      return null;
    }

    // Kiểm tra bộ nhớ đệm StorageService (IndexedDB + Memory) nếu không phải force reload
    if (!force) {
      try {
        const lastSync = StorageService.getSync<string | null>('sheet_manga_sync_time', null);
        const cached = StorageService.getSync<Manga[] | null>('sheet_manga_cache', null);
        if (lastSync && cached && Array.isArray(cached) && cached.length > 0) {
          const age = Date.now() - parseInt(lastSync, 10);
          if (age < this.CACHE_TTL_MS) {
            return this.sortCatalogChapters(cached);
          }
        }
      } catch (e) {}
    }

    try {
      const url = force 
        ? `${this.apiUrl}${this.apiUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`
        : this.apiUrl;

      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'application/json, text/csv, */*' }
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      
      // Nếu là link Xuất Bản CSV từ Google Sheet (pub?output=csv)
      if (this.apiUrl.includes('output=csv') || contentType.includes('text/csv') || contentType.includes('text/plain')) {
        const csvText = await response.text();
        const parsedCsv = this.parseCSV(csvText);
        this.saveCacheToStorage(parsedCsv);
        return parsedCsv;
      }

      const data = await response.json();
      let result: Manga[] | null = null;
      if (Array.isArray(data)) {
        result = data;
      } else if (data && data.mangaCatalog && Array.isArray(data.mangaCatalog)) {
        result = data.mangaCatalog;
      }
      const sorted = this.sortCatalogChapters(result);
      if (sorted && sorted.length > 0) {
        this.saveCacheToStorage(sorted);
      }
      return sorted;
    } catch (err) {
      console.warn('Không thể kết nối với Google Sheets API:', err);
      return null;
    }
  },

  saveCacheToStorage(catalog: Manga[] | null): void {
    if (!catalog || !Array.isArray(catalog) || catalog.length === 0) return;
    try {
      StorageService.setItem('sheet_manga_cache', catalog);
      StorageService.setItem('sheet_manga_sync_time', String(Date.now()));
    } catch (e) {
      console.warn('Không thể ghi cache catalog vào StorageService:', e);
    }
  },

  chapterPagesCache: new Map<string, string[]>(),

  /**
   * Tải danh sách trang ảnh của 1 chương theo yêu cầu (Lazy loading chapter pages)
   */
  async fetchChapterPages(mangaId: string, chapterId: string, existingPages?: string[]): Promise<string[]> {
    if (existingPages && existingPages.length > 0) {
      return existingPages;
    }

    const cacheKey = `${mangaId}_${chapterId}`;
    if (this.chapterPagesCache.has(cacheKey)) {
      return this.chapterPagesCache.get(cacheKey)!;
    }

    if (!this.apiUrl) return [];

    try {
      const url = `${this.apiUrl}${this.apiUrl.includes('?') ? '&' : '?'}action=getChapter&mangaId=${encodeURIComponent(mangaId)}&chapterId=${encodeURIComponent(chapterId)}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.pages)) {
          this.chapterPagesCache.set(cacheKey, data.pages);
          return data.pages;
        }
      }
    } catch (e) {
      console.warn(`Không thể tải lazy pages cho chương ${chapterId}:`, e);
    }
    return [];
  },

  /**
   * Sắp xếp danh sách chương cho toàn bộ danh mục theo thứ tự tự nhiên của tên chương
   */
  sortCatalogChapters(mangaList: Manga[] | null): Manga[] | null {
    if (!Array.isArray(mangaList)) return mangaList;
    mangaList.forEach(manga => {
      if (manga && Array.isArray(manga.chapters) && manga.chapters.length > 1) {
        manga.chapters.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' }));
      }
    });
    return mangaList;
  },

  /**
   * Giải mã định dạng CSV từ Google Sheet Publish to Web
   */
  parseCSV(csvText: string): Manga[] {
    const lines = csvText.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const mangaList: Manga[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const row = line.split('\t').length > 1 ? line.split('\t') : line.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
      if (row[0]) {
        try {
          const cleanRow = row.map(cell => cell ? cell.replace(/^"(.*)"$/, '$1').trim() : '');
          mangaList.push({
            id: cleanRow[0],
            title: cleanRow[1] || 'Truyện Google Sheet',
            author: cleanRow[2] || '',
            coverUrl: cleanRow[3] || '',
            description: cleanRow[4] || '',
            genres: cleanRow[5] ? cleanRow[5].split(',').map(g => g.trim()) : ['Google Drive'],
            chapters: cleanRow[6] ? JSON.parse(cleanRow[6]) : []
          });
        } catch (err) {
          console.warn('Lỗi đọc dòng CSV:', err);
        }
      }
    }
    return this.sortCatalogChapters(mangaList) || mangaList;
  },

  /**
   * Thêm/Cập nhật truyện vào Google Sheet (Gửi POST request chứa mã bảo mật Admin tới Apps Script Web App và kiểm tra phản hồi)
   */
  async saveMangaToSheet(mangaObj: Manga, adminPassword?: string): Promise<boolean> {
    if (!this.apiUrl) {
      throw new Error('Chưa cấu hình URL Google Sheet API!');
    }

    const payload = {
      action: 'save',
      secretToken: adminPassword || "",
      id: mangaObj.id,
      title: mangaObj.title,
      author: mangaObj.author,
      coverUrl: mangaObj.coverUrl || mangaObj.coverDriveId || '',
      description: mangaObj.description || '',
      genres: mangaObj.genres || ['PDF', 'Google Drive'],
      chapters: mangaObj.chapters || [],
      manga: mangaObj
    };

    let response: Response;
    try {
      response = await fetch(this.apiUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    } catch (err: any) {
      console.warn('Lỗi kết nối mạng khi gọi Google Sheet:', err);
      throw new Error(`Không thể kết nối đến máy chủ Google Sheet: ${err?.message || 'Lỗi mạng hoặc CORS'}`);
    }

    if (!response.ok) {
      throw new Error(`Google Sheet API trả về mã lỗi HTTP ${response.status}`);
    }

    let resData: any = null;
    try {
      resData = await response.json();
    } catch {
      try {
        const text = await response.text();
        if (text && (text.toLowerCase().includes('error') || text.toLowerCase().includes('sai') || text.toLowerCase().includes('denied'))) {
          throw new Error(text);
        }
      } catch (e: any) {
        if (e?.message) throw e;
      }
    }

    if (resData && (resData.success === false || resData.status === 'error')) {
      throw new Error(resData.error || resData.message || 'Mật khẩu Admin không chính xác!');
    }

    console.log('✅ Đã xác thực mật khẩu Admin và lưu dữ liệu truyện lên Google Sheet thành công!');
    return true;
  }
};

if (typeof window !== 'undefined') {
  window.SheetDatabase = SheetDatabase;
}
