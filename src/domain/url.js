/**
 * URL safety helpers — prevent javascript:/data: XSS via href and bad proxy targets.
 */

const ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Return a safe http(s) URL for use in href, or "" if the value is dangerous/invalid.
 * Blocks javascript:, data:, vbscript:, and relative schemes attackers may inject
 * via localStorage tampering or a compromised upstream item.
 */
export function safeHttpUrl(rawUrl) {
  if (rawUrl == null || rawUrl === '') return '';
  const text = String(rawUrl).trim();
  try {
    // Absolute URL only — relative URLs would resolve against the dashboard origin.
    const parsed = new URL(text);
    if (!ALLOWED_LINK_PROTOCOLS.has(parsed.protocol)) return '';
    return parsed.href;
  } catch {
    return '';
  }
}

/**
 * Validate user-configured proxy base URL.
 * Requires https (except localhost http for local Worker dev).
 * @returns {{ ok: true, url: string } | { ok: false, reason: string }}
 */
export function validateProxyBaseUrl(rawUrl) {
  const text = (rawUrl || '').trim();
  if (!text) return { ok: true, url: '' }; // empty = demo mode

  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return { ok: false, reason: '유효한 URL이 아닙니다.' };
  }

  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]';

  if (parsed.protocol === 'https:') {
    return { ok: true, url: parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')) };
  }
  if (parsed.protocol === 'http:' && isLocal) {
    return { ok: true, url: parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '')) };
  }

  return { ok: false, reason: '프록시는 https:// 만 허용됩니다 (로컬 개발 시 http://localhost 가능).' };
}
