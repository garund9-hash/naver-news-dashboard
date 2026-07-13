import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectForKeyword,
  collectForAllKeywords,
  mapPool,
} from '../../src/app/collector.js';

function mockDeps({ rawByKeyword = {}, failKeywords = new Set(), existing = {} } = {}) {
  let articles = { ...existing };
  let updated = false;

  return {
    deps: {
      createNewsSource() {
        return {
          async fetch(keyword) {
            if (failKeywords.has(keyword)) throw new Error('upstream down');
            return rawByKeyword[keyword] || [];
          },
        };
      },
      getProxyUrl: () => 'https://proxy.example',
      getAccessToken: () => '',
      getDisplayCount: () => 10,
      getArticles: () => articles,
      setArticles: (map) => {
        articles = map;
      },
      markUpdatedNow: () => {
        updated = true;
      },
    },
    getArticles: () => articles,
    wasUpdated: () => updated,
  };
}

describe('collectForKeyword (DI)', () => {
  it('merges new articles and reports addedCount (happy path)', async () => {
    const { deps, getArticles } = mockDeps({
      rawByKeyword: {
        규제개혁: [
          {
            title: 'News A',
            link: 'https://news.example/a',
            originallink: 'https://outlet.example/a',
            pubDate: '2025-01-01T00:00:00Z',
            description: 'body',
          },
        ],
      },
    });

    const result = await collectForKeyword('규제개혁', deps);
    assert.equal(result.failed, false);
    assert.equal(result.addedCount, 1);
    assert.ok(getArticles()['https://news.example/a']);
  });

  it('returns failed without throwing when source errors', async () => {
    const { deps } = mockDeps({ failKeywords: new Set(['x']) });
    const result = await collectForKeyword('x', deps);
    assert.deepEqual(result, { addedCount: 0, failed: true });
  });

  it('does not double-count duplicates already in storage', async () => {
    const existing = {
      'https://news.example/a': {
        title: 'old',
        link: 'https://news.example/a',
        keyword: '규제개혁',
        pubDate: '2024-01-01T00:00:00Z',
        description: '',
        source: '',
      },
    };
    const { deps } = mockDeps({
      existing,
      rawByKeyword: {
        규제개혁: [
          {
            title: 'News A again',
            link: 'https://news.example/a',
            pubDate: '2025-01-01T00:00:00Z',
            description: '',
          },
        ],
      },
    });
    const result = await collectForKeyword('규제개혁', deps);
    assert.equal(result.addedCount, 0);
    assert.equal(result.failed, false);
  });

  it('treats null items payload as empty list', async () => {
    const { deps } = mockDeps();
    deps.createNewsSource = () => ({
      async fetch() {
        return null;
      },
    });
    const result = await collectForKeyword('k', deps);
    assert.equal(result.failed, false);
    assert.equal(result.addedCount, 0);
  });
});

describe('collectForAllKeywords (DI)', () => {
  it('aggregates counts and failed keyword names', async () => {
    const { deps, wasUpdated } = mockDeps({
      rawByKeyword: {
        ok: [
          {
            title: 'T',
            link: 'https://news.example/t',
            pubDate: '2025-01-01T00:00:00Z',
            description: '',
          },
        ],
      },
      failKeywords: new Set(['bad']),
    });

    const result = await collectForAllKeywords(['ok', 'bad'], deps);
    assert.equal(result.addedCount, 1);
    assert.deepEqual(result.failedKeywords, ['bad']);
    assert.equal(wasUpdated(), true);
  });

  it('handles empty keyword list', async () => {
    const { deps, wasUpdated } = mockDeps();
    const result = await collectForAllKeywords([], deps);
    assert.deepEqual(result, { addedCount: 0, failedKeywords: [] });
    assert.equal(wasUpdated(), true);
  });

  it('writes storage once for multi-keyword success', async () => {
    let writes = 0;
    const articles = {};
    const deps = {
      createNewsSource() {
        return {
          async fetch(keyword) {
            return [
              {
                title: keyword,
                link: `https://news.example/${keyword}`,
                pubDate: '2025-01-01T00:00:00Z',
                description: '',
              },
            ];
          },
        };
      },
      getProxyUrl: () => 'https://proxy.example',
      getAccessToken: () => '',
      getDisplayCount: () => 10,
      getArticles: () => articles,
      setArticles: (map) => {
        writes++;
        Object.assign(articles, map);
      },
      markUpdatedNow: () => {},
      concurrency: 2,
    };

    const result = await collectForAllKeywords(['a', 'b', 'c'], deps);
    assert.equal(result.addedCount, 3);
    assert.equal(writes, 1);
  });
});

describe('mapPool', () => {
  it('preserves order and respects concurrency bound', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const items = [1, 2, 3, 4, 5];
    const out = await mapPool(items, 2, async (n) => {
      inflight++;
      maxInflight = Math.max(maxInflight, inflight);
      await new Promise((r) => setTimeout(r, 5));
      inflight--;
      return n * 10;
    });
    assert.deepEqual(out, [10, 20, 30, 40, 50]);
    assert.ok(maxInflight <= 2);
    assert.ok(maxInflight >= 1);
  });
});
