/**
 * Module kết nối trực tiếp với Google Sheets API / Google Apps Script Web App
 * dùng Google Sheet làm Cơ Sở Dữ Liệu Cloud miễn phí 100% cho trang web.
 */

window.SheetDatabase = {
  // Đường dẫn mặc định (Người dùng có thể nhập URL Google Apps Script của họ)
  apiUrl: localStorage.getItem('google_sheet_api_url') || '',

  /**
   * Thiết lập URL API Google Apps Script Web App
   * @param {string} url 
   */
  setApiUrl(url) {
    if (!url) return;
    const cleanUrl = url.trim();
    this.apiUrl = cleanUrl;
    localStorage.setItem('google_sheet_api_url', cleanUrl);
  },

  /**
   * Lấy danh mục truyện trực tiếp từ Google Sheet qua Apps Script Web App hoặc Link Xuất Bản CSV
   * @returns {Promise<Array>} Danh sách các bộ truyện
   */
  async fetchMangaCatalog() {
    if (!this.apiUrl) {
      console.log('Chưa cấu hình Google Sheets URL, sử dụng dữ liệu tĩnh.');
      return null;
    }

    try {
      const response = await fetch(this.apiUrl, { method: 'GET' });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const contentType = response.headers.get('content-type') || '';
      
      // Nếu là link Xuất Bản CSV từ Google Sheet (pub?output=csv)
      if (this.apiUrl.includes('output=csv') || contentType.includes('text/csv') || contentType.includes('text/plain')) {
        const csvText = await response.text();
        return this.parseCSV(csvText);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        return data;
      } else if (data && data.mangaCatalog && Array.isArray(data.mangaCatalog)) {
        return data.mangaCatalog;
      }
      return null;
    } catch (err) {
      console.warn('Không thể kết nối với Google Sheets API:', err);
      return null;
    }
  },

  /**
   * Giải mã định dạng CSV từ Google Sheet Publish to Web
   */
  parseCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length <= 1) return [];

    const mangaList = [];
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
    return mangaList;
  },

  /**
   * Thêm truyện mới vào Google Sheet (Gửi POST request tới Apps Script Web App)
   * @param {Object} mangaObj 
   * @returns {Promise<boolean>}
   */
  async saveMangaToSheet(mangaObj) {
    if (!this.apiUrl) return false;

    try {
      const payloadStr = JSON.stringify(mangaObj);

      // Hidden Form Submit qua iframe ẩn đi thẳng tới Google Apps Script (1 request duy nhất)
      let hiddenFrame = document.getElementById('hidden_post_frame');
      if (!hiddenFrame) {
        hiddenFrame = document.createElement('iframe');
        hiddenFrame.name = 'hidden_post_frame';
        hiddenFrame.id = 'hidden_post_frame';
        hiddenFrame.style.display = 'none';
        document.body.appendChild(hiddenFrame);
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = this.apiUrl;
      form.target = 'hidden_post_frame';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'payload';
      input.value = payloadStr;

      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      
      setTimeout(() => {
        document.body.removeChild(form);
      }, 1000);

      console.log('Đã gửi dữ liệu truyện sang Google Apps Script qua Form Submit!');
      return true;
    } catch (err) {
      console.warn('Lỗi khi gửi truyện mới lên Google Sheet:', err);
      return false;
    }
  }
};
