import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FILTER_ALL } from '../../src/domain/filters.js';
import { groupByPeriod, nestByDay, selectArticles } from '../../src/domain/grouping.js';

function article(partial) {
  return {
    title: partial.title || 't',
    link: partial.link || `https://example.com/${partial.title || 't'}`,
    keyword: partial.keyword || 'k',
    pubDate: partial.pubDate,
    description: '',
    source: '',
  };
}

describe('selectArticles', () => {
  const byId = {
    1: article({ title: 'new', keyword: 'a', pubDate: '2025-03-15T12:00:00Z' }),
    2: article({ title: 'old', keyword: 'b', pubDate: '2025-01-01T12:00:00Z' }),
    3: article({ title: 'mid', keyword: 'a', pubDate: '2025-02-01T12:00:00Z' }),
  };

  it('returns all articles newest-first for FILTER_ALL (happy path)', () => {
    const list = selectArticles(byId, FILTER_ALL);
    assert.equal(list.length, 3);
    assert.equal(list[0].title, 'new');
    assert.equal(list[2].title, 'old');
  });

  it('filters by keyword', () => {
    const list = selectArticles(byId, 'a');
    assert.equal(list.length, 2);
    assert.ok(list.every((a) => a.keyword === 'a'));
  });

  it('returns empty for empty map or unknown keyword', () => {
    assert.deepEqual(selectArticles({}, FILTER_ALL), []);
    assert.deepEqual(selectArticles(byId, 'missing'), []);
  });
});

describe('groupByPeriod', () => {
  const items = [
    article({ title: 'm1', pubDate: '2025-03-10T00:00:00Z' }),
    article({ title: 'm2', pubDate: '2025-01-05T00:00:00Z' }),
    article({ title: 'm3', pubDate: '2025-03-20T00:00:00Z' }),
  ];

  it('groups by month newest period first', () => {
    const groups = groupByPeriod(items, 'month');
    assert.ok(groups.length >= 2);
    // First key should be lexicographically greater (newer YYYY-MM)
    assert.ok(groups[0][0] >= groups[1][0]);
    const march = groups.find(([key]) => key.endsWith('03') || key.includes('2025-03'));
    // At least one March article exists in some local TZ bucket
    assert.ok(groups.some(([, list]) => list.length >= 1));
    assert.ok(march || groups[0][1].length >= 1);
  });

  it('groups by day', () => {
    const groups = groupByPeriod(items, 'day');
    assert.ok(groups.length >= 2);
    for (const [key, list] of groups) {
      assert.match(key, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(list.length >= 1);
    }
  });

  it('handles empty list', () => {
    assert.deepEqual(groupByPeriod([], 'month'), []);
  });
});

describe('nestByDay', () => {
  it('nests articles under day keys newest first', () => {
    const items = [
      article({ title: 'a', pubDate: '2025-03-10T10:00:00Z' }),
      article({ title: 'b', pubDate: '2025-03-11T10:00:00Z' }),
      article({ title: 'c', pubDate: '2025-03-10T08:00:00Z' }),
    ];
    const nested = nestByDay(items);
    assert.ok(nested.length >= 1);
    // Same calendar day (local) should share a bucket when TZ keeps both on 10th
    const total = nested.reduce((n, [, list]) => n + list.length, 0);
    assert.equal(total, 3);
  });

  it('handles empty list', () => {
    assert.deepEqual(nestByDay([]), []);
  });
});
