import { describe, it, expect, vi } from 'vitest';
import { FirebaseService } from '../src/firebaseService';

describe('FirebaseService - Comments Moderation & Spam Protection', () => {
  it('rejects empty comments', async () => {
    await expect(FirebaseService.addChapterComment('chap-1', 'Người dùng', '   ')).rejects.toThrow(
      'Nội dung bình luận không được để trống!'
    );
  });

  it('rejects comments containing spam/abusive keywords', async () => {
    await expect(
      FirebaseService.addChapterComment('chap-1', 'Bot', 'Chơi game casino uy tín nổ hũ')
    ).rejects.toThrow(/Bình luận bị từ chối/);

    await expect(
      FirebaseService.addChapterComment('chap-1', 'Hacker', '<script>alert(1)</script>')
    ).rejects.toThrow(/Bình luận bị từ chối/);
  });

  it('enforces rate limiting / debounce on rapid successive comments', async () => {
    // Mock fetch for REST fallback
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: 'comment-123' })
    } as any);

    try {
      // First comment succeeds
      const c1 = await FirebaseService.addChapterComment('chap-1', 'Độc giả', 'Bình luận hợp lệ lần 1');
      expect(c1.author).toBe('Độc giả');

      // Immediate second comment should be rejected by rate limiter
      await expect(
        FirebaseService.addChapterComment('chap-1', 'Độc giả', 'Bình luận hợp lệ lần 2')
      ).rejects.toThrow('Bạn đang gửi bình luận quá nhanh. Vui lòng đợi vài giây!');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles deleteChapterComment cleanly', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true
    } as any);

    try {
      const result = await FirebaseService.deleteChapterComment('chap-1', 'comm-123');
      expect(result).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
