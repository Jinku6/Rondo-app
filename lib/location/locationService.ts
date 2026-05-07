import { LOCATION_CONFIG } from '@/lib/location/config';
import { mapboxClient } from '@/lib/location/mapboxClient';
import { normalizeVenueQuery } from '@/lib/location/normalizeVenueQuery';
import type {
  DuplicateResolution,
  ExistingVenueResolution,
  ExternalPlaceResult,
  LocationSearchResult,
  VenueSearchResult,
  SelectedVenueLocation,
  Venue,
  VenueReportReason,
} from '@/types/location';
import type { MapboxPlaceSuggestion } from '@/lib/location/mapboxClient';

type VenueRow = Omit<Venue, 'aliases'> & {
  venue_aliases?: { alias: string; normalized_alias: string }[];
};

async function getSupabase() {
  const module = await import('@/lib/supabase');
  return module.supabase;
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

function toVenue(row: VenueRow): Venue {
  return {
    ...row,
    aliases: row.venue_aliases?.map((alias) => alias.normalized_alias) || [],
  };
}

function toVenueSearchResult(venue: Venue): VenueSearchResult {
  return {
    kind: 'venue',
    id: venue.id,
    name: venue.canonical_name,
    address: venue.address,
    city: venue.city,
    province: venue.province,
    countryCode: venue.country_code,
    latitude: venue.latitude,
    longitude: venue.longitude,
    verificationStatus: venue.verification_status,
    timesUsed: venue.times_used,
    source: 'rondo',
    venue,
  };
}

function verificationRank(status: Venue['verification_status']): number {
  if (status === 'rondo_verified') return 0;
  if (status === 'community_verified') return 1;
  if (status === 'unverified') return 2;
  return 3;
}

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const earthRadiusMeters = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function textSimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeVenueQuery(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizeVenueQuery(right).split(' ').filter(Boolean));
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }

  return overlap / Math.max(leftTokens.size, rightTokens.size);
}

function bestNameSimilarity(name: string, venue: Venue): number {
  const candidates = [venue.normalized_name, ...(venue.aliases || [])];
  return Math.max(...candidates.map((candidate) => textSimilarity(name, candidate)));
}

function getSearchTokens(normalized: string): string[] {
  const stopwords = new Set([
    'campo',
    'futbol',
    'football',
    'de',
    'del',
    'la',
    'las',
    'el',
    'los',
    'municipal',
    'polideportivo',
    'club',
    'cd',
    'cf',
    'id',
    'i',
    'd',
    'c',
  ]);

  const meaningfulTokens = normalized
    .split(' ')
    .filter((token) => token.length >= 2 && !stopwords.has(token));

  return meaningfulTokens.length > 0
    ? meaningfulTokens
    : normalized.split(' ').filter((token) => token.length >= 2);
}

export function mergeVenueAndExternalResults(
  venues: VenueSearchResult[],
  externalPlaces: ExternalPlaceResult[]
): LocationSearchResult[] {
  return [...venues, ...externalPlaces];
}

export function findPotentialDuplicateVenueFromCandidates(
  input: { name: string; latitude: number; longitude: number },
  candidates: Venue[]
): DuplicateResolution {
  const normalizedInput = normalizeVenueQuery(input.name);
  let best: DuplicateResolution = {
    action: 'create_new',
    venue: null,
    distanceMeters: null,
    nameSimilarity: 0,
  };

  for (const venue of candidates) {
    const distance = distanceMeters(input, venue);
    const similarity = bestNameSimilarity(input.name, venue);

    if (
      distance < LOCATION_CONFIG.strongDuplicateDistanceMeters &&
      similarity >= 0.75 &&
      similarity >= best.nameSimilarity
    ) {
      best = {
        action: 'use_existing',
        venue,
        distanceMeters: distance,
        nameSimilarity: similarity,
      };
      continue;
    }

    if (
      distance < LOCATION_CONFIG.strongDuplicateDistanceMeters &&
      similarity < 0.75 &&
      normalizedInput.length > 2 &&
      !venue.aliases?.includes(normalizedInput)
    ) {
      best = {
        action: 'add_alias',
        venue,
        distanceMeters: distance,
        nameSimilarity: similarity,
        aliasToAdd: normalizedInput,
      };
      continue;
    }

    if (
      distance <= LOCATION_CONFIG.probableDuplicateDistanceMeters &&
      similarity >= 0.4 &&
      best.action === 'create_new'
    ) {
      best = {
        action: 'suggest_existing',
        venue,
        distanceMeters: distance,
        nameSimilarity: similarity,
      };
    }
  }

  return best;
}

