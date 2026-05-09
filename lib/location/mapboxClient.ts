import { LOCATION_CONFIG } from '@/lib/location/config';
import type { ExternalPlaceResult } from '@/types/location';

const FETCH_TIMEOUT_MS = 8000;

interface MapboxGeocodeFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
    context?: Record<string, any>;
  };
}

function getToken(): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

function isValidCoords(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function readContextValue(context: Record<string, any> | undefined, key: string): string | null {
  const value = context?.[key];
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.name === 'string') return value.name;
  if (typeof value.text === 'string') return value.text;
  return null;
}

function toExternalPlace(feature: MapboxGeocodeFeature): ExternalPlaceResult | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates) return null;
  const [longitude, latitude] = coordinates;
  if (!isValidCoords(latitude, longitude)) return null;

  const properties = feature.properties || {};
  const context = properties.context || {};
  const name = properties.name || properties.full_address || properties.place_formatted || '';
  if (!name) return null;

  return {
    kind: 'external',
    id: properties.mapbox_id || name,
    mapboxId: properties.mapbox_id,
    name,
    address: properties.full_address || properties.place_formatted || null,
    city:
      readContextValue(context, 'place') ||
      readContextValue(context, 'locality') ||
      readContextValue(context, 'district') ||
      '',
    province:
      readContextValue(context, 'region') ||
      readContextValue(context, 'postcode') ||
      null,
    countryCode: 'ES',
    latitude,
    longitude,
    provider: 'mapbox',
    context,
  };
}

const cityCache = new Map<string, ExternalPlaceResult[]>();
const addressCache = new Map<string, ExternalPlaceResult[]>();

export const mapboxClient = {
  async geocodeCities(params: {
    query: string;
    countryCode?: string;
    limit?: number;
  }): Promise<ExternalPlaceResult[]> {
    const token = getToken();
    const query = params.query.trim();
    if (!token || query.length < 2) return [];

    const cacheKey = JSON.stringify({
      query: query.toLowerCase(),
      countryCode: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      limit: params.limit || 8,
    });
    const cached = cityCache.get(cacheKey);
    if (cached) return cached;

    const searchParams = new URLSearchParams({
      q: query,
      access_token: token,
      country: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      language: LOCATION_CONFIG.language,
      types: 'place,locality,district',
      limit: String(params.limit || 8),
    });

    try {
      const url = `https://api.mapbox.com/search/geocode/v6/forward?${searchParams.toString()}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) return [];
      const data = await response.json();
      const features: MapboxGeocodeFeature[] = Array.isArray(data.features) ? data.features : [];
      const results = features
        .map(toExternalPlace)
        .filter((place): place is ExternalPlaceResult => !!place);
      cityCache.set(cacheKey, results);
      return results;
    } catch {
      return [];
    }
  },

  async geocodeAddresses(params: {
    query: string;
    countryCode?: string;
    proximity?: { latitude: number; longitude: number };
    limit?: number;
  }): Promise<ExternalPlaceResult[]> {
    const token = getToken();
    const query = params.query.trim();
    if (!token || query.length < 3) return [];

    const cacheKey = JSON.stringify({
      query: query.toLowerCase(),
      countryCode: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      limit: params.limit || 5,
      proximity: params.proximity || null,
    });
    const cached = addressCache.get(cacheKey);
    if (cached) return cached;

    const searchParams = new URLSearchParams({
      q: query,
      access_token: token,
      country: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      language: LOCATION_CONFIG.language,
      types: 'address,street,place,locality',
      limit: String(params.limit || 5),
    });

    if (params.proximity) {
      searchParams.set('proximity', `${params.proximity.longitude},${params.proximity.latitude}`);
    }

    try {
      const url = `https://api.mapbox.com/search/geocode/v6/forward?${searchParams.toString()}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) return [];
      const data = await response.json();
      const features: MapboxGeocodeFeature[] = Array.isArray(data.features) ? data.features : [];
      const results = features
        .map(toExternalPlace)
        .filter((place): place is ExternalPlaceResult => !!place);
      addressCache.set(cacheKey, results);
      return results;
    } catch {
      return [];
    }
  },

  async reverseCity(params: {
    latitude: number;
    longitude: number;
    countryCode?: string;
  }): Promise<ExternalPlaceResult | null> {
    const token = getToken();
    if (!token || !isValidCoords(params.latitude, params.longitude)) return null;

    const searchParams = new URLSearchParams({
      access_token: token,
      longitude: String(params.longitude),
      latitude: String(params.latitude),
      country: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      language: LOCATION_CONFIG.language,
      types: 'place,locality,district',
      limit: '1',
    });

    try {
      const url = `https://api.mapbox.com/search/geocode/v6/reverse?${searchParams.toString()}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) return null;
      const data = await response.json();
      const feature: MapboxGeocodeFeature | undefined = Array.isArray(data.features)
        ? data.features[0]
        : undefined;
      return feature ? toExternalPlace(feature) : null;
    } catch {
      return null;
    }
  },

  async reverseAddress(params: {
    latitude: number;
    longitude: number;
    countryCode?: string;
  }): Promise<ExternalPlaceResult | null> {
    const token = getToken();
    if (!token || !isValidCoords(params.latitude, params.longitude)) return null;

    const searchParams = new URLSearchParams({
      access_token: token,
      longitude: String(params.longitude),
      latitude: String(params.latitude),
      country: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      language: LOCATION_CONFIG.language,
      types: 'address,street,place,locality',
      limit: '1',
    });

    try {
      const url = `https://api.mapbox.com/search/geocode/v6/reverse?${searchParams.toString()}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) return null;
      const data = await response.json();
      const feature: MapboxGeocodeFeature | undefined = Array.isArray(data.features)
        ? data.features[0]
        : undefined;
      return feature ? toExternalPlace(feature) : null;
    } catch {
      return null;
    }
  },
};
