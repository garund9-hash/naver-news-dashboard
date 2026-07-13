import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampInt,
  secureEquals,
  isOriginAllowed,
  buildCorsHeaders,
  MAX_QUERY_LENGTH,
} from '../../worker.js';

function requestWith(headers = {}) {
  return {
    headers: {
      get(name) {
        const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
        return key ? headers[key] : null;
      },
    },
  };
}

describe('clampInt', () => {
  it('uses default and clamps to range (happy path + edges)', () => {
    assert.equal(clampInt(null, 50, 1, 100), 50);
    assert.equal(clampInt('10', 50, 1, 100), 10);
    assert.equal(clampInt('0', 50, 1, 100), 1);
    assert.equal(clampInt('999', 50, 1, 100), 100);
    assert.equal(clampInt('abc', 50, 1, 100), 50);
    assert.equal(clampInt('-3', 1, 1, 1000), 1);
  });
});

describe('secureEquals', () => {
  it('returns true only for equal strings', () => {
    assert.equal(secureEquals('token', 'token'), true);
    assert.equal(secureEquals('token', 'tokem'), false);
    assert.equal(secureEquals('token', 'tok'), false);
    assert.equal(secureEquals(null, ''), true);
    assert.equal(secureEquals(undefined, null), true);
  });
});

describe('isOriginAllowed', () => {
  it('allows any origin when allow list is *', () => {
    assert.equal(isOriginAllowed(requestWith({ Origin: 'https://evil.example' }), '*'), true);
  });

  it('allows matching Origin and rejects mismatch', () => {
    const allow = 'https://garund9-hash.github.io';
    assert.equal(isOriginAllowed(requestWith({ Origin: allow }), allow), true);
    assert.equal(
      isOriginAllowed(requestWith({ Origin: 'https://evil.example' }), allow),
      false
    );
  });

  it('falls back to Referer origin comparison', () => {
    const allow = 'https://garund9-hash.github.io';
    assert.equal(
      isOriginAllowed(
        requestWith({ Referer: 'https://garund9-hash.github.io/naver-news-dashboard/' }),
        allow
      ),
      true
    );
    assert.equal(
      isOriginAllowed(requestWith({ Referer: 'https://evil.example/x' }), allow),
      false
    );
  });

  it('allows missing Origin/Referer (CLI) when allow list is concrete', () => {
    assert.equal(
      isOriginAllowed(requestWith({}), 'https://garund9-hash.github.io'),
      true
    );
  });
});

describe('buildCorsHeaders', () => {
  it('includes token header for preflight and Vary: Origin', () => {
    const headers = buildCorsHeaders('https://example.github.io');
    assert.equal(headers['Access-Control-Allow-Origin'], 'https://example.github.io');
    assert.match(headers['Access-Control-Allow-Headers'], /X-Nnd-Token/);
    assert.equal(headers.Vary, 'Origin');
  });
});

describe('MAX_QUERY_LENGTH', () => {
  it('is a positive finite limit', () => {
    assert.equal(MAX_QUERY_LENGTH, 200);
  });
});
