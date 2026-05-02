export type VenueSource = 'rondo' | 'mapbox' | 'manual' | 'import';
export type VenueProvider = 'mapbox' | 'nominatim' | 'manual' | 'admin';
export type VenueVerificationStatus =
  | 'unverified'
  | 'community_verified'
  | 'rondo_verified'
  | 'rejected';
export type VenueReportReason =
  | 'wrong_pin'
  | 'wrong_name'
  | 'not_same_place'
  | 'closed'
  | 'duplicate'
  | 'other';
export type VenueReportStatus = 'pending' | 'approved' | 'rejected';
export type LocationQualityStatus =
  | 'confirmed'
  | 'user_adjusted'
  | 'external_unverified'
  | 'venue_reported';

export interface Venue {
  id: string;
  canonical_name: string;
  normalized_name: string;
  address: string | null;
  city: string;
  province: string | null;
  region: string | null;
  country_code: string;
  latitude: number;
  longitude: number;
  source: VenueSource;
  provider: VenueProvider | null;
  provider_place_id: string | null;
  verification_status: VenueVerificationStatus;
  confidence_score: number;
  times_used: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  aliases?: string[];
}

export interface VenueAlias {
  id: string;
  venue_id: string;
  alias: string;
  normalized_alias: string;
  source: 'user_search' | 'mapbox' | 'admin' | 'import';
  times_used: number;
  created_at: string;
}

export interface VenueReport {
  id: string;
  venue_id: string | null;
  reported_by: string | null;
  reason: VenueReportReason;
  suggested_name: string | null;
  suggested_latitude: number | null;
  suggested_longitude: number | null;
  suggested_address: string | null;
  status: VenueReportStatus;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export interface VenueSearchResult {
  kind: 'venue';
  id: string;
  name: string;
  address: string | null;
  city: string;
  province: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
  verificationStatus: VenueVerificationStatus;
  timesUsed: number;
  source: 'rondo';
  venue: Venue | null;
}

export interface ExternalPlaceResult {
  kind: 'external';
  id: string;
  name: string;
  address: string | null;
  city: string;
  province: string | null;
  countryCode: string;
  latitude: number;
  longitude: number;
  provider: 'mapbox';
  mapboxId?: string;
  context?: Record<string, unknown>;
}

export type LocationSearchResult = VenueSearchResult | ExternalPlaceResult;

export type DuplicateResolutionAction =
  | 'use_existing'
  | 'suggest_existing'
  | 'add_alias'
  | 'create_new';

export interface DuplicateResolution {
  action: DuplicateResolutionAction;
  venue: Venue | null;
  distanceMeters: number | null;
  nameSimilarity: number;
  aliasToAdd?: string;
}

export interface ExistingVenueResolution {
  kind: 'existing';
  venue: Venue;
  duplicateResolution: DuplicateResolution;
}

export interface SelectedVenueLocation {
  venueId: string | null;
  name: string;
  address?: string | null;
  city: string | null;
  latitude: number;
  longitude: number;
  qualityStatus: Exclude<LocationQualityStatus, 'venue_reported'>;
  source: 'venue' | 'external' | 'manual';
}
