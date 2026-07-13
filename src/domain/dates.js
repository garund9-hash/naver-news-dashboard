/** Date helpers for period keys and Korean display labels. */

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** Zero-pad a number to two digits (e.g. 3 → "03"). */
export function padTwoDigits(value) {
  return value < 10 ? '0' + value : '' + value;
}

/**
 * Parse a publication date string; fall back to "now" if invalid
 * so a bad upstream date never breaks sorting/grouping.
 */
export function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

/** Sortable day key: "YYYY-MM-DD". */
export function toDayKey(date) {
  return (
    date.getFullYear() +
    '-' +
    padTwoDigits(date.getMonth() + 1) +
    '-' +
    padTwoDigits(date.getDate())
  );
}

/** Sortable month key: "YYYY-MM". */
export function toMonthKey(date) {
  return date.getFullYear() + '-' + padTwoDigits(date.getMonth() + 1);
}

/** Human label for a month key, e.g. "2025년 3월". */
export function formatMonthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  return `${year}년 ${parseInt(month, 10)}월`;
}

/** Human label for a day key, e.g. "3월 15일 (토)". */
export function formatDayLabel(dayKey) {
  const [, month, day] = dayKey.split('-');
  const weekday = WEEKDAY_KO[new Date(dayKey).getDay()];
  return `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${weekday})`;
}

/** Clock time "HH:MM" for article footers. */
export function formatClockTime(date) {
  return `${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}`;
}
