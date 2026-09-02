import { describe, it, expect, beforeEach } from 'vitest';
import { StorageService } from '../src/storageService';

describe('StorageService - Memory-First & Safe Fallback Storage', () => {
  beforeEach(async () => {
    await StorageService.init();
  });

  it('stores and retrieves values synchronously and asynchronously', async () => {
    const testData = [{ id: '1', title: 'Truyện Test 1' }, { id: '2', title: 'Truyện Test 2' }];
    await StorageService.setItem('test_manga_list', testData);

    // Synchronous retrieval from in-memory cache
    const syncResult = StorageService.getSync('test_manga_list', []);
    expect(syncResult).toEqual(testData);

    // Asynchronous retrieval
    const asyncResult = await StorageService.getItem('test_manga_list', []);
    expect(asyncResult).toEqual(testData);

    // Default value when key does not exist
    expect(StorageService.getSync('non_existent_key', 'default_val')).toBe('default_val');
  });

  it('handles large payload gracefully without throwing QuotaExceededError', async () => {
    // Generate 600KB payload (which exceeds safe limits of typical single items)
    const largeCatalog = Array.from({ length: 50 }, (_, i) => ({
      id: `large-manga-${i}`,
      title: `Bộ Truyện Siêu Lớn Số ${i} - Tiêu Đề Rất Dài Để Kiểm Tra Khả Năng Lưu Trữ`,
      author: 'Tác Giả Dài Tên Nhất Việt Nam',
      description: 'Mô tả bộ truyện cực kỳ dài dòng nhằm mục đích kiểm thử dung lượng lưu trữ an toàn... '.repeat(10),
      chapters: Array.from({ length: 20 }, (_, c) => ({
        id: `chap-${c}`,
        title: `Chương ${c + 1}`,
        pages: Array.from({ length: 30 }, (_, p) => `https://drive.google.com/thumbnail?id=1234567890abcdef_${i}_${c}_${p}&sz=w1600`)
      }))
    }));

    // Should not throw
    await expect(StorageService.setItem('large_catalog_test', largeCatalog)).resolves.not.toThrow();

    const retrieved = StorageService.getSync('large_catalog_test', []);
    expect(retrieved).toHaveLength(50);
  });

  it('removes keys cleanly', async () => {
    await StorageService.setItem('temp_key', 'temp_value');
    expect(StorageService.getSync('temp_key', null)).toBe('temp_value');

    await StorageService.removeItem('temp_key');
    expect(StorageService.getSync('temp_key', null)).toBeNull();
  });
});
