import { describe, expect, it } from 'vitest';
import type { Venue } from '@/types/location';
import { findPotentialDuplicateVenueFromCandidates } from '../locationService';

const baseVenue: Venue = {
  id: 'venue-1',
  canonical_name: 'Campo El Pavia - Tito Pedro',
  normalized_name: 'campo el pavia tito pedro',
  address: 'Calle Principal',
  city: 'Almeria',
  province: 'Almeria',
  region: 'Andalucia',
  country_code: 'ES',
  latitude: 36.84,
  longitude: -2.46,
  source: 'rondo',
  provider: null,
  provider_place_id: null,
  verification_status: 'community_verified',
  confidence_score: 0.8,
  times_used: 8,
  created_by: null,
  created_at: '2026-05-02T00:00:00.000Z',
  updated_at: '2026-05-02T00:00:00.000Z',
  last_used_at: null,
  aliases: ['tito pedro'],
};

describe('findPotentialDuplicateVenueFromCandidates', () => {
  it('returns existing venue for same name within 150 meters', () => {
    const result = findPotentialDuplicateVenueFromCandidates(
      {
        name: 'Campo El Pavia Tito Pedro',
        latitude: 36.8405,
        longitude: -2.4605,
      },
      [baseVenue]
    );

    expect(result.action).toBe('use_existing');
    expect(result.venue?.id).toBe('venue-1');
  });

  it('adds an alias instead of creating a venue for same coordinates with useful alias', () => {
    const result = findPotentialDuplicateVenueFromCandidates(
      {
        name: 'Municipal Tito Pedro',
        latitude: 36.84001,
        longitude: -2.46001,
      },
      [baseVenue]
    );

    expect(result.action).toBe('add_alias');
    expect(result.aliasToAdd).toBe('municipal tito pedro');
  });

  it('allows creating a new venue for a different name more than 500 meters away', () => {
    const result = findPotentialDuplicateVenueFromCandidates(
      {
        name: 'Campo Nuevo Norte',
        latitude: 36.90,
        longitude: -2.50,
      },
      [baseVenue]
    );

    expect(result.action).toBe('create_new');
  });
});
