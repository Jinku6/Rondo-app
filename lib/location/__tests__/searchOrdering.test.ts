import { describe, expect, it } from 'vitest';
import type { ExternalPlaceResult, VenueSearchResult } from '@/types/location';
import { DEFAULT_COUNTRY_CODE, LOCATION_CONFIG } from '../config';
import { mergeVenueAndExternalResults } from '../locationService';

describe('location search ordering', () => {
  it('keeps internal venue results before external results', () => {
    const internal: VenueSearchResult[] = [
      {
        kind: 'venue',
        id: 'venue-1',
        name: 'Campo Rondo',
        address: null,
        city: 'Almeria',
        province: null,
        countryCode: 'ES',
        latitude: 36.84,
        longitude: -2.46,
        verificationStatus: 'rondo_verified',
        timesUsed: 3,
        source: 'rondo',
        venue: null,
      },
    ];
    const external: ExternalPlaceResult[] = [
      {
        kind: 'external',
        id: 'mapbox-1',
        name: 'Campo Mapbox',
        address: 'Avenida Sur',
        city: 'Almeria',
        province: 'Almeria',
        countryCode: 'ES',
        latitude: 36.85,
        longitude: -2.47,
        provider: 'mapbox',
      },
    ];

    expect(mergeVenueAndExternalResults(internal, external).map((item) => item.kind)).toEqual([
      'venue',
      'external',
    ]);
  });

  it('defaults location searches to Spain and keeps countries configurable', () => {
    expect(DEFAULT_COUNTRY_CODE).toBe('ES');
    expect(LOCATION_CONFIG.supportedCountries).toContain('ES');
  });
});
