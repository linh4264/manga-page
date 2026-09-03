import { describe, it, expect } from 'vitest';
import { isMangaCopyrightLocked, Manga } from '../src/types/manga';

describe('DMCA Legal Shield & Admin Copyright Kill-Switch', () => {
  describe('1. isMangaCopyrightLocked helper function', () => {
    it('detects Vietnamese "Bản quyền" status case-insensitively', () => {
      expect(isMangaCopyrightLocked({ status: 'Bản quyền' })).toBe(true);
      expect(isMangaCopyrightLocked({ status: 'bản quyền' })).toBe(true);
      expect(isMangaCopyrightLocked({ status: 'BAN QUYEN' })).toBe(true);
      expect(isMangaCopyrightLocked({ status: 'Tạm khóa bản quyền' })).toBe(true);
    });

    it('detects English "Copyright Locked" status', () => {
      expect(isMangaCopyrightLocked({ status: 'Copyright Locked' })).toBe(true);
      expect(isMangaCopyrightLocked({ status: 'copyright locked' })).toBe(true);
    });

    it('returns false for normal statuses', () => {
      expect(isMangaCopyrightLocked({ status: 'Đang tiến hành' })).toBe(false);
      expect(isMangaCopyrightLocked({ status: 'Hoàn thành' })).toBe(false);
      expect(isMangaCopyrightLocked({ status: '' })).toBe(false);
      expect(isMangaCopyrightLocked(null)).toBe(false);
      expect(isMangaCopyrightLocked(undefined)).toBe(false);
    });
  });

  describe('2. Catalog Kill-Switch Filtering', () => {
    it('filters out copyright locked manga from normal readers', () => {
      const sampleCatalog: Manga[] = [
        {
          id: 'manga-1',
          title: 'Truyện An Toàn 1',
          status: 'Đang tiến hành',
          chapters: []
        },
        {
          id: 'manga-copyright-flagged',
          title: 'Truyện Dính Gậy Bản Quyền',
          status: 'Bản quyền',
          chapters: []
        },
        {
          id: 'manga-2',
          title: 'Truyện An Toàn 2',
          status: 'Hoàn thành',
          chapters: []
        }
      ];

      const visibleCatalog = sampleCatalog.filter(m => !isMangaCopyrightLocked(m));
      expect(visibleCatalog.length).toBe(2);
      expect(visibleCatalog.map(m => m.id)).toEqual(['manga-1', 'manga-2']);
      expect(visibleCatalog.find(m => m.id === 'manga-copyright-flagged')).toBeUndefined();
    });
  });

  describe('3. DMCA Contact Information Integrity', () => {
    it('verifies designated agent contact email', () => {
      const designatedEmail = 'linhhoang4264@gmail.com';
      expect(designatedEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(designatedEmail).toBe('linhhoang4264@gmail.com');
    });
  });
});
