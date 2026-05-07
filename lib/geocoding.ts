import { DEFAULT_COUNTRY_CODE, LOCATION_CONFIG } from '@/lib/location/config';
import { mapboxClient } from '@/lib/location/mapboxClient';
import {
  searchExternalPlaceSuggestions,
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

export interface GeoSuggestion extends Omit<GeoResult, 'lat' | 'lng' | 'externalPlace'> {
  lat?: number;
  lng?: number;
  mapboxId?: string;
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

export async function buscarDireccion(query: string, sessionToken?: string): Promise<GeoSuggestion[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 3) return [];

  const internalResults = await searchVenues({
    query: trimmed,
    countryCode: DEFAULT_COUNTRY_CODE,
    limit: LOCATION_CONFIG.defaultLimit,
  });

  const externalResults =
    internalResults.length === 0
      ? await searchExternalPlaceSuggestions({
          query: trimmed,
          countryCode: DEFAULT_COUNTRY_CODE,
          limit: LOCATION_CONFIG.externalLimit,
          sessionToken,
        })
      : [];

  const venueSuggestions: GeoSuggestion[] = internalResults.map((result) => ({
    nombre: result.name,
    direccion: result.address || '',
    ciudad: result.city,
    lat: result.latitude,
    lng: result.longitude,
    venueId: result.id,
    source: 'venue',
    qualityStatus: 'confirmed',
  }));

  const mapboxSuggestions: GeoSuggestion[] = externalResults.map((result) => ({
    nombre: result.name,
    direccion: result.address || '',
    ciudad: result.city,
    source: 'external',
    qualityStatus: 'external_unverified',
    mapboxId: result.mapboxId,
  }));

  return [...venueSuggestions, ...mapboxSuggestions];
}

export async function resolverDireccion(resultado: GeoSuggestion, sessionToken?: string): Promise<GeoResult | null> {
  if (resultado.source !== 'external' || !resultado.mapboxId) {
    if (typeof resultado.lat !== 'number' || typeof resultado.lng !== 'number') return null;
    return {
      ...resultado,
      lat: resultado.lat,
      lng: resultado.lng,
    };
  }

  const externalPlace = await searchExternalPlaces({
    query: resultado.nombre,
    countryCode: DEFAULT_COUNTRY_CODE,
    limit: 1,
    sessionToken,
    mapboxId: resultado.mapboxId,
  });

  const place = externalPlace[0];
  return place ? toGeoResultFromExternal(place) : null;
}

export async function buscarCiudad(query: string): Promise<GeoResult[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 2) return [];

  const results = await mapboxClient.geocodeCities({
    query: trimmed,
    countryCode: DEFAULT_COUNTRY_CODE,
    limit: 8,
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
