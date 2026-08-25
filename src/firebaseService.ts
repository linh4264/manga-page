/**
 * Firebase Realtime Database Service for DriveManga
 * Quản lý đếm lượt xem (Views) thật theo thời gian thực (Real-time View Counter)
 */

const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyAQPv0p09EmCdPisFdluwEpsIZh4d653A4",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "drivemanga4264.firebaseapp.com",
  databaseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_URL) || "https://drivemanga4264-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "drivemanga4264",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "drivemanga4264.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "485073426909",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:485073426909:web:460a2b4b659c796d6c3e34",
  measurementId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || "G-TTNTCZ25T7"
};

export class FirebaseViewService {
  db: any = null;
  viewsMap: Record<string, number> = {};
  listeners: Set<(views: Record<string, number>) => void> = new Set();
  isInitialized = false;

  constructor() {
    this.init();
  }

  /**
   * Khởi tạo Firebase App & Realtime Database
   */
  init(): void {
    if (typeof window !== 'undefined' && typeof window.firebase !== 'undefined') {
      try {
        if (!window.firebase.apps?.length) {
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
      this.initRestFallback();
    }
  }

  /**
   * Chuẩn hóa Manga ID để dùng làm Firebase Database Key hợp lệ
   */
  sanitizeKey(id?: string | null): string {
    if (!id) return 'unknown';
    return String(id).trim().replace(/[.#$\[\]\/]/g, '_');
  }

  /**
   * Bắt đầu lắng nghe thay đổi số lượt xem thời gian thực (Real-time listener)
   */
  startListening(): void {
    if (!this.db) return;

    try {
      const viewsRef = this.db.ref('manga_views');
      viewsRef.on('value', (snapshot: any) => {
        const val = snapshot.val();
        if (val && typeof val === 'object') {
          this.viewsMap = val;
          this.notifyListeners();
          this.updateAllViewElementsOnPage();
        }
      }, (error: any) => {
        console.warn('Lỗi lắng nghe Firebase Realtime views:', error);
      });
    } catch (err) {
      console.warn('Lỗi kết nối Firebase ref:', err);
    }
  }

  /**
   * Fallback sử dụng REST API của Firebase
   */
  async initRestFallback(): Promise<void> {
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
   */
  getViewCount(mangaId?: string | null): number {
    const key = this.sanitizeKey(mangaId);
    if (typeof this.viewsMap[key] === 'number') {
      return this.viewsMap[key];
    }
    return 0;
  }

  /**
   * Ghi nhận 1 lượt xem thật (Tăng +1) khi người dùng đọc truyện / chương
   * Có cơ chế chống spam F5 (chỉ tăng 1 lần trong 5 phút trên 1 thiết bị)
   */
  async recordView(mangaId?: string | null): Promise<void> {
    if (!mangaId) return;
    const key = this.sanitizeKey(mangaId);

    // Chống spam: Kiểm tra cooldown 5 phút cho mỗi bộ truyện trên thiết bị này
    const storageKey = `manga_view_time_${key}`;
    const lastViewTime = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    const now = Date.now();

    if (lastViewTime && (now - parseInt(lastViewTime, 10)) < 5 * 60 * 1000) {
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(storageKey, String(now));
    }

    // 1. Tăng view qua Firebase SDK Transaction (Chống xung đột)
    if (this.db) {
      try {
        const mangaViewRef = this.db.ref(`manga_views/${key}`);
        mangaViewRef.transaction((currentViews: number) => {
          return (currentViews || 0) + 1;
        }, (error: any, committed: boolean, snapshot: any) => {
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

  subscribe(callback: (views: Record<string, number>) => void): void {
    if (typeof callback === 'function') {
      this.listeners.add(callback);
    }
  }

  unsubscribe(callback: (views: Record<string, number>) => void): void {
    this.listeners.delete(callback);
  }

  notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.viewsMap);
      } catch (e) {
        console.error(e);
      }
    });
  }

  updateAllViewElementsOnPage(): void {
    if (typeof document === 'undefined') return;
    document.querySelectorAll('[data-manga-view-id]').forEach((el) => {
      const mangaId = el.getAttribute('data-manga-view-id');
      const key = this.sanitizeKey(mangaId);
      const count = this.viewsMap[key] || 0;
      el.textContent = this.formatViewCount(count);
    });
  }

  updateViewElementsForManga(mangaId: string, count: number): void {
    if (typeof document === 'undefined') return;
    const key = this.sanitizeKey(mangaId);
    document.querySelectorAll(`[data-manga-view-id="${key}"], [data-manga-view-id="${mangaId}"]`).forEach((el) => {
      el.textContent = this.formatViewCount(count);
    });
  }

  formatViewCount(views?: number | string | null): string {
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

export const FirebaseService = new FirebaseViewService();

if (typeof window !== 'undefined') {
  window.FirebaseService = FirebaseService;
}
