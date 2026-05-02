import { describe, expect, it } from 'vitest';
import { normalizeVenueQuery } from '../normalizeVenueQuery';

describe('normalizeVenueQuery', () => {
  it('removes accents, lowercases, and collapses spaces', () => {
    expect(normalizeVenueQuery('  El   Pavía  ')).toBe('el pavia');
  });

  it('replaces irrelevant punctuation with spaces', () => {
    expect(normalizeVenueQuery('Campo Municipal Tito-Pedro (CD Pavía)')).toBe(
      'campo municipal tito pedro cd pavia'
    );
  });
});
