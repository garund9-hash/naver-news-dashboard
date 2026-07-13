/**
 * App entry: wire UI events and paint the dashboard.
 * Domain, storage, and collection live in modules; this file orchestrates only.
 */

import * as storage from './data/storage.js';
import { FILTER_ALL, LIMITS } from './data/storage.js';
import { collectForKeyword, collectForAllKeywords } from './app/collector.js';
import {
  parseDate,
  toDayKey,
  formatMonthLabel,
  formatDayLabel,
  formatClockTime,
} from './domain/dates.js';
import { groupByPeriod, nestByDay, selectArticles } from './domain/grouping.js';
import { safeHttpUrl, validateProxyBaseUrl } from './domain/url.js';
import { query, showToast, escapeHtml, escapeAttr, withButtonLoading } from './ui/dom.js';

const LOADING_LABEL = '<span class="spin"></span>수집 중…';

/** @type {'month' | 'day'} */
let viewMode = 'month';

/* ===================== Keyword chips ===================== */

function renderKeywordChips() {
  const chipsEl = query('#kwChips');
  const keywords = storage.getKeywords();

  if (!keywords.length) {
    chipsEl.innerHTML =
      '<span class="empty-kw">등록된 키워드가 없습니다. 위 입력창에서 추가하세요.</span>';
  } else {
    chipsEl.innerHTML = keywords
      .map(
        (keyword) =>
          `<span class="chip">${escapeHtml(keyword)}` +
          `<span class="x" data-kw="${escapeAttr(keyword)}" title="삭제">✕</span></span>`
      )
      .join('');

    chipsEl.querySelectorAll('.x').forEach((removeBtn) => {
      removeBtn.onclick = () => removeKeyword(removeBtn.dataset.kw);
    });
  }

  renderFilterChips();
}

async function addKeyword() {
  const input = query('#kwInput');
  const keyword = input.value.trim().slice(0, LIMITS.MAX_KEYWORD_LENGTH);
  if (!keyword) return;

  const keywords = storage.getKeywords();
  if (keywords.length >= LIMITS.MAX_KEYWORDS) {
    showToast(`키워드는 최대 ${LIMITS.MAX_KEYWORDS}개까지 등록할 수 있습니다`);
    return;
  }
  if (keywords.includes(keyword)) {
    showToast('이미 등록된 키워드입니다');
    return;
  }

  keywords.push(keyword);
  storage.setKeywords(keywords);
  input.value = '';
  storage.setFilter(keyword);
  renderKeywordChips();

  await withButtonLoading(query('#kwAdd'), LOADING_LABEL, async () => {
    const result = await collectForKeyword(keyword);
    storage.markUpdatedNow();
    renderResults();
    renderStatusBanner();
    showToast(
      result.failed
        ? `"${keyword}" 추가됨 · 수집 실패`
        : `"${keyword}" 추가됨 · 신규 ${result.addedCount}건`
    );
  });
}

function removeKeyword(keyword) {
  storage.setKeywords(storage.getKeywords().filter((item) => item !== keyword));

  const articlesById = storage.getArticles();
  let removedCount = 0;
  for (const id of Object.keys(articlesById)) {
    if (articlesById[id].keyword === keyword) {
      delete articlesById[id];
      removedCount++;
    }
  }
  storage.setArticles(articlesById);

  if (storage.getFilter() === keyword) {
    storage.setFilter(FILTER_ALL);
  }

  renderKeywordChips();
  renderResults();
  showToast(`"${keyword}" 삭제됨 · 관련 뉴스 ${removedCount}건 제거`);
}

/* ===================== Filter chips ===================== */

