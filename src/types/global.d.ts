/**
 * Ambient declarations for third-party libraries loaded via CDN
 */

declare global {
  interface Window {
    firebase?: any;
    pdfjsLib?: any;
    PageFlip?: any;
    FB?: any;
    SAMPLE_MANGA_DATA?: any[];
    SheetDatabase?: any;
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
    DISQUS?: any;
    disqus_config?: any;
  }
}

export {};
