import { describe, expect, it } from 'vitest';

import {
  formatMatchDate,
  formatMatchDateInput,
  formatMatchTime,
  formatMatchTimeInput,
  normalizeMatchTimeInput,
  parseMatchDateTime,
} from '../matchDateTime';

describe('match date and time helpers', () => {
  it('formats typed date and time values', () => {
    expect(formatMatchDateInput('29082026')).toBe('29/08/2026');
    expect(formatMatchDateInput('29a08')).toBe('29/08');
    expect(formatMatchTimeInput('2130')).toBe('21:30');
    expect(normalizeMatchTimeInput('9')).toBe('09:00');
    expect(normalizeMatchTimeInput('930')).toBe('9:30');
  });

  it('formats picker values using local calendar fields', () => {
    const value = new Date(2026, 7, 29, 21, 5);
    expect(formatMatchDate(value)).toBe('29/08/2026');
    expect(formatMatchTime(value)).toBe('21:05');
  });

  it('parses valid values and rejects invalid calendar dates', () => {
    const value = parseMatchDateTime('29/08/2026', '21:30');
    expect(value?.getFullYear()).toBe(2026);
    expect(value?.getMonth()).toBe(7);
    expect(value?.getDate()).toBe(29);
    expect(value?.getHours()).toBe(21);
    expect(value?.getMinutes()).toBe(30);
    expect(parseMatchDateTime('31/02/2026', '21:30')).toBeNull();
    expect(parseMatchDateTime('29/08/26', '21:30')).toBeNull();
  });
});
