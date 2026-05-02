import { DEFAULT_COUNTRY_CODE, LOCATION_CONFIG } from '@/lib/location/config';
import { mapboxClient } from '@/lib/location/mapboxClient';
import {
  mergeVenueAndExternalResults,
  searchExternalPlaces,
  searchVenues,
} from '@/lib/location/locationService';
import type { ExternalPlaceResult, LocationQualityStatus } from '@/types/location';

const MAX_QUERY_LENGTH = 100;

export interface GeoResult {
  nombre: string;
  direccion: string;
  ciudad: string;
  lat: number;
  lng: number;
  venueId?: string | null;
  source?: 'venue' | 'external' | 'manual' | 'city';
  qualityStatus?: Exclude<LocationQualityStatus, 'venue_reported'>;
  externalPlace?: ExternalPlaceResult;
}

function toGeoResultFromExternal(place: ExternalPlaceResult): GeoResult {
  return {
    nombre: place.name,
    direccion: place.address || '',
    ciudad: place.city,
    lat: place.latitude,
    lng: place.longitude,
    source: 'external',
    qualityStatus: 'external_unverified',
    externalPlace: place,
  };
}

export async function reverseGeocodeCiudad(lat: number, lng: number): Promise<GeoResult | null> {
  const result = await mapboxClient.reverseCity({
    latitude: lat,
    longitude: lng,
    countryCode: DEFAULT_COUNTRY_CODE,
  });

  if (!result) return null;

  return {
    nombre: result.name,
    direccion: '',
    ciudad: result.city || result.name,
    lat: result.latitude,
    lng: result.longitude,
    source: 'city',
    qualityStatus: 'confirmed',
  };
}

export async function buscarDireccion(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 3) return [];

  const internalResults = await searchVenues({
    query: trimmed,
    countryCode: DEFAULT_COUNTRY_CODE,
    limit: LOCATION_CONFIG.defaultLimit,
  });

  const externalResults =
    internalResults.length >= 3
      ? []
      : await searchExternalPlaces({
          query: trimmed,
          countryCode: DEFAULT_COUNTRY_CODE,
          limit: LOCATION_CONFIG.externalLimit,
        });

  return mergeVenueAndExternalResults(internalResults, externalResults).map((result) => {
    if (result.kind === 'venue') {
      return {
        nombre: result.name,
        direccion: result.address || '',
        ciudad: result.city,
        lat: result.latitude,
        lng: result.longitude,
        venueId: result.id,
        source: 'venue',
        qualityStatus: 'confirmed',
      };
    }

    return toGeoResultFromExternal(result);
  });
}

export async function buscarCiudad(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 2) return [];

  const results = await mapboxClient.searchPlaces({
    query: trimmed,
    countryCode: DEFAULT_COUNTRY_CODE,
    limit: 8,
    types: 'place,locality,district',
  });

  const seen = new Set<string>();
  return results
    .filter((result) => {
      const city = result.city || result.name;
      const key = city.toLowerCase();
      if (!city || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((result) => ({
      nombre: result.city || result.name,
      direccion: '',
      ciudad: result.city || result.name,
      lat: result.latitude,
      lng: result.longitude,
      source: 'city',
      qualityStatus: 'confirmed',
    }));
}
