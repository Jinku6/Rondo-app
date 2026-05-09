import { DEFAULT_COUNTRY_CODE, LOCATION_CONFIG } from '@/lib/location/config';
import { mapboxClient } from '@/lib/location/mapboxClient';
import {
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

export async function reverseGeocodeDireccion(lat: number, lng: number): Promise<GeoResult | null> {
  const result = await mapboxClient.reverseAddress({
    latitude: lat,
    longitude: lng,
    countryCode: DEFAULT_COUNTRY_CODE,
  });

  if (!result) return null;

  return {
    nombre: result.name,
    direccion: result.address || result.name,
    ciudad: result.city || result.name,
    lat: result.latitude,
    lng: result.longitude,
    source: 'manual',
    qualityStatus: 'confirmed',
  };
}

export async function buscarDireccionTemporal(
  query: string,
  proximity?: { latitude: number; longitude: number }
): Promise<GeoResult[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 3) return [];

  const results = await mapboxClient.geocodeAddresses({
    query: trimmed,
    countryCode: DEFAULT_COUNTRY_CODE,
    proximity,
    limit: 5,
  });

  return results.map((result) => ({
    nombre: result.name,
    direccion: result.address || result.name,
    ciudad: result.city,
    lat: result.latitude,
    lng: result.longitude,
    source: 'manual',
    qualityStatus: 'confirmed',
  }));
}

export async function buscarDireccion(query: string, sessionToken?: string): Promise<GeoSuggestion[]> {
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmed.length < 3) return [];

  const internalResults = await searchVenues({
    query: trimmed,
    countryCode: DEFAULT_COUNTRY_CODE,
    limit: LOCATION_CONFIG.defaultLimit,
  });

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

  return venueSuggestions;
}

export async function resolverDireccion(resultado: GeoSuggestion, sessionToken?: string): Promise<GeoResult | null> {
  if (typeof resultado.lat !== 'number' || typeof resultado.lng !== 'number') return null;
  return {
    ...resultado,
    lat: resultado.lat,
    lng: resultado.lng,
  };
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
