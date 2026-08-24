/**
 * Firebase Realtime Database Service for DriveManga
 * Quản lý đếm lượt xem (Views) thật theo thời gian thực (Real-time View Counter)
 */

(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyAQPv0p09EmCdPisFdluwEpsIZh4d653A4",
    authDomain: "drivemanga4264.firebaseapp.com",
    databaseURL: "https://drivemanga4264-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "drivemanga4264",
    storageBucket: "drivemanga4264.firebasestorage.app",
    messagingSenderId: "485073426909",
    appId: "1:485073426909:web:460a2b4b659c796d6c3e34",
    measurementId: "G-TTNTCZ25T7"
  };

  class FirebaseViewService {
    constructor() {
      this.db = null;
      this.viewsMap = {};
      this.listeners = new Set();
      this.isInitialized = false;

      this.init();
    }

    /**
     * Khởi tạo Firebase App & Realtime Database
     */
    init() {
      if (typeof window.firebase !== 'undefined') {
        try {
          if (!window.firebase.apps.length) {
            window.firebase.initializeApp(firebaseConfig);
          }
          this.db = window.firebase.database();
          this.isInitialized = true;
          this.startListening();
        } catch (err) {
          console.warn('Lỗi khởi tạo Firebase SDK:', err);
          this.initRestFallback();
        }
      } else {
        // Fallback qua REST API nếu SDK bị chặn
        this.initRestFallback();
      }
    }

    /**
     * Chuẩn hóa Manga ID để dùng làm Firebase Database Key hợp lệ
     * (Loại bỏ các ký tự cấm: ., $, #, [, ], /)
     */
    sanitizeKey(id) {
      if (!id) return 'unknown';
      return String(id).trim().replace(/[.#$\[\]\/]/g, '_');
    }

    /**
     * Bắt đầu lắng nghe thay đổi số lượt xem thời gian thực (Real-time listener)
     */
    startListening() {
      if (!this.db) return;

      try {
        const viewsRef = this.db.ref('manga_views');
        viewsRef.on('value', (snapshot) => {
          const val = snapshot.val();
          if (val && typeof val === 'object') {
            this.viewsMap = val;
            this.notifyListeners();
            this.updateAllViewElementsOnPage();
          }
        }, (error) => {
          console.warn('Lỗi lắng nghe Firebase Realtime views:', error);
        });
      } catch (err) {
        console.warn('Lỗi kết nối Firebase ref:', err);
      }
    }

    /**
     * Fallback sử dụng REST API của Firebase
     */
    async initRestFallback() {
      try {
        const res = await fetch(`${firebaseConfig.databaseURL}/manga_views.json`);
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            this.viewsMap = data;
            this.notifyListeners();
            this.updateAllViewElementsOnPage();
          }
        }
      } catch (e) {
        console.warn('Lỗi tải views qua REST fallback:', e);
      }
    }

    /**
     * Lấy số lượt xem thực tế của 1 bộ truyện
     * @param {string} mangaId 
     * @returns {number} Số view
     */
    getViewCount(mangaId) {
      const key = this.sanitizeKey(mangaId);
      if (typeof this.viewsMap[key] === 'number') {
        return this.viewsMap[key];
      }
      return 0;
    }

    /**
     * Ghi nhận 1 lượt xem thật (Tăng +1) khi người dùng đọc truyện / chương
     * Có cơ chế chống spam F5 (chỉ tăng 1 lần trong 1 phiên duyệt web hoặc cách nhau 5 phút)
     * @param {string} mangaId 
     */
    async recordView(mangaId) {
      if (!mangaId) return;
      const key = this.sanitizeKey(mangaId);

      // Chống spam: Kiểm tra cooldown 5 phút cho mỗi bộ truyện trên thiết bị này
      const storageKey = `manga_view_time_${key}`;
      const lastViewTime = localStorage.getItem(storageKey);
      const now = Date.now();

      if (lastViewTime && (now - parseInt(lastViewTime, 10)) < 5 * 60 * 1000) {
        // Vừa xem trong vòng 5 phút, không tính trùng để số view phản ánh người đọc thật
        return;
      }
      localStorage.setItem(storageKey, String(now));

      // 1. Tăng view qua Firebase SDK Transaction (Chống xung đột)
      if (this.db) {
        try {
          const mangaViewRef = this.db.ref(`manga_views/${key}`);
          mangaViewRef.transaction((currentViews) => {
            return (currentViews || 0) + 1;
          }, (error, committed, snapshot) => {
            if (error) {
              console.warn('Lỗi ghi nhận view transaction:', error);
            } else if (committed && snapshot) {
              this.viewsMap[key] = snapshot.val();
              this.updateViewElementsForManga(key, snapshot.val());
            }
          });
          return;
        } catch (e) {
          console.warn('Lỗi SDK transaction:', e);
        }
      }

      // 2. Fallback tăng view qua REST API
      try {
        const currentViews = this.viewsMap[key] || 0;
        const newViews = currentViews + 1;
        this.viewsMap[key] = newViews;
        this.updateViewElementsForManga(key, newViews);

        await fetch(`${firebaseConfig.databaseURL}/manga_views/${key}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newViews)
        });
      } catch (err) {
        console.warn('Lỗi ghi nhận view qua REST API:', err);
      }
    }

    /**
     * Đăng ký nhận thông báo khi có thay đổi số view
     * @param {Function} callback 
     */
    subscribe(callback) {
      if (typeof callback === 'function') {
        this.listeners.add(callback);
      }
    }

    unsubscribe(callback) {
      this.listeners.delete(callback);
    }

    notifyListeners() {
      this.listeners.forEach((cb) => {
        try {
          cb(this.viewsMap);
        } catch (e) {
          console.error(e);
        }
      });
    }

    /**
     * Cập nhật tất cả các thẻ DOM đang hiển thị số view trên trang
     */
    updateAllViewElementsOnPage() {
      document.querySelectorAll('[data-manga-view-id]').forEach((el) => {
        const mangaId = el.getAttribute('data-manga-view-id');
        const key = this.sanitizeKey(mangaId);
        const count = this.viewsMap[key] || 0;
        el.textContent = this.formatViewCount(count);
      });
    }

    /**
     * Cập nhật thẻ DOM của riêng 1 bộ truyện
     */
    updateViewElementsForManga(mangaId, count) {
      const key = this.sanitizeKey(mangaId);
      document.querySelectorAll(`[data-manga-view-id="${key}"], [data-manga-view-id="${mangaId}"]`).forEach((el) => {
        el.textContent = this.formatViewCount(count);
      });
    }

    /**
     * Định dạng số lượt xem chuyên nghiệp & đẹp mắt (VD: 1.5K, 2.4M, 150)
     * @param {number|string} views 
     * @returns {string}
     */
    formatViewCount(views) {
      const num = Number(views) || 0;
      if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
      }
      if (num >= 1000) {
        return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
      }
      return num.toLocaleString('vi-VN');
    }
  }

  window.FirebaseService = new FirebaseViewService();
})();
