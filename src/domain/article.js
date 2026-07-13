/**
 * Article domain: adapt upstream items, stable IDs, merge into a map.
 * Stored shape stays compatible with existing localStorage data.
 */

import { parseDate } from './dates.js';
import { safeHttpUrl } from './url.js';

/** Strip HTML tags and common entities from Naver title/description fields. */
export function stripHtml(text) {
  return (text || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

/** Hostname of a URL without a leading "www.", or "" if invalid. */
export function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Stable key for the articles map.
 * Prefer link, then originallink, then title (legacy policy).
 */
export function articleId(article) {
  return article.link || article.originallink || article.title;
}

/**
 * Map a raw Naver/demo search item to the internal Article shape.
 * Links are restricted to http(s) to block javascript: XSS in href.
 * @param {object} rawItem
 * @param {string} keyword
 */
export function toArticle(rawItem, keyword) {
  const rawLink = rawItem.link || rawItem.originallink || '';
  const rawOriginal = rawItem.originallink || rawItem.link || '';
  const link = safeHttpUrl(rawLink) || safeHttpUrl(rawOriginal);

  return {
    title: stripHtml(rawItem.title),
    link,
    source: hostnameFromUrl(link || rawOriginal),
    pubDate: parseDate(rawItem.pubDate).toISOString(),
    description: stripHtml(rawItem.description),
    keyword: String(keyword || '').slice(0, 40),
  };
}

/**
 * Merge articles into an existing id→article map. First write wins.
 * @param {Record<string, object>} existingById
 * @param {object[]} articles
 * @returns {{ map: Record<string, object>, addedCount: number }}
 */
export function mergeArticles(existingById, articles) {
  let addedCount = 0;
  for (const article of articles) {
    const id = articleId(article);
    if (!existingById[id]) {
      existingById[id] = article;
      addedCount++;
    }
  }
  return { map: existingById, addedCount };
}
