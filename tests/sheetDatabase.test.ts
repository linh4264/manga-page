import { describe, it, expect } from 'vitest';
import { SheetDatabase } from '../src/sheetDatabase';
import { Chapter, Manga } from '../src/types/manga';

describe('SheetDatabase - Catalog Processing & Natural Sorting', () => {
  it('sorts chapters in natural alphanumeric order (Chương 1, 2, ..., 10, 100)', () => {
    const rawChapters: Chapter[] = [
      { id: '10', title: 'Chương 10: Trận Chiến Cuối', pages: [] },
      { id: '1', title: 'Chương 1: Khởi Đầu', pages: [] },
      { id: '2', title: 'Chương 2: Thức Tỉnh', pages: [] },
      { id: '100', title: 'Chương 100: Ngoại Truyện', pages: [] },
      { id: '1.5', title: 'Chương 1.5: Tiền Truyện', pages: [] },
      { id: '20', title: 'Chương 20: Tiến Hóa', pages: [] }
    ];

    const mangaList: Manga[] = [
      {
        id: 'test-manga',
        title: 'Bộ Truyện Test',
        chapters: rawChapters
      }
    ];

    const sorted = SheetDatabase.sortCatalogChapters(mangaList);
    const sortedTitles = sorted![0].chapters.map(c => c.title);

    expect(sortedTitles).toEqual([
      'Chương 1: Khởi Đầu',
      'Chương 1.5: Tiền Truyện',
      'Chương 2: Thức Tỉnh',
      'Chương 10: Trận Chiến Cuối',
      'Chương 20: Tiến Hóa',
      'Chương 100: Ngoại Truyện'
    ]);
  });

  it('parses CSV published text correctly', () => {
    const csvContent = `id\ttitle\tauthor\tcoverUrl\tdescription\tgenres\tchapters
test-1\tTruyện Mẫu A\tTác Giả A\thttps://example.com/cover.jpg\tMô tả test\tAction, Fantasy\t[{"id":"c1","title":"Chương 1","pages":["img1.jpg"]}]`;

    const result = SheetDatabase.parseCSV(csvContent);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-1');
    expect(result[0].title).toBe('Truyện Mẫu A');
    expect(result[0].genres).toEqual(['Action', 'Fantasy']);
    expect(result[0].chapters).toHaveLength(1);
    expect(result[0].chapters[0].title).toBe('Chương 1');
  });
});