export async function searchVenues(params: {
  query: string;
  countryCode?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  limit?: number;
}): Promise<VenueSearchResult[]> {
  const normalized = normalizeVenueQuery(params.query);
  if (normalized.length < 2) return [];

  const countryCode = params.countryCode || LOCATION_CONFIG.defaultCountryCode;
  const limit = params.limit || LOCATION_CONFIG.defaultLimit;
  const tokens = getSearchTokens(normalized).slice(0, 5);

  try {
    const supabase = await getSupabase();
    const nameQueries = [
      supabase
        .from('venues')
        .select('*, venue_aliases(alias, normalized_alias)')
        .eq('country_code', countryCode)
        .neq('verification_status', 'rejected')
        .ilike('normalized_name', `%${normalized}%`)
        .limit(limit),
      ...tokens.map((token) =>
        supabase
          .from('venues')
          .select('*, venue_aliases(alias, normalized_alias)')
          .eq('country_code', countryCode)
          .neq('verification_status', 'rejected')
          .ilike('normalized_name', `%${token}%`)
          .limit(limit)
      ),
    ];

    const aliasQueries = [
      supabase
        .from('venue_aliases')
        .select('venue:venues(*, venue_aliases(alias, normalized_alias))')
        .ilike('normalized_alias', `%${normalized}%`)
        .limit(limit),
      ...tokens.map((token) =>
        supabase
          .from('venue_aliases')
          .select('venue:venues(*, venue_aliases(alias, normalized_alias))')
          .ilike('normalized_alias', `%${token}%`)
          .limit(limit)
      ),
    ];

    const [nameResults, aliasResults] = await Promise.all([
      Promise.all(nameQueries),
      Promise.all(aliasQueries),
    ]);

    const byId = new Map<string, Venue>();

    for (const result of nameResults) {
      for (const row of (result.data || []) as VenueRow[]) {
        byId.set(row.id, toVenue(row));
      }
    }

    for (const result of aliasResults) {
      for (const row of (result.data || []) as any[]) {
        const venueRow = row.venue as VenueRow | null;
        if (venueRow && venueRow.country_code === countryCode && venueRow.verification_status !== 'rejected') {
          byId.set(venueRow.id, toVenue(venueRow));
        }
      }
    }

    return [...byId.values()]
      .sort((left, right) => {
        const rankDiff = verificationRank(left.verification_status) - verificationRank(right.verification_status);
        if (rankDiff !== 0) return rankDiff;
        if (right.times_used !== left.times_used) return right.times_used - left.times_used;
        return bestNameSimilarity(params.query, right) - bestNameSimilarity(params.query, left);
      })
      .slice(0, limit)
      .map(toVenueSearchResult);
  } catch {
    return [];
  }
}

export async function searchExternalPlaces(params: {
  query: string;
  countryCode?: string;
  proximity?: { latitude: number; longitude: number };
  limit?: number;
  sessionToken?: string;
  mapboxId?: string;
}): Promise<ExternalPlaceResult[]> {
  try {
    if (params.mapboxId) {
      const place = await mapboxClient.retrievePlace({
        mapboxId: params.mapboxId,
        sessionToken: params.sessionToken,
      });
      return place ? [place] : [];
    }
    return await mapboxClient.searchPlaces(params);
  } catch {
    return [];
  }
}

export async function searchExternalPlaceSuggestions(params: {
  query: string;
  countryCode?: string;
  proximity?: { latitude: number; longitude: number };
  limit?: number;
  sessionToken?: string;
}): Promise<MapboxPlaceSuggestion[]> {
  try {
    return await mapboxClient.suggestPlaces(params);
  } catch {
    return [];
  }
}

export async function findPotentialDuplicateVenue(input: {
  name: string;
  countryCode?: string;
  city?: string;
  latitude: number;
  longitude: number;
}): Promise<DuplicateResolution> {
  if (!isValidCoords(input.latitude, input.longitude)) {
    return { action: 'create_new', venue: null, distanceMeters: null, nameSimilarity: 0 };
  }

  try {
    const supabase = await getSupabase();
    const { data } = await supabase
      .from('venues')
      .select('*, venue_aliases(alias, normalized_alias)')
      .eq('country_code', input.countryCode || LOCATION_CONFIG.defaultCountryCode)
      .neq('verification_status', 'rejected')
      .limit(30);

    return findPotentialDuplicateVenueFromCandidates(
      { name: input.name, latitude: input.latitude, longitude: input.longitude },
      ((data || []) as VenueRow[]).map(toVenue)
    );
  } catch {
    return { action: 'create_new', venue: null, distanceMeters: null, nameSimilarity: 0 };
  }
}

async function createAliasIfNeeded(venueId: string, alias: string, source: 'user_search' | 'mapbox' | 'admin' | 'import') {
  const normalizedAlias = normalizeVenueQuery(alias);
  if (normalizedAlias.length < 2) return;

  try {
    const supabase = await getSupabase();
    await supabase.from('venue_aliases').upsert(
      {
        venue_id: venueId,
        alias,
        normalized_alias: normalizedAlias,
        source,
      },
      { onConflict: 'venue_id,normalized_alias', ignoreDuplicates: true }
    );
  } catch {
    // Alias creation should not block venue selection.
  }
}

