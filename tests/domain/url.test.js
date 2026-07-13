import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeHttpUrl, validateProxyBaseUrl } from '../../src/domain/url.js';

describe('safeHttpUrl', () => {
  it('allows absolute http and https URLs (happy path)', () => {
    assert.equal(safeHttpUrl('https://news.naver.com/main'), 'https://news.naver.com/main');
    assert.equal(safeHttpUrl('http://example.com/a?q=1'), 'http://example.com/a?q=1');
  });

  it('returns empty for nullish, blank, and relative values', () => {
    assert.equal(safeHttpUrl(null), '');
    assert.equal(safeHttpUrl(undefined), '');
    assert.equal(safeHttpUrl(''), '');
    assert.equal(safeHttpUrl('   '), '');
    assert.equal(safeHttpUrl('/path/only'), '');
    assert.equal(safeHttpUrl('//evil.example/x'), '');
    assert.equal(safeHttpUrl('not a url'), '');
  });

  it('blocks dangerous schemes used for XSS via href', () => {
    assert.equal(safeHttpUrl('javascript:alert(1)'), '');
    assert.equal(safeHttpUrl('JAVASCRIPT:alert(1)'), ''); // URL normalizes protocol
    assert.equal(safeHttpUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(safeHttpUrl('vbscript:msgbox(1)'), '');
  });

  it('trims surrounding whitespace before parsing', () => {
    assert.equal(safeHttpUrl('  https://ok.example/  '), 'https://ok.example/');
  });
});

describe('validateProxyBaseUrl', () => {
  it('treats empty as demo mode', () => {
    assert.deepEqual(validateProxyBaseUrl(''), { ok: true, url: '' });
    assert.deepEqual(validateProxyBaseUrl('   '), { ok: true, url: '' });
    assert.deepEqual(validateProxyBaseUrl(null), { ok: true, url: '' });
  });

  it('accepts https worker URLs and strips trailing slash on root', () => {
    const result = validateProxyBaseUrl('https://naver-news-proxy.example.workers.dev/');
    assert.equal(result.ok, true);
    assert.equal(result.url, 'https://naver-news-proxy.example.workers.dev');
  });

  it('allows http only for localhost development', () => {
    assert.equal(validateProxyBaseUrl('http://localhost:8787').ok, true);
    assert.equal(validateProxyBaseUrl('http://127.0.0.1:8787').ok, true);
    assert.equal(validateProxyBaseUrl('http://evil.example').ok, false);
  });

  it('rejects malformed and non-http(s) schemes', () => {
    assert.equal(validateProxyBaseUrl('notaurl').ok, false);
    assert.equal(validateProxyBaseUrl('ftp://files.example').ok, false);
    assert.equal(validateProxyBaseUrl('javascript:alert(1)').ok, false);
  });
});
