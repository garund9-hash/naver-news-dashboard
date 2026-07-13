/**
 * localStorage repository.
 * Physical key strings must stay stable for existing users.
 * Values are re-validated on read so tampered storage cannot escalate abuse.
 *
 * Performance: sanitized article map is cached in memory until the next write
 * so render/filter paths do not re-parse JSON + re-sanitize every time.
 */

import { FILTER_ALL } from '../domain/filters.js';
import { safeHttpUrl, validateProxyBaseUrl } from '../domain/url.js';

export { FILTER_ALL };

const DEFAULT_KEYWORDS = ['개인정보보호', '규제개혁'];
const DEFAULT_DISPLAY_COUNT = 50;
const MIN_DISPLAY_COUNT = 1;
const MAX_DISPLAY_COUNT = 100;
const MAX_KEYWORD_LENGTH = 40;
const MAX_KEYWORDS = 50;

/** Physical localStorage key names (do not rename without a migration). */
const STORAGE_KEYS = {
  keywords: 'nnd_keywords',
  proxyUrl: 'nnd_proxy',
  accessToken: 'nnd_access_token',
  displayCount: 'nnd_display',
  articles: 'nnd_articles',
  filter: 'nnd_filter',
  updatedAt: 'nnd_updated',
};

/** @type {Record<string, object> | null} */
let articlesCache = null;

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sanitizeKeyword(value) {
  return String(value ?? '')
    .trim()
    .slice(0, MAX_KEYWORD_LENGTH);
}

function sanitizeArticlesMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const sanitized = {};
  for (const [id, article] of Object.entries(raw)) {
    if (!article || typeof article !== 'object') continue;
    const link = safeHttpUrl(article.link);
    sanitized[id] = {
      ...article,
      title: String(article.title ?? '').slice(0, 500),
      description: String(article.description ?? '').slice(0, 2000),
      keyword: sanitizeKeyword(article.keyword),
      link,
      source: String(article.source ?? '').slice(0, 200),
    };
  }
  return sanitized;
}

export function getKeywords() {
  // Missing key → factory defaults. Explicit empty array stays empty.
  if (localStorage.getItem(STORAGE_KEYS.keywords) == null) {
    return [...DEFAULT_KEYWORDS];
  }
  const raw = readJson(STORAGE_KEYS.keywords, []);
  if (!Array.isArray(raw)) return [...DEFAULT_KEYWORDS];

  const cleaned = [];
  for (const item of raw) {
    const keyword = sanitizeKeyword(item);
    if (!keyword || cleaned.includes(keyword)) continue;
    cleaned.push(keyword);
    if (cleaned.length >= MAX_KEYWORDS) break;
  }
  return cleaned;
}

export function setKeywords(keywords) {
  const cleaned = [];
  for (const item of keywords || []) {
    const keyword = sanitizeKeyword(item);
    if (!keyword || cleaned.includes(keyword)) continue;
    cleaned.push(keyword);
    if (cleaned.length >= MAX_KEYWORDS) break;
  }
  localStorage.setItem(STORAGE_KEYS.keywords, JSON.stringify(cleaned));
}

export function getProxyUrl() {
  const stored = localStorage.getItem(STORAGE_KEYS.proxyUrl) || '';
  const result = validateProxyBaseUrl(stored);
  return result.ok ? result.url : '';
}

export function setProxyUrl(proxyUrl) {
  const result = validateProxyBaseUrl(proxyUrl);
  localStorage.setItem(STORAGE_KEYS.proxyUrl, result.ok ? result.url : '');
}

/** Optional shared secret for Worker ACCESS_TOKEN (never a Naver key). */
export function getAccessToken() {
  return localStorage.getItem(STORAGE_KEYS.accessToken) || '';
}

export function setAccessToken(token) {
  localStorage.setItem(STORAGE_KEYS.accessToken, String(token || '').trim().slice(0, 200));
}

/** How many items to request per keyword (clamped to Naver limits). */
export function getDisplayCount() {
  const parsed = parseInt(localStorage.getItem(STORAGE_KEYS.displayCount) || '', 10);
  if (Number.isNaN(parsed)) return DEFAULT_DISPLAY_COUNT;
  return Math.max(MIN_DISPLAY_COUNT, Math.min(MAX_DISPLAY_COUNT, parsed));
}

export function setDisplayCount(count) {
  const parsed = parseInt(count, 10);
  const safe = Number.isNaN(parsed)
    ? DEFAULT_DISPLAY_COUNT
    : Math.max(MIN_DISPLAY_COUNT, Math.min(MAX_DISPLAY_COUNT, parsed));
  localStorage.setItem(STORAGE_KEYS.displayCount, String(safe));
}

/**
 * @returns {Record<string, object>} id → article
 * Cached after first sanitize; invalidated on setArticles.
 */
export function getArticles() {
  if (articlesCache) return articlesCache;
  const raw = readJson(STORAGE_KEYS.articles, {});
  articlesCache = sanitizeArticlesMap(raw);
  return articlesCache;
}

export function setArticles(articlesById) {
  const next = articlesById || {};
  localStorage.setItem(STORAGE_KEYS.articles, JSON.stringify(next));
  // Keep a live reference so follow-up reads in the same turn skip re-parse.
  // Callers should not mutate without going through setArticles again.
  articlesCache = next;
}

/** Drop in-memory article cache (tests / rare external LS edits). */
export function invalidateArticlesCache() {
  articlesCache = null;
}

export function getFilter() {
  const filter = localStorage.getItem(STORAGE_KEYS.filter) || FILTER_ALL;
  if (filter === FILTER_ALL) return FILTER_ALL;
  return sanitizeKeyword(filter) || FILTER_ALL;
}

export function setFilter(filterKeyword) {
  if (filterKeyword === FILTER_ALL) {
    localStorage.setItem(STORAGE_KEYS.filter, FILTER_ALL);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.filter, sanitizeKeyword(filterKeyword) || FILTER_ALL);
}

export function getUpdatedAt() {
  return localStorage.getItem(STORAGE_KEYS.updatedAt) || '';
}

export function setUpdatedAt(isoTimestamp) {
  localStorage.setItem(STORAGE_KEYS.updatedAt, isoTimestamp);
}

export function markUpdatedNow() {
  setUpdatedAt(new Date().toISOString());
}

export const LIMITS = {
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS,
  MIN_DISPLAY_COUNT,
  MAX_DISPLAY_COUNT,
};
