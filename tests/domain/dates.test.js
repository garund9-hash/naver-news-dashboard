import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  padTwoDigits,
  parseDate,
  toDayKey,
  toMonthKey,
  formatMonthLabel,
  formatDayLabel,
  formatClockTime,
} from '../../src/domain/dates.js';

describe('padTwoDigits', () => {
  it('pads single digits and leaves double digits', () => {
    assert.equal(padTwoDigits(3), '03');
    assert.equal(padTwoDigits(12), '12');
    assert.equal(padTwoDigits(0), '00');
  });
});

describe('parseDate', () => {
  it('parses valid RFC2822 and ISO strings', () => {
    const d = parseDate('Wed, 01 Jan 2025 00:00:00 GMT');
    assert.equal(d.getUTCFullYear(), 2025);
    assert.equal(d.getUTCMonth(), 0);
    assert.equal(d.getUTCDate(), 1);
  });

  it('falls back to a Date instance for invalid input (edge)', () => {
    const before = Date.now();
    const d = parseDate('not-a-date');
    const after = Date.now();
    assert.ok(d instanceof Date);
    assert.ok(d.getTime() >= before - 5 && d.getTime() <= after + 5);
  });
});

describe('toDayKey / toMonthKey', () => {
  it('formats local calendar keys', () => {
    // Construct with local components to avoid UTC/local ambiguity in assertions
    const d = new Date(2025, 2, 5, 15, 7); // March 5, 2025
    assert.equal(toDayKey(d), '2025-03-05');
    assert.equal(toMonthKey(d), '2025-03');
  });
});

describe('formatMonthLabel / formatDayLabel / formatClockTime', () => {
  it('formats Korean month label without leading zero month', () => {
    assert.equal(formatMonthLabel('2025-03'), '2025년 3월');
    assert.equal(formatMonthLabel('2025-12'), '2025년 12월');
  });

  it('formats day label with weekday', () => {
    // 2025-03-15 is a Saturday in local parse of YYYY-MM-DD (implementation-dependent TZ)
    const label = formatDayLabel('2025-03-15');
    assert.match(label, /^3월 15일 \(.+\)$/);
  });

  it('formats clock time with zero padding', () => {
    const d = new Date(2025, 0, 1, 9, 5);
    assert.equal(formatClockTime(d), '09:05');
  });
});
