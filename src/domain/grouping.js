/**
 * Pure grouping of articles for month/day views.
 * No DOM — returns ordered [key, articles[]] pairs for the UI to render.
 */

import { FILTER_ALL } from './filters.js';
import { parseDate, toDayKey, toMonthKey } from './dates.js';

/**
 * Group articles by month or day key, newest period first.
 * @param {object[]} articles
 * @param {'month' | 'day'} viewMode
 * @returns {Array<[string, object[]]>}
 */
export function groupByPeriod(articles, viewMode) {
  const groups = new Map();

  for (const article of articles) {
    const publishedAt = parseDate(article.pubDate);
    const periodKey = viewMode === 'month' ? toMonthKey(publishedAt) : toDayKey(publishedAt);
    if (!groups.has(periodKey)) groups.set(periodKey, []);
    groups.get(periodKey).push(article);
  }

  // Period keys are zero-padded ISO-like strings → lexicographic sort = chronological.
  return [...groups.entries()].sort(([keyA], [keyB]) => (keyA < keyB ? 1 : keyA > keyB ? -1 : 0));
}

/**
 * Nest a month's articles under day keys (newest day first).
 * @param {object[]} articles
 * @returns {Array<[string, object[]]>}
 */
export function nestByDay(articles) {
  const byDay = new Map();

  for (const article of articles) {
    const dayKey = toDayKey(parseDate(article.pubDate));
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey).push(article);
  }

  return [...byDay.entries()].sort(([keyA], [keyB]) => (keyA < keyB ? 1 : keyA > keyB ? -1 : 0));
}

/**
 * Articles for the active filter, newest first.
 * Precomputes timestamps once so sort comparisons are O(1) each
 * (avoids new Date() per comparison in the comparator).
 * @param {Record<string, object>} articlesById
 * @param {string} filterKeyword  FILTER_ALL or a keyword
 */
export function selectArticles(articlesById, filterKeyword) {
  const all = Object.values(articlesById);
  const filtered =
    filterKeyword === FILTER_ALL
      ? all
      : all.filter((article) => article.keyword === filterKeyword);

  // Decorate → sort by number → undecorate (Schwartzian transform).
  return filtered
    .map((article) => ({ article, ts: Date.parse(article.pubDate) || 0 }))
    .sort((left, right) => right.ts - left.ts)
    .map(({ article }) => article);
}
