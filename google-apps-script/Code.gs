/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT DATABASE V2 - DRIVEMANGA ARCHITECTURE
 * - Quét thư mục Google Drive tự động (action=getFolderImages)
 * - Kiến trúc quan hệ 2 Tab (Manga & Chapters) - Phá bỏ giới hạn 50.000 ký tự
 * - Tối ưu hóa hiệu năng, chống xung đột ghi đồng thời (LockService), bảo mật Admin
 * ==============================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT TRÊN GOOGLE SHEET:
 * 1. Mở file Google Sheet của bạn trên Google Drive.
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) > Apps Script.
 * 3. XÓA TOÀN BỘ mã cũ trong file Code.gs và DÁN TOÀN BỘ nội dung file này vào.
 * 4. Đổi mật khẩu Admin tại biến ADMIN_SECRET_DEFAULT bên dưới (mặc định: admin123).
 * 5. Bấm icon Đĩa mềm (Save).
 * 6. (Tùy chọn) Chọn hàm "setupDatabase" ở thanh menu và bấm "Chạy" (Run) để tạo sẵn 2 Tab.
 * 7. Bấm nút "Triển khai" (Deploy) ở góc trên bên phải > "Quản lý bản triển khai" (Manage deployments) hoặc "Triển khai mới" (New deployment).
 *    * LƯU Ý QUAN TRỌNG:
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 8. Copy "URL ứng dụng web" (Web App URL có đuôi /exec) và cập nhật vào web!
 * ==============================================================================
 */

// Mật khẩu Admin mặc định để xác thực khi thêm/sửa truyện từ trang web
const ADMIN_SECRET_DEFAULT = "admin123";

// Tên 2 Tab chuẩn kiến trúc quan hệ
const TAB_MANGA = "Manga";
const TAB_CHAPTERS = "Chapters";
const TAB_LEGACY = "Sheet1";

/**
 * Lấy mật khẩu Admin từ Script Properties hoặc biến mặc định
 */
function getAdminSecret() {
  const prop = PropertiesService.getScriptProperties().getProperty("ADMIN_SECRET");
  return prop || ADMIN_SECRET_DEFAULT;
}

/**
 * Hàm khởi chạy thủ công (1-click) trong Apps Script Editor để:
 * 1. Tự động tạo 2 Tab: Manga & Chapters
 * 2. Kích hoạt cửa sổ cấp quyền Google Drive (OAuth Authorization) cho Web App
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureDatabaseSchema(ss);

  // Kích hoạt ủy quyền truy cập Google Drive cho tài khoản của bạn
  try {
    const root = DriveApp.getRootFolder();
    Logger.log("✅ Đã ủy quyền Google Drive thành công! Thư mục gốc: " + root.getName());
  } catch (e) {
    Logger.log("Ủy quyền Drive: " + e.toString());
  }

  Logger.log("✅ Đã khởi tạo xong 2 Tab và cấp quyền Google Drive thành công!");
}

/**
 * Khởi tạo cấu trúc 2 Tab và các dòng tiêu đề nếu bảng tính mới tạo
 */
function ensureDatabaseSchema(ss) {
  ss = ss || SpreadsheetApp.getActiveSpreadsheet();
  let mangaSheet = ss.getSheetByName(TAB_MANGA);
  if (!mangaSheet) {
    mangaSheet = ss.insertSheet(TAB_MANGA, 0);
    mangaSheet.appendRow([
      "id", "title", "originalTitle", "author", "artist", 
      "coverUrl", "coverDriveId", "bannerUrl", "description", 
      "genres", "status", "rating", "views", "updatedAt"
    ]);
    mangaSheet.getRange(1, 1, 1, 14).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
    mangaSheet.setFrozenRows(1);
  }

  let chaptersSheet = ss.getSheetByName(TAB_CHAPTERS);
  if (!chaptersSheet) {
    chaptersSheet = ss.insertSheet(TAB_CHAPTERS, 1);
    chaptersSheet.appendRow([
      "mangaId", "chapterId", "title", "orderIndex", 
      "pdfUrl", "isPdf", "pages", "updatedAt"
    ]);
    chaptersSheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#1e293b").setFontColor("#f8fafc");
    chaptersSheet.setFrozenRows(1);
  }

  return { mangaSheet, chaptersSheet };
}

