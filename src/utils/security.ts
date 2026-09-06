/**
 * Security & Sanitization Utilities for DriveManga
 * - DOM Sanitization & XSS Prevention
 * - URL Protocol Whitelisting
 * - Profanity & Spam Content Filtering
 * - Ephemeral Admin Session Management (No permanent plaintext in LocalStorage)
 */

/**
 * Escape HTML special characters to prevent Cross-Site Scripting (XSS)
 */
export function escapeHtml(input?: string | null): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Validate and sanitize URLs to allow only safe protocols
 * Blocks dangerous protocols like javascript:, vbscript:, data:text/html, etc.
 */
export function sanitizeUrl(url?: string | null, fallback = ''): string {
  if (!url || typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return trimmed;
  }
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (trimmed.startsWith('blob:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
  } catch {
    // Malformed URL
  }

  return fallback;
}

/**
 * Blacklist of common spam keywords, illegal betting/gambling domains, and abusive terms
 */
const SPAM_KEYWORDS = [
  '<script', 'javascript:', 'onerror=', 'onload=', 'document.cookie',
  'casino', 'bet88', 'kubet', 'shbet', 'hi88', 'fb88', 'jun88',
  'kèo bóng', 'soi kèo', 'nổ hũ', 'bắn cá online', 'sex', 'porn', 'xxx'
];

/**
 * Checks if a comment text contains abusive, malicious, or spam content
 */
export function isSpamOrProfane(text?: string | null): { isBlocked: boolean; reason?: string } {
  if (!text || typeof text !== 'string') {
    return { isBlocked: false };
  }

  const lower = text.toLowerCase();

  for (const keyword of SPAM_KEYWORDS) {
    if (lower.includes(keyword)) {
      return {
        isBlocked: true,
        reason: `Nội dung chứa từ ngữ hoặc liên kết không phù hợp ("${keyword}")`
      };
    }
  }

  // Check for excessive repetitive characters (e.g. "aaaaaaa...")
  if (/(.)\1{14,}/.test(lower)) {
    return {
      isBlocked: true,
      reason: 'Nội dung chứa ký tự lặp lại bất thường (Spam)'
    };
  }

  return { isBlocked: false };
}

// ==========================================
// EPHEMERAL ADMIN SESSION MANAGEMENT
// ==========================================

const ADMIN_SESSION_KEY = 'drive_manga_admin_session';

/**
 * Clean up legacy storage entries to prevent clear-text credential persistence in browser storage (CWE-312)
 */
export function purgeLegacyStoragePassword(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem('drive_manga_admin_pw');
    } catch {}
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {}
  }
}

// Store Admin session credentials strictly in ephemeral memory (JavaScript heap).
// This guarantees credentials are never written to disk or DOM WebStorage (localStorage/sessionStorage).
let _memorySessionPassword: string | null = null;

/**
 * Retrieve active Admin session credential from memory
 */
export function getAdminSession(): string | null {
  purgeLegacyStoragePassword();
  return _memorySessionPassword;
}

/**
 * Store Admin session credential strictly in ephemeral memory
 */
export function setAdminSession(token: string): void {
  purgeLegacyStoragePassword();
  if (!token) return;
  _memorySessionPassword = token.trim();
}

/**
 * Clear Admin session (Logout Admin)
 */
export function clearAdminSession(): void {
  purgeLegacyStoragePassword();
  _memorySessionPassword = null;
}

/**
 * Check if the current user session has an active Admin password
 */
export function hasAdminSession(): boolean {
  return Boolean(getAdminSession());
}

// Automatically purge legacy storage password on module load
purgeLegacyStoragePassword();

