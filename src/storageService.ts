/**
 * Robust Client Storage Service for DriveManga
 * - Native IndexedDB with Zero External Dependencies
 * - Memory-First synchronous cache for instant access (0ms latency)
 * - Transparent fallback to LocalStorage/Memory in private browsing modes
 * - Completely avoids LocalStorage 5MB QuotaExceededError
 */

const DB_NAME = 'drive_manga_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_key_value_store';

export class ClientStorageService {
  private memoryCache: Map<string, any> = new Map();
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.hydrateFromLocalStorage();
    this.init();
  }

  /**
   * Fast synchronous initial hydration from LocalStorage into memory cache
   */
  private hydrateFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') return;
    const knownKeys = [
      'sheet_manga_cache',
      'sheet_manga_sync_time',
      'custom_manga_list',
      'reading_history',
      'manga_bookmarks',
      'drive_manga_reading_mode'
    ];

    for (const key of knownKeys) {
      try {
        const item = localStorage.getItem(key);
        if (item !== null) {
          try {
            this.memoryCache.set(key, JSON.parse(item));
          } catch {
            this.memoryCache.set(key, item);
          }
        }
      } catch {
        // Ignore localStorage access errors
      }
    }
  }

  /**
   * Initialize IndexedDB database connection and sync cache
   */
  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        this.isInitialized = true;
        resolve();
        return;
      }

      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };

        req.onsuccess = async (e: Event) => {
          this.db = (e.target as IDBOpenDBRequest).result;
          await this.loadAllFromIndexedDB();
          this.isInitialized = true;
          resolve();
        };

        req.onerror = () => {
          console.warn('IndexedDB unavailable or blocked. Using memory + localStorage fallback.');
          this.isInitialized = true;
          resolve();
        };
      } catch (err) {
        console.warn('Error opening IndexedDB:', err);
        this.isInitialized = true;
        resolve();
      }
    });

    return this.initPromise;
  }

  /**
   * Load all entries from IndexedDB into memoryCache
   */
  private async loadAllFromIndexedDB(): Promise<void> {
    if (!this.db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.openCursor();

        req.onsuccess = (e: Event) => {
          const cursor = (e.target as IDBRequest).result as IDBCursorWithValue | null;
          if (cursor) {
            this.memoryCache.set(String(cursor.key), cursor.value);
            cursor.continue();
          } else {
            resolve();
          }
        };

        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Synchronous get from in-memory cache (Instant 0ms retrieval)
   */
  public getSync<T>(key: string, defaultValue: T): T {
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }
    return defaultValue;
  }

  /**
   * Asynchronous get: ensures IndexedDB is initialized before returning
   */
  public async getItem<T>(key: string, defaultValue: T): Promise<T> {
    await this.init();
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key) as T;
    }
    return defaultValue;
  }

  /**
   * Set item: updates memory cache instantly and persists to IndexedDB asynchronously
   */
  public async setItem<T>(key: string, value: T): Promise<void> {
    this.memoryCache.set(key, value);

    // Mirror to localStorage if possible (safe from quota crash)
    if (typeof localStorage !== 'undefined') {
      try {
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);
        // Only write to localStorage if smaller than 500KB to prevent quota overflow
        if (serialized.length < 500000) {
          localStorage.setItem(key, serialized);
        }
      } catch {
        // Silently ignore quota exceeded errors
      }
    }

    if (!this.db) {
      await this.init();
    }

    if (!this.db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  /**
   * Remove item from memory cache, IndexedDB, and localStorage
   */
  public async removeItem(key: string): Promise<void> {
    this.memoryCache.delete(key);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    if (!this.db) {
      await this.init();
    }

    if (!this.db) return;

    return new Promise<void>((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

export const StorageService = new ClientStorageService();

if (typeof window !== 'undefined') {
  (window as any).StorageService = StorageService;
}
