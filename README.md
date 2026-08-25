# 🚀 DriveManga - Google Drive & PDF Manga Reader

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-6.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-3.0+-FCC72B?style=for-the-badge&logo=vitest&logoColor=black)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Ready-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Realtime_DB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

<p align="center">
  <strong>Ứng dụng web đọc truyện tranh hiện đại, tải ảnh trực tiếp từ Google Drive & PDF, sử dụng Google Sheet làm Database đám mây 100% miễn phí.</strong>
</p>

[Tính Năng](#-tính-năng-nổi-bật) • [Cài Đặt](#-hướng-dẫn-cài-đặt--chạy-cục-bộ) • [Cấu Hình Env](#-cấu-hình-biến-môi-trường-env) • [CI/CD](#-tự-động-hóa-cicd-github-actions) • [Phím Tắt](#-phím-tắt-tiện-ích)

</div>

---

## ✨ Tính Năng Nổi Bật

### 1. 📂 Tích Hợp Google Drive & PDF Cloud
- **Quét thư mục Google Drive tự động:** Chỉ cần dán link thư mục Drive (`folders/...`), hệ thống tự động quét và sắp xếp toàn bộ ảnh từ trang 1 đến hết.
- **Hỗ trợ tệp PDF:** Đọc trực tiếp tệp PDF từ Google Drive hoặc link PDF trực tuyến bằng Mozilla PDF.js & Google Embed Viewer.
- **Hỗ trợ dán link/ID hàng loạt:** Nhận diện và trích xuất Google Drive File ID từ nhiều định dạng URL khác nhau.

### 2. ⚡ Kiến Trúc Chịu Tải Cao (10,000+ Readers)
- **Cloudflare Edge Image Proxy:** Tự động cache ảnh truyện tại hơn 300 trung tâm dữ liệu Cloudflare toàn cầu trong 30 ngày (`Cache-Control: public, max-age=2592000, immutable`), giải tỏa 100% nguy cơ vượt hạn ngạch (quota) của Google Drive.
- **Multi-tier CDN Fallback:** Bộ điều hướng tải ảnh 5 cấp độ (`Cloudflare Edge Proxy` ➔ `Google UserContent CDN` ➔ `Thumbnail API` ➔ `UC View` ➔ `UC Download`), đảm bảo ảnh luôn hiển thị ổn định.
- **Stale-While-Revalidate & 3-Layer Database:** Tải trang tức thì trong 0ms từ bộ nhớ đệm LocalStorage, tự động đồng bộ ngầm dữ liệu mới nhất từ Google Sheet.

### 3. 📖 Trải Nghiệm Đọc Truyện Đỉnh Cao
- **Chế độ Webtoon (Cuộn Dọc):** Tràn viền mượt mà, tự động ẩn thanh điều hướng và thu gọn sidebar khi vuốt xuống trên điện thoại.
- **Chế độ Manga (Lật Trang Ngang):** Tích hợp công nghệ **Canvas Page Curl Engine** bẻ cong, uốn nếp gấp giấy theo ngón tay 2D/3D chân thực.
- **Tự động sắp xếp chương thông minh:** Thuật toán sắp xếp tự nhiên theo tên chương (`Chương 1 ➔ 2 ➔ ... ➔ 9 ➔ 10 ➔ 100`), hỗ trợ nút đổi chiều sắp xếp `Chương 1 ➔ Mới nhất` hoặc `Mới nhất ➔ Chương 1`.
- **Tự động cuộn (Auto-scroll):** Tùy chỉnh tốc độ cuộn tự động rảnh tay.

### 4. 🗄️ Google Sheets Database & Quản Trị Admin
- Sử dụng Google Sheet làm Database trực tiếp thông qua Google Apps Script Web App.
- Thêm truyện mới, thêm chương mới, chỉnh sửa ảnh bìa, cập nhật thông tin được bảo vệ bằng Mật Khẩu Admin.

### 5. 🔥 Đếm Lượt Xem Thời Gian Thực (Firebase Realtime DB)
- Tích hợp Firebase Realtime Database đếm lượt xem thật thời gian thực.
- Cơ chế Debounce 5 phút chống spam F5 lượt xem trên cùng một thiết bị.

### 6. 🧪 Kiểm Thử Tự Động & CI/CD
- 100% mã nguồn được chuẩn hóa bằng **TypeScript** với type-safety nghiêm ngặt.
- Tích hợp **Vitest** với 12 bài kiểm thử tự động (Unit Tests) cho các thuật toán lõi.
- **GitHub Actions CI/CD:** Tự động kiểm tra TypeScript, chạy test và deploy lên Cloudflare Pages mỗi khi push code lên nhánh `main`.

---

## 📁 Cấu Trúc Thư Mục

```
manga-page/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD Workflow
├── functions/
│   └── api/
│       └── image-proxy.js      # Cloudflare Pages Function (Edge Cache Proxy)
├── public/
│   ├── _headers                # Cloudflare Cache & Performance Headers
│   └── _redirects              # SPA URL Routing redirects
├── src/
│   ├── components/
│   │   ├── addChapterModal.ts  # Modal thêm chương mới
│   │   ├── editChapterModal.ts # Modal chỉnh sửa chương
│   │   ├── editMangaModal.ts   # Modal đổi ảnh bìa & thông tin truyện
│   │   ├── importModal.ts      # Modal thêm truyện mới từ Drive/PDF
│   │   ├── library.ts          # Giao diện danh mục & chi tiết truyện
│   │   └── reader.ts           # Trình đọc Webtoon & Canvas Page Curl Engine
│   ├── data/
│   │   └── sampleManga.ts      # Dữ liệu truyện mẫu dự phòng offline
│   ├── types/
│   │   ├── global.d.ts         # Ambient types cho Firebase, PDF.js, PageFlip
│   │   └── manga.ts            # Type definitions (Manga, Chapter, DriveUrls...)
│   ├── app.ts                  # Entry point chính của ứng dụng
│   ├── driveHelper.ts          # Bộ phân tích Drive Link & Multi-tier CDN Fallbacks
│   ├── firebaseService.ts      # Dịch vụ đếm lượt xem Realtime Firebase
│   ├── pdfHelper.ts            # Trình nhúng và xử lý tệp PDF
│   ├── router.ts               # SPA Hash/Path Router
│   └── sheetDatabase.ts        # Kết nối & Đồng bộ Google Sheet Database
├── styles/
│   └── index.css               # Glassmorphic Dark Theme CSS System
├── tests/
│   ├── driveHelper.test.ts     # Unit tests cho DriveHelper
│   ├── firebaseService.test.ts # Unit tests cho FirebaseService
│   └── sheetDatabase.test.ts   # Unit tests cho SheetDatabase & Natural Sort
├── .env.example                # File mẫu biến môi trường
├── index.html                  # Giao diện HTML chính
├── package.json                # Dependencies & Scripts
├── tsconfig.json               # Cấu hình TypeScript
└── vite.config.ts              # Cấu hình Vite Build
```

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Cục Bộ

### Yêu Cầu Hệ Thống
- [Node.js](https://nodejs.org/) phiên bản 18.0 trở lên.
- Trình quản lý gói `npm` (đi kèm sẵn với Node.js).

### Các Bước Thực Hiện

1. **Clone repository về máy:**
   ```bash
   git clone https://github.com/linh4264/manga-page.git
   cd manga-page
   ```

2. **Cài đặt các gói phụ thuộc:**
   ```bash
   npm install
   ```

3. **Tạo file môi trường `.env`:**
   ```bash
   cp .env.example .env
   ```

4. **Khởi chạy máy chủ phát triển (Dev Server):**
   ```bash
   npm run dev
   ```
   👉 Truy cập ứng dụng tại: **[http://localhost:3000](http://localhost:3000)**

5. **Chạy kiểm thử tự động (Unit Tests):**
   ```bash
   npm test
   ```

6. **Kiểm tra kiểu dữ liệu TypeScript:**
   ```bash
   npm run type-check
   ```

7. **Đóng gói sản phẩm (Production Build):**
   ```bash
   npm run build
   ```

---

## ⚙️ Cấu Hình Biến Môi Trường (`.env`)

Tạo file `.env` ở thư mục gốc của dự án:

```env
# URL Google Apps Script Web App kết nối Google Sheet Database
VITE_GOOGLE_SHEET_API_URL=https://script.google.com/macros/s/your-script-id/exec

# Cấu hình Firebase Realtime Views Database
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your-app-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-app.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:...
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXX
```

---

## 🚀 Tự Động Hóa CI/CD (GitHub Actions)

Dự án đã được thiết lập sẵn file workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). Mỗi khi bạn đẩy code lên nhánh `main`, GitHub Actions sẽ tự động:

1. Chạy `npm run type-check` (Kiểm tra TypeScript).
2. Chạy `npm test` (Chạy toàn bộ bài test Vitest).
3. Chạy `npm run build` (Đóng gói bundle tối ưu vào `dist/`).
4. Tự động deploy sang **Cloudflare Pages** thông qua Wrangler CLI.

### Kích hoạt Deploy tự động lên Cloudflare Pages:
Vào **GitHub Repo ➔ Settings ➔ Secrets and variables ➔ Actions** và thêm 2 Secrets:
- `CLOUDFLARE_API_TOKEN`: Mã API Token lấy từ Cloudflare Dashboard (Quyền: `Cloudflare Pages - Edit`).
- `CLOUDFLARE_ACCOUNT_ID`: Account ID 32 ký tự trên Cloudflare của bạn.

---

## ⌨️ Phím Tắt Tiện Ích

| Phím Tắt | Chức Năng |
| :---: | :--- |
| **`/`** | Tập trung nhanh vào ô tìm kiếm truyện trên Header. |
| **`←`** hoặc **`A`** | Chuyển sang trang trước (hoặc cuộn lên 1 trang trong Webtoon). |
| **`→`** hoặc **`D`** | Chuyển sang trang kế tiếp (hoặc cuộn xuống 1 trang trong Webtoon). |
| **`↑`** / **`K`** | Cuộn lên nhẹ trong chế độ Webtoon. |
| **`↓`** / **`J`** | Cuộn xuống nhẹ trong chế độ Webtoon. |
| **`Space`** | Cuộn nhanh 1 màn hình đọc. |
| **`F`** | Bật / Tắt chế độ Đọc Toàn Màn Hình (Fullscreen). |
| **`S`** | Ẩn / Hiện thanh điều khiển Sidebar bên trái. |

---

## 📄 Bản Quyền & Giấy Phép

Dự án được phát hành theo giấy phép [MIT License](LICENSE). Mã nguồn hoàn toàn mở cho cộng đồng đọc truyện và phát triển.
