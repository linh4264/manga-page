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

export interface Manga {
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
  chapters: Chapter[];
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
}

export interface DriveImageUrls {
  edgeProxy: string | null;
  primary: string;
  fallback1: string;
  fallback2: string;
  fallback3: string;
}

export interface FolderScanResult {
  success: boolean;
  images?: string[];
  count?: number;
  error?: string;
}
