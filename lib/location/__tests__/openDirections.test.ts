import { describe, expect, it } from 'vitest';
import { buildDirectionsUrl } from '../openDirections';

describe('buildDirectionsUrl', () => {
  it('builds the iOS Maps URL with coordinates and label', () => {
    expect(
      buildDirectionsUrl({
        latitude: 36.84,
        longitude: -2.46,
        label: 'Campo El Pavia',
        platform: 'ios',
      })
    ).toBe('maps://?q=Campo%20El%20Pavia&ll=36.84,-2.46');
  });

  it('builds the Android geo URL with coordinates and label', () => {
    expect(
      buildDirectionsUrl({
        latitude: 36.84,
        longitude: -2.46,
        label: 'Campo El Pavia',
        platform: 'android',
      })
    ).toBe('geo:36.84,-2.46?q=36.84,-2.46(Campo%20El%20Pavia)');
  });

  it('builds the universal web fallback URL', () => {
    expect(
      buildDirectionsUrl({
        latitude: 36.84,
        longitude: -2.46,
        label: 'Campo El Pavia',
        platform: 'web',
      })
    ).toBe('https://www.google.com/maps/search/?api=1&query=36.84,-2.46');
  });
});
