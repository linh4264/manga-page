/**
 * Ambient declarations for third-party libraries loaded via CDN and Vite Env
 */

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_SHEET_API_URL?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_DATABASE_URL?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    firebase?: any;
    pdfjsLib?: any;
    PageFlip?: any;
    SAMPLE_MANGA_DATA?: any[];
    SheetDatabase?: any;
    StorageService?: any;
    DriveHelper?: any;
    PdfHelper?: any;
    FirebaseService?: any;
    ReaderComponent?: any;
    LibraryComponent?: any;
    ImportModalComponent?: any;
    AddChapterModalComponent?: any;
    EditChapterModalComponent?: any;
    EditMangaModalComponent?: any;
    AppRouter?: any;
    app?: any;
    currentReaderComponent?: any;
  }
}

export {};