export async function resolveExternalPlace(params: {
  externalPlace: ExternalPlaceResult;
  createdBy: string;
}): Promise<Venue | ExistingVenueResolution> {
  const place = params.externalPlace;
  const duplicate = await findPotentialDuplicateVenue({
    name: place.name,
    countryCode: place.countryCode,
    city: place.city,
    latitude: place.latitude,
    longitude: place.longitude,
  });

  if (duplicate.venue && duplicate.action !== 'create_new') {
    if (duplicate.action === 'add_alias') {
      await createAliasIfNeeded(duplicate.venue.id, place.name, 'mapbox');
    }
    return { kind: 'existing', venue: duplicate.venue, duplicateResolution: duplicate };
  }

  const normalizedName = normalizeVenueQuery(place.name);
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('venues')
    .insert({
      canonical_name: place.name,
      normalized_name: normalizedName,
      address: place.address,
      city: place.city || 'Sin ciudad',
      province: place.province,
      country_code: place.countryCode || LOCATION_CONFIG.defaultCountryCode,
      latitude: place.latitude,
      longitude: place.longitude,
      source: 'mapbox',
      provider: 'mapbox',
      provider_place_id: place.mapboxId || place.id,
      verification_status: 'unverified',
      confidence_score: 0.55,
      created_by: params.createdBy,
    })
    .select('*, venue_aliases(alias, normalized_alias)')
    .single();

  if (error) throw error;
  const venue = toVenue(data as VenueRow);
  await createAliasIfNeeded(venue.id, place.name, 'mapbox');
  return venue;
}

export async function createManualVenue(params: {
  name: string;
  countryCode?: string;
  city: string;
  province?: string;
  address?: string;
  latitude: number;
  longitude: number;
  createdBy: string;
}): Promise<Venue | ExistingVenueResolution> {
  if (!isValidCoords(params.latitude, params.longitude)) {
    throw new Error('Coordenadas no válidas');
  }

  const duplicate = await findPotentialDuplicateVenue({
    name: params.name,
    countryCode: params.countryCode,
    city: params.city,
    latitude: params.latitude,
    longitude: params.longitude,
  });

  if (duplicate.venue && duplicate.action !== 'create_new') {
    if (duplicate.action === 'add_alias') {
      await createAliasIfNeeded(duplicate.venue.id, params.name, 'user_search');
    }
    return { kind: 'existing', venue: duplicate.venue, duplicateResolution: duplicate };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('venues')
    .insert({
      canonical_name: params.name,
      normalized_name: normalizeVenueQuery(params.name),
      address: params.address || null,
      city: params.city,
      province: params.province || null,
      country_code: params.countryCode || LOCATION_CONFIG.defaultCountryCode,
      latitude: params.latitude,
      longitude: params.longitude,
      source: 'manual',
      provider: 'manual',
      verification_status: 'unverified',
      confidence_score: 0.4,
      created_by: params.createdBy,
    })
    .select('*, venue_aliases(alias, normalized_alias)')
    .single();

  if (error) throw error;
  return toVenue(data as VenueRow);
}

export async function linkVenueToMatch(params: {
  matchId: string;
  venueId: string;
  snapshot: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    qualityStatus: 'confirmed' | 'user_adjusted' | 'external_unverified';
  };
}): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('matches')
    .update({
      venue_id: params.venueId,
      location_name_snapshot: params.snapshot.name,
      address_snapshot: params.snapshot.address || null,
      latitude_snapshot: params.snapshot.latitude,
      longitude_snapshot: params.snapshot.longitude,
      location_quality_status: params.snapshot.qualityStatus,
    })
    .eq('id', params.matchId);

  if (error) throw error;
}

export async function reportVenueIssue(params: {
  venueId: string;
  reportedBy?: string;
  reason: VenueReportReason;
  suggestedName?: string;
  suggestedLatitude?: number;
  suggestedLongitude?: number;
  suggestedAddress?: string;
}): Promise<void> {
  const supabase = await getSupabase();
  const { error } = await supabase.from('venue_reports').insert({
    venue_id: params.venueId,
    reported_by: params.reportedBy || null,
    reason: params.reason,
    suggested_name: params.suggestedName || null,
    suggested_latitude: params.suggestedLatitude || null,
    suggested_longitude: params.suggestedLongitude || null,
    suggested_address: params.suggestedAddress || null,
  });

  if (error) throw error;
}

export function venueToSelectedLocation(
  venue: Venue,
  overrides?: { latitude?: number; longitude?: number; qualityStatus?: SelectedVenueLocation['qualityStatus'] }
): SelectedVenueLocation {
  return {
    venueId: venue.id,
    name: venue.canonical_name,
    address: venue.address,
    city: venue.city,
    latitude: overrides?.latitude ?? venue.latitude,
    longitude: overrides?.longitude ?? venue.longitude,
    qualityStatus: overrides?.qualityStatus || 'confirmed',
    source: 'venue',
  };
}