function renderFilterChips() {
  const chipsEl = query('#filterChips');
  const keywords = storage.getKeywords();
  const activeFilter = storage.getFilter();

  const allChip = filterChipHtml(FILTER_ALL, '전체', activeFilter);
  const keywordChips = keywords
    .map((keyword) => filterChipHtml(keyword, keyword, activeFilter))
    .join('');

  chipsEl.innerHTML = allChip + keywordChips;
  chipsEl.querySelectorAll('.filter').forEach((chip) => {
    chip.onclick = () => {
      storage.setFilter(chip.dataset.f);
      renderFilterChips();
      renderResults();
    };
  });
}

function filterChipHtml(value, label, activeFilter) {
  const isActive = activeFilter === value ? 'active' : '';
  return (
    `<span class="chip filter ${isActive}" data-f="${escapeAttr(value)}">` +
    `${escapeHtml(label)}</span>`
  );
}

/* ===================== Collect / refresh ===================== */

async function refreshAllKeywords() {
  const keywords = storage.getKeywords();
  if (!keywords.length) {
    showToast('먼저 키워드를 추가하세요');
    return;
  }

  await withButtonLoading(query('#btnUpdate'), LOADING_LABEL, async () => {
    const { addedCount, failedKeywords } = await collectForAllKeywords(keywords);
    renderResults();
    renderStatusBanner();

    if (failedKeywords.length) {
      showToast(
        `수집 완료 · 신규 ${addedCount}건 · 실패 키워드: ${failedKeywords.join(', ')}`
      );
    } else {
      showToast(`수집 완료 · 신규 ${addedCount}건`);
    }
  });
}

/* ===================== Results list ===================== */

function renderResults() {
  const resultsEl = query('#results');
  const articlesById = storage.getArticles();
  const articles = selectArticles(articlesById, storage.getFilter());

  query('#btnClear').hidden = Object.keys(articlesById).length === 0;
  query('#statMeta').textContent = articles.length
    ? `총 ${articles.length.toLocaleString()}건`
    : '';

  if (!articles.length) {
    resultsEl.innerHTML = emptyResultsHtml();
    return;
  }

  const periods = groupByPeriod(articles, viewMode);
  resultsEl.innerHTML = periods
    .map(([periodKey, items]) => periodSectionHtml(periodKey, items))
    .join('');
}

function emptyResultsHtml() {
  return (
    `<div class="empty-state"><div class="big">표시할 뉴스가 없습니다</div>` +
    `상단의 <b>↻ 업데이트</b> 버튼을 눌러 네이버 뉴스를 수집하세요.</div>`
  );
}

function periodSectionHtml(periodKey, items) {
  const label = viewMode === 'month' ? formatMonthLabel(periodKey) : formatDayLabel(periodKey);
  let bodyHtml = '';

  if (viewMode === 'month') {
    bodyHtml = nestByDay(items)
      .map(
        ([dayKey, dayItems]) =>
          `<div class="day-sub">${formatDayLabel(dayKey)} · ${dayItems.length}건</div>` +
          dayItems.map(articleCardHtml).join('')
      )
      .join('');
  } else {
    bodyHtml = items.map(articleCardHtml).join('');
  }

  return (
    `<div class="period">` +
    `<div class="period-head"><span class="label">${label}</span>` +
    `<span class="count">${items.length}건</span></div>` +
    bodyHtml +
    `</div>`
  );
}

function articleCardHtml(article) {
  const publishedAt = parseDate(article.pubDate);
  const description = article.description
    ? `<div class="a-desc">${escapeHtml(article.description)}</div>`
    : '';
  const sourceTag = article.source
    ? `<span class="tag">${escapeHtml(article.source)}</span>`
    : '';
  // Links are sanitized on write/read in storage; only re-check if non-empty
  // and not already an http(s) absolute URL (cheap prefix test before URL()).
  const rawLink = article.link || '';
  const href =
    rawLink.startsWith('https://') || rawLink.startsWith('http://')
      ? rawLink
      : safeHttpUrl(rawLink);
  const titleHtml = escapeHtml(article.title);
  const titleNode = href
    ? `<a class="a-title" href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${titleHtml}</a>`
    : `<span class="a-title">${titleHtml}</span>`;

  return (
    `<div class="article">` +
    titleNode +
    description +
    `<div class="a-foot">` +
    `<span class="tag kw">${escapeHtml(article.keyword)}</span>` +
    sourceTag +
    `<span class="a-time">${toDayKey(publishedAt)} ${formatClockTime(publishedAt)}</span>` +
    `</div></div>`
  );
}

