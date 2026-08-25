/**
 * Module kết nối trực tiếp với Google Sheets API / Google Apps Script Web App
 * dùng Google Sheet làm Cơ Sở Dữ Liệu Cloud miễn phí 100% cho trang web.
 */

import { Manga } from './types/manga';

// Mã hóa mảng byte bảo mật tránh lộ đường dẫn URL dạng plain-text
const _OBFUSCATED_SHEET_KEY = [104,116,116,112,115,58,47,47,115,99,114,105,112,116,46,103,111,111,103,108,101,46,99,111,109,47,109,97,99,114,111,115,47,115,47,65,75,102,121,99,98,119,72,108,65,108,97,71,90,106,105,97,81,89,89,101,86,114,57,67,52,87,85,49,67,113,71,112,98,119,51,114,45,98,85,77,109,111,98,75,106,73,103,89,50,101,81,90,105,97,69,108,100,52,106,71,109,57,71,120,45,56,101,72,49,56,98,117,103,47,101,120,101,99];

function _getHardcodedSheetUrl(): string {
  return _OBFUSCATED_SHEET_KEY.map(c => String.fromCharCode(c)).join('');
}

const _DEFAULT_SHEET_URL = _getHardcodedSheetUrl();

// Luôn đồng bộ URL hoạt động vào Storage
if (typeof localStorage !== 'undefined') {
  localStorage.setItem('google_sheet_api_url', _DEFAULT_SHEET_URL);
}

export const SheetDatabase = {
  // Tự động sử dụng URL gán cứng ẩn bảo mật làm mặc định
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
   * Lấy danh mục truyện trực tiếp từ Google Sheet qua Apps Script Web App hoặc Link Xuất Bản CSV
   */
  async fetchMangaCatalog(): Promise<Manga[] | null> {
    if (!this.apiUrl) {
      console.log('Chưa cấu hình Google Sheets URL, sử dụng dữ liệu tĩnh.');
      return null;
    }

    try {
      const separator = this.apiUrl.includes('?') ? '&' : '?';
      const cacheBustUrl = `${this.apiUrl}${separator}_t=${Date.now()}`;

      const response = await fetch(cacheBustUrl, { 
        method: 'GET',
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      
      // Nếu là link Xuất Bản CSV từ Google Sheet (pub?output=csv)
      if (this.apiUrl.includes('output=csv') || contentType.includes('text/csv') || contentType.includes('text/plain')) {
        const csvText = await response.text();
        return this.parseCSV(csvText);
      }

      const data = await response.json();
      let result: Manga[] | null = null;
      if (Array.isArray(data)) {
        result = data;
      } else if (data && data.mangaCatalog && Array.isArray(data.mangaCatalog)) {
        result = data.mangaCatalog;
      }
      return this.sortCatalogChapters(result);
    } catch (err) {
      console.warn('Không thể kết nối với Google Sheets API:', err);
      return null;
    }
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
   * Thêm/Cập nhật truyện vào Google Sheet (Gửi POST request chứa mã bảo mật Admin tới Apps Script Web App)
   */
  async saveMangaToSheet(mangaObj: Manga, adminPassword?: string): Promise<boolean> {
    if (!this.apiUrl) return false;

    try {
      const payload = {
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

      await fetch(this.apiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('Đã gửi dữ liệu truyện kèm mã bảo mật Admin lên Google Sheet thành công!');
      return true;
    } catch (err) {
      console.warn('Lỗi lưu dữ liệu lên Google Sheet:', err);
      return false;
    }
  }
};

if (typeof window !== 'undefined') {
  window.SheetDatabase = SheetDatabase;
}
