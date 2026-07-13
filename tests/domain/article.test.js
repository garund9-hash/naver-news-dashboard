import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtml,
  hostnameFromUrl,
  articleId,
  toArticle,
  mergeArticles,
} from '../../src/domain/article.js';

describe('stripHtml', () => {
  it('removes tags and decodes common entities (happy path)', () => {
    assert.equal(stripHtml('<b>규제</b> &amp; 개혁'), '규제 & 개혁');
    assert.equal(stripHtml('&quot;quoted&quot; &#39;x&#39;'), '"quoted" \'x\'');
  });

  it('handles nullish and empty input', () => {
    assert.equal(stripHtml(null), '');
    assert.equal(stripHtml(undefined), '');
    assert.equal(stripHtml(''), '');
  });

  it('does not interpret nested or broken tags as executable HTML after strip', () => {
    // Still plain text — UI must also escapeHtml on render
    assert.equal(stripHtml('<img src=x onerror=alert(1)>'), '');
    assert.equal(stripHtml('a < b > c'), 'a  c'); // naive regex strips between < >
  });
});

describe('hostnameFromUrl', () => {
  it('strips www and returns host', () => {
    assert.equal(hostnameFromUrl('https://www.yna.co.kr/article/1'), 'yna.co.kr');
  });

  it('returns empty for invalid URLs', () => {
    assert.equal(hostnameFromUrl(''), '');
    assert.equal(hostnameFromUrl('not-a-url'), '');
  });
});

describe('articleId', () => {
  it('prefers link, then originallink, then title', () => {
    assert.equal(articleId({ link: 'https://a', originallink: 'https://b', title: 't' }), 'https://a');
    assert.equal(articleId({ originallink: 'https://b', title: 't' }), 'https://b');
    assert.equal(articleId({ title: 'only-title' }), 'only-title');
  });
});

describe('toArticle', () => {
  it('maps a Naver-shaped item (happy path)', () => {
    const article = toArticle(
      {
        title: '<b>Hello</b>',
        link: 'https://news.example/1',
        originallink: 'https://www.outlet.example/1',
        pubDate: 'Wed, 01 Jan 2025 12:00:00 +0900',
        description: '<p>body</p>',
      },
      '규제개혁'
    );
    assert.equal(article.title, 'Hello');
    assert.equal(article.link, 'https://news.example/1');
    // source derives from the resolved safe link (prefer link over originallink)
    assert.equal(article.source, 'news.example');
    assert.equal(article.keyword, '규제개혁');
    assert.equal(article.description, 'body');
    assert.ok(article.pubDate.includes('2024') || article.pubDate.includes('2025'));
  });

  it('drops javascript: links and falls back to originallink if safe', () => {
    const article = toArticle(
      {
        title: 't',
        link: 'javascript:alert(1)',
        originallink: 'https://safe.example/x',
        pubDate: '2025-01-01T00:00:00Z',
        description: 'd',
      },
      'k'
    );
    assert.equal(article.link, 'https://safe.example/x');
  });

  it('truncates keyword to 40 characters', () => {
    const long = '가'.repeat(50);
    const article = toArticle(
      { title: 't', link: 'https://a.example', pubDate: '2025-01-01', description: '' },
      long
    );
    assert.equal(article.keyword.length, 40);
  });

  it('tolerates missing fields without throwing', () => {
    const article = toArticle({}, 'kw');
    assert.equal(article.title, '');
    assert.equal(article.link, '');
    assert.equal(article.keyword, 'kw');
    assert.ok(typeof article.pubDate === 'string');
  });
});

describe('mergeArticles', () => {
  it('adds new ids and counts them (happy path)', () => {
    const a = { link: 'https://a', title: 'A', keyword: 'k' };
    const b = { link: 'https://b', title: 'B', keyword: 'k' };
    const { map, addedCount } = mergeArticles({}, [a, b]);
    assert.equal(addedCount, 2);
    assert.equal(Object.keys(map).length, 2);
  });

  it('first write wins on duplicate ids', () => {
    const first = { link: 'https://same', title: 'first', keyword: 'k1' };
    const second = { link: 'https://same', title: 'second', keyword: 'k2' };
    const { map, addedCount } = mergeArticles({}, [first, second]);
    assert.equal(addedCount, 1);
    assert.equal(map['https://same'].title, 'first');
    assert.equal(map['https://same'].keyword, 'k1');
  });

  it('returns zero added for empty list', () => {
    const existing = { 'https://a': { link: 'https://a', title: 'A' } };
    const { map, addedCount } = mergeArticles(existing, []);
    assert.equal(addedCount, 0);
    assert.equal(Object.keys(map).length, 1);
  });

  it('mutates the provided map in place (documented behavior)', () => {
    const existing = {};
    const article = { link: 'https://x', title: 'X' };
    const { map } = mergeArticles(existing, [article]);
    assert.equal(map, existing);
    assert.ok(existing['https://x']);
  });
});
