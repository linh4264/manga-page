/**
 * Type definitions for DriveManga Data Models
 */

export interface Chapter {
  id: string;
  title: string;
  updatedAt?: string;
  pages: string[];
  pdfUrl?: string;
  isPdf?: boolean;
  fbCommentUrl?: string;
}

/**
 * Lightweight Manga Metadata Summary (Dùng cho Thư viện & Trang chủ để tối ưu băng thông)
 */
export interface MangaSummary {
  id: string;
  title: string;
  originalTitle?: string;
  author?: string;
  artist?: string;
  status?: string;
  coverUrl?: string;
  coverDriveId?: string;
  bannerUrl?: string;
  description?: string;
  genres?: string[];
  rating?: number | string;
  views?: string | number;
  chapterCount?: number;
  latestChapterTitle?: string;
}

/**
 * Chapter Summary (Dùng cho Danh sách chương ở màn hình Chi tiết)
 */
export interface ChapterSummary {
  id: string;
  title: string;
  updatedAt?: string;
  pageCount?: number;
  isPdf?: boolean;
}

/**
 * Chi tiết trang của một chương (Lazy Loaded theo nhu cầu)
 */
export interface ChapterDetail {
  id: string;
  mangaId: string;
  title: string;
  pages: string[];
  pdfUrl?: string;
  isPdf?: boolean;
}

export interface Manga {
  id: string;
  title: string;
  originalTitle?: string;
  author?: string;
  artist?: string;
  status?: 'Đang tiến hành' | 'Hoàn thành' | 'Bản quyền' | string;
  coverUrl?: string;
  coverDriveId?: string;
  bannerUrl?: string;
  description?: string;
  genres?: string[];
  rating?: number | string;
  views?: string | number;
  chapters: Chapter[];
}

/**
 * Kiểm tra xem truyện có đang ở trạng thái Khóa Bản Quyền (Kill-Switch) hay không
 */
export function isMangaCopyrightLocked(manga?: { status?: string } | null): boolean {
  if (!manga || !manga.status) return false;
  const s = manga.status.trim().toLowerCase();
  return s === 'bản quyền' || s === 'ban quyen' || s.includes('bản quyền') || s === 'copyright locked';
}

export interface CommentItem {
  id?: string;
  author: string;
  text: string;
  timestamp: string;
  createdAt?: number;
}

export interface ReadingHistoryItem {
  chapterId: string;
  chapterTitle: string;
  updatedAt: string;
  pageIndex?: number;
}

export interface DriveImageUrls {
  edgeProxy: string | null;
  primary: string;
  fallback1: string;
  fallback2: string;
  fallback3: string;
  webpCdn?: string;
}

export interface FolderScanResult {
  success: boolean;
  images?: string[];
  count?: number;
  error?: string;
}
