import { LOCATION_CONFIG } from '@/lib/location/config';
import type { ExternalPlaceResult } from '@/types/location';

const MAPBOX_SEARCHBOX_URL = 'https://api.mapbox.com/search/searchbox/v1';
const FETCH_TIMEOUT_MS = 8000;

interface MapboxSuggestion {
  mapbox_id?: string;
  name?: string;
  full_address?: string;
  place_formatted?: string;
  context?: Record<string, any>;
}

interface MapboxRetrieveFeature {
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

function toExternalPlace(feature: MapboxRetrieveFeature, fallback: MapboxSuggestion): ExternalPlaceResult | null {
  const coordinates = feature.geometry?.coordinates;
  if (!coordinates) return null;
  const [longitude, latitude] = coordinates;
  if (!isValidCoords(latitude, longitude)) return null;

  const properties = feature.properties || {};
  const context = properties.context || fallback.context || {};
  const name = properties.name || fallback.name || properties.full_address || fallback.full_address || '';
  if (!name) return null;

  return {
    kind: 'external',
    id: properties.mapbox_id || fallback.mapbox_id || name,
    mapboxId: properties.mapbox_id || fallback.mapbox_id,
    name,
    address:
      properties.full_address ||
      fallback.full_address ||
      properties.place_formatted ||
      fallback.place_formatted ||
      null,
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

export const mapboxClient = {
  async searchPlaces(params: {
    query: string;
    countryCode?: string;
    proximity?: { latitude: number; longitude: number };
    limit?: number;
    sessionToken?: string;
    types?: string;
  }): Promise<ExternalPlaceResult[]> {
    const token = getToken();
    const query = params.query.trim();
    if (!token || query.length < 2) return [];

    const searchParams = new URLSearchParams({
      q: query,
      access_token: token,
      session_token: params.sessionToken || `rondo-${Date.now()}`,
      country: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      language: LOCATION_CONFIG.language,
      limit: String(params.limit || LOCATION_CONFIG.externalLimit),
      types: params.types || 'poi,address,place,locality',
    });

    if (params.proximity) {
      searchParams.set('proximity', `${params.proximity.longitude},${params.proximity.latitude}`);
    }

    try {
      const suggestUrl = `${MAPBOX_SEARCHBOX_URL}/suggest?${searchParams.toString()}`;
      const suggestResponse = await fetchWithTimeout(suggestUrl);
      if (!suggestResponse.ok) return [];
      const suggestData = await suggestResponse.json();
      const suggestions: MapboxSuggestion[] = Array.isArray(suggestData.suggestions)
        ? suggestData.suggestions
        : [];

      const places = await Promise.all(
        suggestions.slice(0, params.limit || LOCATION_CONFIG.externalLimit).map(async (suggestion) => {
          if (!suggestion.mapbox_id) return null;
          return this.retrievePlace({
            mapboxId: suggestion.mapbox_id,
            sessionToken: searchParams.get('session_token') || undefined,
            fallback: suggestion,
          });
        })
      );

      return places.filter((place): place is ExternalPlaceResult => !!place);
    } catch {
      return [];
    }
  },

  async retrievePlace(params: {
    mapboxId: string;
    sessionToken?: string;
    fallback?: MapboxSuggestion;
  }): Promise<ExternalPlaceResult | null> {
    const token = getToken();
    if (!token) return null;

    const searchParams = new URLSearchParams({
      access_token: token,
      session_token: params.sessionToken || `rondo-${Date.now()}`,
    });

    try {
      const url = `${MAPBOX_SEARCHBOX_URL}/retrieve/${encodeURIComponent(params.mapboxId)}?${searchParams.toString()}`;
      const response = await fetchWithTimeout(url);
      if (!response.ok) return null;
      const data = await response.json();
      const feature: MapboxRetrieveFeature | undefined = Array.isArray(data.features)
        ? data.features[0]
        : undefined;
      if (!feature) return null;
      return toExternalPlace(feature, params.fallback || {});
    } catch {
      return null;
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
      const feature: MapboxRetrieveFeature | undefined = Array.isArray(data.features)
        ? data.features[0]
        : undefined;
      if (!feature) return null;
      return toExternalPlace(feature, {});
    } catch {
      return null;
    }
  },
};
