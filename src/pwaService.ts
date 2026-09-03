/**
 * Progressive Web App (PWA) Service for DriveManga
 * Handles Service Worker registration, install prompts, and online/offline connectivity notifications.
 */

export class PwaService {
  private static deferredInstallPrompt: any = null;

  /**
   * Initialize PWA: register Service Worker and setup connectivity listeners
   */
  public static init(): void {
    if (typeof window === 'undefined') return;

    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupConnectivityListeners();
  }

  /**
   * Register Service Worker
   */
  private static registerServiceWorker(): void {
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('DriveManga ServiceWorker registered successfully:', registration.scope);
          })
          .catch((err) => {
            console.warn('DriveManga ServiceWorker registration failed:', err);
          });
      });
    }
  }

  /**
   * Listen to beforeinstallprompt to allow user to install app to Home Screen
   */
  private static setupInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstallPrompt = e;

      // Show Install button in Header if present
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) {
        installBtn.classList.remove('hidden');
        installBtn.addEventListener('click', () => this.promptInstall());
      }
    });

    window.addEventListener('appinstalled', () => {
      this.deferredInstallPrompt = null;
      const installBtn = document.getElementById('btn-install-pwa');
      if (installBtn) {
        installBtn.classList.add('hidden');
      }
      this.showToast('Ứng dụng DriveManga đã được cài đặt thành công!', 'success');
    });
  }

  /**
   * Trigger native browser install dialog
   */
  public static async promptInstall(): Promise<boolean> {
    if (!this.deferredInstallPrompt) return false;

    this.deferredInstallPrompt.prompt();
    const choiceResult = await this.deferredInstallPrompt.userChoice;
    this.deferredInstallPrompt = null;

    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
      installBtn.classList.add('hidden');
    }

    return choiceResult.outcome === 'accepted';
  }

  /**
   * Setup online/offline network connectivity listeners
   */
  private static setupConnectivityListeners(): void {
    window.addEventListener('offline', () => {
      this.showToast(
        '<i class="fas fa-wifi-slash"></i> Bạn đang ngoại tuyến. Các chương đã tải vẫn đọc bình thường!',
        'warning'
      );
    });

    window.addEventListener('online', () => {
      this.showToast(
        '<i class="fas fa-wifi"></i> Đã khôi phục kết nối mạng trực tuyến!',
        'success'
      );
    });
  }

  /**
   * Display modern toast notification on page
   */
  public static showToast(message: string, type: 'info' | 'success' | 'warning' = 'info'): void {
    let container = document.getElementById('app-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'app-toast-container';
      container.className = 'app-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast-item toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">${message}</div>
      <button class="toast-close" title="Đóng">&times;</button>
    `;

    toast.querySelector('.toast-close')?.addEventListener('click', () => {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    // Auto remove after 4.5s
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('toast-fadeout');
        setTimeout(() => toast.remove(), 250);
      }
    }, 4500);
  }
}
