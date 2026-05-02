import { describe, expect, it } from 'vitest';
import { buildAvailableDirectionsOptions, buildDirectionsOptions, buildDirectionsUrl } from '../openDirections';

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

  it('builds app-specific directions options', () => {
    expect(
      buildDirectionsOptions({
        latitude: 36.84,
        longitude: -2.46,
        label: 'Campo El Pavia',
        platform: 'ios',
      }).map((option) => option.id)
    ).toEqual(['google_maps', 'waze', 'apple_maps']);

    expect(
      buildDirectionsOptions({
        latitude: 36.84,
        longitude: -2.46,
        label: 'Campo El Pavia',
        platform: 'android',
      }).map((option) => option.id)
    ).toEqual(['google_maps', 'waze', 'system_maps']);
  });

  it('filters directions options to installed apps', async () => {
    const options = buildDirectionsOptions({
      latitude: 36.84,
      longitude: -2.46,
      label: 'Campo El Pavia',
      platform: 'ios',
    });

    const available = await buildAvailableDirectionsOptions(options, async (url) => {
      return url.startsWith('comgooglemaps://') || url.startsWith('maps://');
    });

    expect(available.map((option) => option.id)).toEqual(['google_maps', 'apple_maps']);
  });

  it('keeps fallback system maps when no third-party app is installed', async () => {
    const options = buildDirectionsOptions({
      latitude: 36.84,
      longitude: -2.46,
      label: 'Campo El Pavia',
      platform: 'android',
    });

    const available = await buildAvailableDirectionsOptions(options, async (url) => {
      return url.startsWith('geo:');
    });

    expect(available.map((option) => option.id)).toEqual(['system_maps']);
  });
});