/**
 * Tạo phản hồi JSON chuẩn có hỗ trợ CORS
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý GET Request: Đọc toàn bộ danh mục, quét thư mục hoặc Lazy-load từng chương
 */
function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = e && e.parameter ? e.parameter.action : null;

    // 1. Kiểm tra kết nối (Ping check)
    if (action === "ping") {
      return createJsonResponse({
        success: true,
        status: "ok",
        version: "2.1.0",
        timestamp: new Date().toISOString()
      });
    }

    // 2. Quét toàn bộ ảnh trong thư mục Google Drive (Folder Image Scanner)
    if (action === "getFolderImages") {
      const folderId = e && e.parameter ? e.parameter.folderId : null;
      if (!folderId) {
        return createJsonResponse({ success: false, error: "Thiếu ID thư mục Google Drive!" });
      }

      try {
        const folder = DriveApp.getFolderById(folderId);
        const files = folder.getFiles();
        const images = [];

        while (files.hasNext()) {
          const file = files.next();
          const mime = file.getMimeType() || "";
          const name = file.getName() || "";

          // Nhận diện tất cả các định dạng ảnh phổ biến (WebP, AVIF, JPEG, PNG, GIF)
          const isImageMime = mime.indexOf("image/") !== -1;
          const isImageExt = /\.(jpe?g|png|webp|avif|gif|bmp)$/i.test(name);

          if (isImageMime || isImageExt) {
            images.push({
              id: file.getId(),
              name: name
            });
          }
        }

        if (images.length === 0) {
          return createJsonResponse({
            success: false,
            error: "Không tìm thấy tệp ảnh nào trong thư mục! Hãy đảm bảo bạn đã tải ảnh vào thư mục và chia sẻ quyền 'Bất kỳ ai có đường liên kết'."
          });
        }

        // Sắp xếp tên ảnh theo thứ tự tự nhiên (trang 1, trang 2, ..., trang 10, trang 100)
        images.sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true, sensitivity: "base" }));

        const imageIds = images.map(img => img.id);

        return createJsonResponse({
          success: true,
          folderId: folderId,
          count: imageIds.length,
          images: imageIds
        });
      } catch (err) {
        return createJsonResponse({
          success: false,
          error: "Lỗi truy cập thư mục Google Drive: " + err.toString() + ". Vui lòng đảm bảo thư mục đã bật quyền 'Bất kỳ ai có đường liên kết'."
        });
      }
    }

    // 3. Lazy-load các trang ảnh của 1 chương cụ thể (Tiết kiệm băng thông)
    if (action === "getChapter") {
      const mangaId = e.parameter.mangaId;
      const chapterId = e.parameter.chapterId;
      if (!mangaId || !chapterId) {
        return createJsonResponse({ success: false, error: "Thiếu mangaId hoặc chapterId" });
      }

      const chaptersSheet = ss.getSheetByName(TAB_CHAPTERS);
      if (chaptersSheet && chaptersSheet.getLastRow() > 1) {
        const data = chaptersSheet.getRange(2, 1, chaptersSheet.getLastRow() - 1, 8).getValues();
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (String(row[0]) === String(mangaId) && String(row[1]) === String(chapterId)) {
            let pages = [];
            try {
              pages = typeof row[6] === "string" ? JSON.parse(row[6]) : (row[6] || []);
            } catch (err) {
              pages = [];
            }
            return createJsonResponse({
              success: true,
              mangaId: mangaId,
              chapterId: chapterId,
              title: row[2],
              pdfUrl: row[4] || null,
              isPdf: Boolean(row[5]),
              pages: pages
            });
          }
        }
      }
      return createJsonResponse({ success: false, error: "Không tìm thấy chương truyện" });
    }

    // 4. Đọc toàn bộ Catalog truyện (Ưu tiên cấu trúc 2 Tab)
    const mangaSheet = ss.getSheetByName(TAB_MANGA);
    const chaptersSheet = ss.getSheetByName(TAB_CHAPTERS);

    if (mangaSheet && mangaSheet.getLastRow() > 1) {
      const mangaRows = mangaSheet.getRange(2, 1, mangaSheet.getLastRow() - 1, 14).getValues();
      const mangaMap = {};
      const mangaList = [];

      mangaRows.forEach(row => {
        const id = String(row[0] || "").trim();
        if (!id) return;

        let genres = [];
        try {
          genres = row[9] ? String(row[9]).split(",").map(g => g.trim()).filter(Boolean) : [];
        } catch (e) {
          genres = ["Google Drive"];
        }

        const mangaObj = {
          id: id,
          title: row[1] || "Chưa đặt tên",
          originalTitle: row[2] || "",
          author: row[3] || "",
          artist: row[4] || "",
          coverUrl: row[5] || "",
          coverDriveId: row[6] || "",
          bannerUrl: row[7] || "",
          description: row[8] || "",
          genres: genres.length > 0 ? genres : ["Google Drive"],
          status: row[10] || "Đang tiến hành",
          rating: parseFloat(row[11]) || 4.9,
          views: row[12] || "0",
          updatedAt: row[13] || new Date().toISOString(),
          chapters: []
        };
        mangaMap[id] = mangaObj;
        mangaList.push(mangaObj);
      });

      // Ghép nối danh sách các chương từ Tab Chapters
      if (chaptersSheet && chaptersSheet.getLastRow() > 1) {
        const chapterRows = chaptersSheet.getRange(2, 1, chaptersSheet.getLastRow() - 1, 8).getValues();
        chapterRows.forEach(row => {
          const mangaId = String(row[0] || "").trim();
          if (mangaMap[mangaId]) {
            let pages = [];
            try {
              pages = typeof row[6] === "string" ? JSON.parse(row[6]) : (row[6] || []);
            } catch (err) {
              pages = [];
            }

            mangaMap[mangaId].chapters.push({
              id: String(row[1] || "chap-1"),
              title: row[2] || "Chương",
              orderIndex: parseInt(row[3], 10) || 0,
              pdfUrl: row[4] || null,
              isPdf: Boolean(row[5]),
              pages: pages,
              updatedAt: row[7] || ""
            });
          }
        });
      }

      return createJsonResponse({
        success: true,
        version: "2.1",
        mangaCatalog: mangaList
      });
    }

    // 5. Fallback tương thích ngược với Sheet 1 Tab cũ (Legacy)
    const legacySheet = ss.getSheetByName(TAB_LEGACY) || ss.getSheets()[0];
    if (legacySheet && legacySheet.getLastRow() > 1) {
      const rows = legacySheet.getRange(2, 1, legacySheet.getLastRow() - 1, 7).getValues();
      const legacyList = [];
      rows.forEach(row => {
        if (!row[0]) return;
        let chapters = [];
        try {
          chapters = row[6] ? JSON.parse(row[6]) : [];
        } catch (e) {
          chapters = [];
        }
        legacyList.push({
          id: String(row[0]),
          title: row[1] || "",
          author: row[2] || "",
          coverUrl: row[3] || "",
          description: row[4] || "",
          genres: row[5] ? String(row[5]).split(",").map(g => g.trim()) : ["Google Drive"],
          chapters: chapters
        });
      });
      return createJsonResponse({
        success: true,
        version: "1.0-legacy",
        mangaCatalog: legacyList
      });
    }

    return createJsonResponse({ success: true, mangaCatalog: [] });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

