import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installMemoryLocalStorage } from '../helpers/memoryLocalStorage.js';

// Install before importing storage (module reads global localStorage).
installMemoryLocalStorage();
const storage = await import('../../src/data/storage.js');

describe('storage repository', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    storage.invalidateArticlesCache();
  });

  it('returns default keywords when key is missing (happy path)', () => {
    assert.deepEqual(storage.getKeywords(), ['개인정보보호', '규제개혁']);
  });

  it('preserves explicit empty keyword list', () => {
    storage.setKeywords([]);
    assert.deepEqual(storage.getKeywords(), []);
  });

  it('dedupes, trims, and truncates keywords', () => {
    const long = 'x'.repeat(100);
    storage.setKeywords(['  a  ', 'a', long, '', null]);
    const keywords = storage.getKeywords();
    assert.equal(keywords[0], 'a');
    assert.equal(keywords[1].length, storage.LIMITS.MAX_KEYWORD_LENGTH);
    assert.equal(keywords.length, 2);
  });

  it('caps keyword count at MAX_KEYWORDS', () => {
    const many = Array.from({ length: 80 }, (_, i) => `k${i}`);
    storage.setKeywords(many);
    assert.equal(storage.getKeywords().length, storage.LIMITS.MAX_KEYWORDS);
  });

  it('clamps display count on read and write', () => {
    storage.setDisplayCount(999);
    assert.equal(storage.getDisplayCount(), 100);
    storage.setDisplayCount(-5);
    assert.equal(storage.getDisplayCount(), 1);
    storage.setDisplayCount('nope');
    assert.equal(storage.getDisplayCount(), 50);
  });

  it('rejects non-https proxy URLs on get/set', () => {
    storage.setProxyUrl('http://evil.example');
    assert.equal(storage.getProxyUrl(), '');
    storage.setProxyUrl('https://proxy.example.workers.dev/');
    assert.equal(storage.getProxyUrl(), 'https://proxy.example.workers.dev');
  });

  it('sanitizes javascript: links when reading articles', () => {
    localStorage.setItem(
      'nnd_articles',
      JSON.stringify({
        bad: {
          title: 'x',
          link: 'javascript:alert(1)',
          keyword: 'k',
          description: 'd',
          source: 's',
        },
        good: {
          title: 'y',
          link: 'https://news.example/1',
          keyword: 'k',
          description: 'd',
          source: 's',
        },
      })
    );
    const articles = storage.getArticles();
    assert.equal(articles.bad.link, '');
    assert.equal(articles.good.link, 'https://news.example/1');
  });

  it('returns {} for corrupt articles JSON', () => {
    localStorage.setItem('nnd_articles', '{not-json');
    assert.deepEqual(storage.getArticles(), {});
  });

  it('handles FILTER_ALL and sanitizes filter keywords', () => {
    storage.setFilter(storage.FILTER_ALL);
    assert.equal(storage.getFilter(), storage.FILTER_ALL);
    storage.setFilter('  규제개혁  ');
    assert.equal(storage.getFilter(), '규제개혁');
  });

  it('stores access token trimmed and length-limited', () => {
    storage.setAccessToken('  secret-token  ');
    assert.equal(storage.getAccessToken(), 'secret-token');
    storage.setAccessToken('z'.repeat(500));
    assert.equal(storage.getAccessToken().length, 200);
  });
});
