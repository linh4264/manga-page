import { describe, it, expect } from 'vitest';
import { FirebaseViewService } from '../src/firebaseService';

describe('FirebaseViewService - Key Sanitization & View Formatting', () => {
  const service = new FirebaseViewService();

  it('sanitizes manga ID with special characters for Firebase key validity', () => {
    expect(service.sanitizeKey('solo.leveling#1$special[key]/end')).toBe('solo_leveling_1_special_key__end');
    expect(service.sanitizeKey('manga-123')).toBe('manga-123');
    expect(service.sanitizeKey('')).toBe('unknown');
  });

  it('sanitizes chapter ID for Firebase key validity', () => {
    expect(service.sanitizeChapterKey('chap.1#part2$sub[1]/test')).toBe('chap_1_part2_sub_1__test');
    expect(service.sanitizeChapterKey('chap-1')).toBe('chap-1');
    expect(service.sanitizeChapterKey('')).toBe('unknown_chapter');
  });

  it('formats view counts into readable K/M suffix', () => {
    expect(service.formatViewCount(500)).toBe('500');
    expect(service.formatViewCount(1500)).toBe('1.5K');
    expect(service.formatViewCount(10000)).toBe('10K');
    expect(service.formatViewCount(2500000)).toBe('2.5M');
  });
});