/* ===================== Status banner ===================== */

function renderStatusBanner() {
  const bannerEl = query('#banner');
  const proxyUrl = storage.getProxyUrl();

  if (!proxyUrl) {
    bannerEl.innerHTML =
      `<div class="banner demo">🧪 <div><b>데모 모드입니다.</b> 실제 네이버 뉴스를 수집하려면 ` +
      `<b>⚙ 설정</b>에서 프록시 URL을 입력하세요. (배포 방법: README.md)</div></div>`;
    return;
  }

  const updatedAt = storage.getUpdatedAt();
  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleString('ko-KR')
    : '없음';
  bannerEl.innerHTML =
    `<div class="banner">✅ <div>프록시 연결됨 · 마지막 업데이트: <b>${updatedLabel}</b></div></div>`;
}

/* ===================== Settings modal ===================== */

function openSettingsModal() {
  query('#proxyInput').value = storage.getProxyUrl();
  query('#tokenInput').value = storage.getAccessToken();
  query('#displayInput').value = storage.getDisplayCount();
  query('#modalBg').classList.add('on');
}

function closeSettingsModal() {
  query('#modalBg').classList.remove('on');
}

function saveSettingsModal() {
  const proxyResult = validateProxyBaseUrl(query('#proxyInput').value);
  if (!proxyResult.ok) {
    showToast(proxyResult.reason);
    return;
  }

  let displayCount = parseInt(query('#displayInput').value, 10);
  if (Number.isNaN(displayCount)) displayCount = 50;
  displayCount = Math.max(10, Math.min(100, displayCount));

  storage.setProxyUrl(proxyResult.url);
  storage.setAccessToken(query('#tokenInput').value);
  storage.setDisplayCount(displayCount);
  closeSettingsModal();
  renderStatusBanner();
  showToast(proxyResult.url ? '프록시 저장됨' : '데모 모드로 저장됨');
}

/* ===================== Clear list ===================== */

function clearCollectedArticles() {
  const articleCount = Object.keys(storage.getArticles()).length;
  if (!articleCount) return;

  const confirmed = confirm(
    `수집된 뉴스 ${articleCount.toLocaleString()}건을 전체 목록에서 삭제할까요? 키워드는 유지됩니다.`
  );
  if (!confirmed) return;

  storage.setArticles({});
  storage.setFilter(FILTER_ALL);
  renderFilterChips();
  renderResults();
  showToast(`뉴스 ${articleCount.toLocaleString()}건을 비웠습니다`);
}

/* ===================== Events & boot ===================== */

function bindEvents() {
  query('#kwAdd').onclick = addKeyword;
  query('#kwInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') addKeyword();
  });
  query('#btnUpdate').onclick = refreshAllKeywords;
  query('#btnClear').onclick = clearCollectedArticles;
  query('#btnSettings').onclick = openSettingsModal;
  query('#modalCancel').onclick = closeSettingsModal;
  query('#modalSave').onclick = saveSettingsModal;
  query('#modalBg').addEventListener('click', (event) => {
    if (event.target === query('#modalBg')) closeSettingsModal();
  });

  document.querySelectorAll('.seg button').forEach((segmentButton) => {
    segmentButton.onclick = () => {
      document
        .querySelectorAll('.seg button')
        .forEach((button) => button.classList.remove('active'));
      segmentButton.classList.add('active');
      viewMode = segmentButton.dataset.view;
      renderResults();
    };
  });
}

function boot() {
  bindEvents();
  renderKeywordChips();
  renderResults();
  renderStatusBanner();
}

boot();
