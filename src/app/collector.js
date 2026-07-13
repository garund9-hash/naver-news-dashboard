/**
 * Collector facade: news source → domain article → merge into storage.
 * UI calls only this module for collection (never fetch/demo branching).
 *
 * Optional `deps` enables unit tests (DI) without touching global storage/fetch.
 *
 * Performance notes:
 * - collectForAllKeywords fetches keywords with a small concurrency pool
 *   (network-bound), then merges once and writes localStorage once.
 * - Avoids N sequential await + N full JSON.stringify of the article map.
 */

import * as storage from '../data/storage.js';
import { toArticle, mergeArticles } from '../domain/article.js';
import { createNewsSource } from '../sources/createSource.js';

/** Max in-flight proxy requests during multi-keyword refresh. */
export const COLLECT_CONCURRENCY = 3;

/**
 * @typedef {object} CollectorDeps
 * @property {(cfg: object) => { fetch: Function }} [createNewsSource]
 * @property {() => string} [getProxyUrl]
 * @property {() => string} [getAccessToken]
 * @property {() => number} [getDisplayCount]
 * @property {() => Record<string, object>} [getArticles]
 * @property {(map: Record<string, object>) => void} [setArticles]
 * @property {() => void} [markUpdatedNow]
 * @property {number} [concurrency]
 */

function resolveDeps(deps = {}) {
  return {
    createNewsSource: deps.createNewsSource || createNewsSource,
    getProxyUrl: deps.getProxyUrl || storage.getProxyUrl,
    getAccessToken: deps.getAccessToken || storage.getAccessToken,
    getDisplayCount: deps.getDisplayCount || storage.getDisplayCount,
    getArticles: deps.getArticles || storage.getArticles,
    setArticles: deps.setArticles || storage.setArticles,
    markUpdatedNow: deps.markUpdatedNow || storage.markUpdatedNow,
    concurrency: deps.concurrency ?? COLLECT_CONCURRENCY,
  };
}

/**
 * Run async work over items with a fixed concurrency pool.
 * @template T, R
 * @param {T[]} items
 * @param {number} concurrency
 * @param {(item: T, index: number) => Promise<R>} worker
 * @returns {Promise<R[]>}
 */
export async function mapPool(items, concurrency, worker) {
  if (!items.length) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

/**
 * Fetch and merge news for a single keyword.
 * @param {string} keyword
 * @param {CollectorDeps} [deps]
 * @returns {Promise<{ addedCount: number, failed: boolean }>}
 */
export async function collectForKeyword(keyword, deps) {
  const d = resolveDeps(deps);
  const source = d.createNewsSource({
    proxyUrl: d.getProxyUrl(),
    accessToken: d.getAccessToken(),
  });

  try {
    const rawItems = await source.fetch(keyword, {
      displayCount: d.getDisplayCount(),
      sort: 'date',
    });
    const articles = (rawItems || []).map((rawItem) => toArticle(rawItem, keyword));
    const existingById = d.getArticles();
    const { map, addedCount } = mergeArticles(existingById, articles);
    d.setArticles(map);
    return { addedCount, failed: false };
  } catch {
    return { addedCount: 0, failed: true };
  }
}

/**
 * Collect for every keyword with bounded parallel fetches, one merge pass,
 * and a single storage write (avoids sequential network + N× stringify).
 * @param {string[]} keywords
 * @param {CollectorDeps} [deps]
 * @returns {Promise<{ addedCount: number, failedKeywords: string[] }>}
 */
export async function collectForAllKeywords(keywords, deps) {
  const d = resolveDeps(deps);
  if (!keywords.length) {
    d.markUpdatedNow();
    return { addedCount: 0, failedKeywords: [] };
  }

  const source = d.createNewsSource({
    proxyUrl: d.getProxyUrl(),
    accessToken: d.getAccessToken(),
  });
  const displayCount = d.getDisplayCount();

  const batches = await mapPool(keywords, d.concurrency, async (keyword) => {
    try {
      const rawItems = await source.fetch(keyword, {
        displayCount,
        sort: 'date',
      });
      const articles = (rawItems || []).map((rawItem) => toArticle(rawItem, keyword));
      return { keyword, articles, failed: false };
    } catch {
      return { keyword, articles: [], failed: true };
    }
  });

  // Single read → merge all batches in keyword order → single write.
  let map = d.getArticles();
  let addedCount = 0;
  const failedKeywords = [];

  for (const batch of batches) {
    if (batch.failed) failedKeywords.push(batch.keyword);
    const merged = mergeArticles(map, batch.articles);
    map = merged.map;
    addedCount += merged.addedCount;
  }

  d.setArticles(map);
  d.markUpdatedNow();
  return { addedCount, failedKeywords };
}
