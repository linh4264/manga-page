import { describe, it, expect, beforeEach } from 'vitest';
import {
  escapeHtml,
  sanitizeUrl,
  isSpamOrProfane,
  getAdminSession,
  setAdminSession,
  clearAdminSession,
  hasAdminSession
} from '../src/utils/security';

describe('Security Utilities - XSS Sanitization & Spam Filter', () => {
  it('escapes HTML special characters correctly', () => {
    expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    expect(escapeHtml("John's Book & Story")).toBe('John&#039;s Book &amp; Story');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('Solo Leveling')).toBe('Solo Leveling');
  });

  it('sanitizes URLs and blocks dangerous protocols', () => {
    expect(sanitizeUrl('https://example.com/cover.jpg')).toBe('https://example.com/cover.jpg');
    expect(sanitizeUrl('/Credit.webp')).toBe('/Credit.webp');
    expect(sanitizeUrl('./assets/cover.png')).toBe('./assets/cover.png');
    expect(sanitizeUrl('data:image/png;base64,iVBOR...')).toBe('data:image/png;base64,iVBOR...');
    expect(sanitizeUrl('blob:http://localhost/123')).toBe('blob:http://localhost/123');

    // Dangerous protocols
    expect(sanitizeUrl('javascript:alert(1)', 'fallback')).toBe('fallback');
    expect(sanitizeUrl('vbscript:msgbox(1)', 'fallback')).toBe('fallback');
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>', 'fallback')).toBe('fallback');
  });

  it('detects spam, abusive keywords, and bot patterns', () => {
    expect(isSpamOrProfane('Truyện đọc rất hay và lôi cuốn!').isBlocked).toBe(false);
    expect(isSpamOrProfane('Chương này vẽ đẹp quá').isBlocked).toBe(false);

    // Spam keyword detection
    expect(isSpamOrProfane('Chơi bài casino trực tuyến nhận 100k').isBlocked).toBe(true);
    expect(isSpamOrProfane('Vào bet88 soi kèo bóng tối nay').isBlocked).toBe(true);
    expect(isSpamOrProfane('Xem phim sex tại đây').isBlocked).toBe(true);
    expect(isSpamOrProfane('<script>fetch("steal")</script>').isBlocked).toBe(true);

    // Repetitive character spam
    expect(isSpamOrProfane('aaaaaaaaaaaaaaaaaaaaaaaaa').isBlocked).toBe(true);
  });
});

describe('Security Utilities - Ephemeral Admin Session Management', () => {
  beforeEach(() => {
    clearAdminSession();
  });

  it('manages admin session without persisting in localStorage', () => {
    expect(hasAdminSession()).toBe(false);
    expect(getAdminSession()).toBeNull();

    setAdminSession('super_secret_admin_pw');
    expect(hasAdminSession()).toBe(true);
    expect(getAdminSession()).toBe('super_secret_admin_pw');

    clearAdminSession();
    expect(hasAdminSession()).toBe(false);
    expect(getAdminSession()).toBeNull();
  });
});
