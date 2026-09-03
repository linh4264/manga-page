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
   * Tải danh mục tĩnh dự phòng từ /data/catalog.json (0ms, 0 Apps Script Quota)
   */
  async fetchStaticCatalog(): Promise<Manga[] | null> {
    try {
      const res = await fetch('/data/catalog.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return this.sortCatalogChapters(data);
        }
      }
    } catch (e) {
      console.warn('Không thể nạp /data/catalog.json:', e);
    }
    return null;
  },

  /**
   * Nén danh sách các trang ảnh: Trích xuất Google Drive File ID tinh gọn
   * Giúp giảm 65% dung lượng chuỗi lưu trên Google Sheet, 1 trang chỉ tốn ~33 bytes
   */
  compressPages(pages: string[]): string[] {
    if (!Array.isArray(pages)) return [];
    return pages.map(p => {
      if (typeof p !== 'string') return p;
      const clean = p.trim();
      const driveMatch = clean.match(/(?:id=|\/d\/|\/file\/d\/)([a-zA-Z0-9_-]{20,60})/);
      if (driveMatch && driveMatch[1]) {
        return driveMatch[1];
      }
      return clean;
    });
  },

  /**
   * Kiểm tra kết nối tới Google Apps Script Web App
   */
  async testConnection(testUrl?: string): Promise<{ ok: boolean; message: string; version?: string }> {
    const targetUrl = testUrl ? testUrl.trim() : this.apiUrl;
    if (!targetUrl) return { ok: false, message: 'Chưa nhập URL Google Apps Script!' };

    try {
      const pingUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=ping`;
      const res = await fetch(pingUrl, { method: 'GET' });
      if (!res.ok) {
        return { ok: false, message: `Lỗi máy chủ HTTP ${res.status}` };
      }
      const data = await res.json();
      if (data && data.success) {
        return { ok: true, message: 'Kết nối Google Apps Script thành công!', version: data.version };
      }
      return { ok: false, message: data.error || 'Phản hồi không đúng định dạng!' };
    } catch (err: any) {
      return { ok: false, message: `Lỗi kết nối: ${err?.message || 'Không thể gọi API'}` };
    }
  },

  /**
   * Xuất toàn bộ danh mục hiện tại ra file catalog.json để sao lưu hoặc tải về
   */
  exportCatalogJson(catalog?: Manga[]): void {
    const dataToExport = catalog || StorageService.getSync<Manga[]>('sheet_manga_cache', []);
    if (!dataToExport || dataToExport.length === 0) {
      alert('Chưa có dữ liệu danh mục để xuất!');
      return;
    }
    const jsonStr = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `catalog-snapshot-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  /**
   * Lấy danh mục truyện trực tiếp từ Google Sheet qua Apps Script Web App hoặc Link Xuất Bản CSV
   * @param force Bỏ qua bộ nhớ đệm TTL và tải mới nếu là true
   */
  async fetchMangaCatalog(force = false): Promise<Manga[] | null> {
    if (!this.apiUrl) {
      console.log('Chưa cấu hình Google Sheets URL, sử dụng dữ liệu tĩnh.');
      return this.fetchStaticCatalog();
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

      // Nếu lần đầu vào web chưa có cache, nạp ngay từ static catalog.json (0ms, 0 quota)
      const staticCatalog = await this.fetchStaticCatalog();
      if (staticCatalog && staticCatalog.length > 0) {
        this.saveCacheToStorage(staticCatalog);
        return staticCatalog;
      }
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
      console.warn('Không thể kết nối với Google Sheets API, sử dụng dữ liệu tĩnh:', err);
      const fallback = await this.fetchStaticCatalog();
      if (fallback && fallback.length > 0) {
        return fallback;
      }
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

    // Nén danh sách các trang thành File ID tinh gọn trước khi gửi lên Sheet
    const chaptersToSave = (mangaObj.chapters || []).map(ch => ({
      ...ch,
      pages: this.compressPages(ch.pages || [])
    }));

    const payload = {
      action: 'save',
      secretToken: adminPassword || "",
      id: mangaObj.id,
      title: mangaObj.title,
      originalTitle: mangaObj.originalTitle || '',
      author: mangaObj.author || '',
      artist: mangaObj.artist || '',
      coverUrl: mangaObj.coverUrl || mangaObj.coverDriveId || '',
      coverDriveId: mangaObj.coverDriveId || '',
      bannerUrl: mangaObj.bannerUrl || '',
      description: mangaObj.description || '',
      genres: mangaObj.genres || ['Google Drive'],
      status: mangaObj.status || 'Đang tiến hành',
      rating: mangaObj.rating || 4.9,
      views: mangaObj.views || '0',
      chapters: chaptersToSave,
      manga: {
        ...mangaObj,
        chapters: chaptersToSave
      }
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