/**
 * Xử lý POST Request: Lưu/sửa truyện, tự động phân tách dữ liệu vào 2 Tab độc lập
 */
function doPost(e) {
  // Sử dụng LockService với timeout 10 giây tránh xung đột khi nhiều người cập nhật
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (err) {
    return createJsonResponse({ success: false, error: "Máy chủ đang bận xử lý yêu cầu khác, vui lòng thử lại sau vài giây!" });
  }

  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (err) {
        return createJsonResponse({ success: false, error: "Nội dung gửi lên không phải JSON hợp lệ!" });
      }
    } else {
      payload = e.parameter || {};
    }

    // 1. Xác thực Mật khẩu Admin
    const clientSecret = payload.secretToken || payload.adminPassword || "";
    const serverSecret = getAdminSecret();
    if (clientSecret !== serverSecret) {
      return createJsonResponse({ success: false, error: "Mật khẩu quản trị Admin không chính xác!" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schema = ensureDatabaseSchema(ss);
    const mangaSheet = schema.mangaSheet;
    const chaptersSheet = schema.chaptersSheet;

    const action = payload.action || "save";
    const manga = payload.manga || payload;
    const mangaId = String(manga.id || "").trim();

    if (!mangaId) {
      return createJsonResponse({ success: false, error: "Thiếu ID truyện!" });
    }

    // 2. Thao tác Xóa Truyện (Delete)
    if (action === "delete") {
      // Xóa trong Tab Manga
      const mData = mangaSheet.getDataRange().getValues();
      for (let i = mData.length - 1; i >= 1; i--) {
        if (String(mData[i][0]) === mangaId) {
          mangaSheet.deleteRow(i + 1);
        }
      }
      // Xóa toàn bộ chương trong Tab Chapters
      const cData = chaptersSheet.getDataRange().getValues();
      for (let j = cData.length - 1; j >= 1; j--) {
        if (String(cData[j][0]) === mangaId) {
          chaptersSheet.deleteRow(j + 1);
        }
      }
      return createJsonResponse({ success: true, message: `Đã xóa truyện ${mangaId} thành công!` });
    }

    // 3. Thao tác Lưu Truyện & Các Chương (Save / Update)
    const nowStr = new Date().toISOString();
    const genresStr = Array.isArray(manga.genres) ? manga.genres.join(", ") : (manga.genres || "Google Drive");

    // A. Cập nhật Tab Manga (Thông tin tổng quát - không chứa mảng chương lớn)
    let mangaRowIndex = -1;
    const mRows = mangaSheet.getDataRange().getValues();
    for (let i = 1; i < mRows.length; i++) {
      if (String(mRows[i][0]) === mangaId) {
        mangaRowIndex = i + 1;
        break;
      }
    }

    const mangaRowValues = [
      mangaId,
      manga.title || "Chưa đặt tên",
      manga.originalTitle || "",
      manga.author || "",
      manga.artist || "",
      manga.coverUrl || "",
      manga.coverDriveId || "",
      manga.bannerUrl || "",
      manga.description || "",
      genresStr,
      manga.status || "Đang tiến hành",
      manga.rating || 4.9,
      manga.views || "0",
      nowStr
    ];

    if (mangaRowIndex > 0) {
      mangaSheet.getRange(mangaRowIndex, 1, 1, 14).setValues([mangaRowValues]);
    } else {
      mangaSheet.appendRow(mangaRowValues);
    }

    // B. Cập nhật Tab Chapters (Mỗi chương là 1 dòng độc lập - không bao giờ tràn 50.000 ký tự)
    const chapters = Array.isArray(manga.chapters) ? manga.chapters : [];
    if (chapters.length > 0) {
      // Xóa các dòng chương cũ của bộ truyện này để cập nhật mới nhất
      const cRows = chaptersSheet.getDataRange().getValues();
      for (let j = cRows.length - 1; j >= 1; j--) {
        if (String(cRows[j][0]) === mangaId) {
          chaptersSheet.deleteRow(j + 1);
        }
      }

      // Thêm từng chương thành từng dòng riêng biệt
      const newChapterRows = chapters.map((ch, idx) => {
        const pagesJson = JSON.stringify(ch.pages || []);
        return [
          mangaId,
          String(ch.id || `chap-${idx + 1}`),
          ch.title || `Chương ${idx + 1}`,
          idx + 1,
          ch.pdfUrl || "",
          Boolean(ch.isPdf),
          pagesJson,
          ch.updatedAt || nowStr
        ];
      });

      if (newChapterRows.length > 0) {
        const startRow = chaptersSheet.getLastRow() + 1;
        chaptersSheet.getRange(startRow, 1, newChapterRows.length, 8).setValues(newChapterRows);
      }
    }

    return createJsonResponse({
      success: true,
      message: `Đã lưu thành công bộ truyện "${manga.title}" (${chapters.length} chương) vào kiến trúc 2 Tab!`
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}
