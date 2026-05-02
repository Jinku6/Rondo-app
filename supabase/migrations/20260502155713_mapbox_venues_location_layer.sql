CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL,
  province TEXT,
  region TEXT,
  country_code TEXT NOT NULL DEFAULT 'ES',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geography_point GEOGRAPHY(Point, 4326)
    GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography) STORED,
  source TEXT NOT NULL DEFAULT 'manual',
  provider TEXT,
  provider_place_id TEXT,
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.40,
  times_used INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT venues_country_code_uppercase CHECK (country_code = upper(country_code) AND length(country_code) = 2),
  CONSTRAINT venues_latitude_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT venues_longitude_range CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT venues_source_check CHECK (source IN ('rondo', 'mapbox', 'manual', 'import')),
  CONSTRAINT venues_provider_check CHECK (provider IS NULL OR provider IN ('mapbox', 'nominatim', 'manual', 'admin')),
  CONSTRAINT venues_verification_status_check CHECK (
    verification_status IN ('unverified', 'community_verified', 'rondo_verified', 'rejected')
  ),
  CONSTRAINT venues_confidence_score_range CHECK (confidence_score BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS public.venue_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user_search',
  times_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT venue_aliases_source_check CHECK (source IN ('user_search', 'mapbox', 'admin', 'import')),
  CONSTRAINT venue_aliases_unique_normalized UNIQUE (venue_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS public.venue_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  suggested_name TEXT,
  suggested_latitude DOUBLE PRECISION,
  suggested_longitude DOUBLE PRECISION,
  suggested_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT venue_reports_reason_check CHECK (
    reason IN ('wrong_pin', 'wrong_name', 'not_same_place', 'closed', 'duplicate', 'other')
  ),
  CONSTRAINT venue_reports_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT venue_reports_suggested_latitude_range CHECK (
    suggested_latitude IS NULL OR suggested_latitude BETWEEN -90 AND 90
  ),
  CONSTRAINT venue_reports_suggested_longitude_range CHECK (
    suggested_longitude IS NULL OR suggested_longitude BETWEEN -180 AND 180
  )
);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS address_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS latitude_snapshot DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude_snapshot DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_quality_status TEXT DEFAULT 'confirmed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'matches_location_quality_status_check'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_location_quality_status_check
      CHECK (
        location_quality_status IN (
          'confirmed',
          'user_adjusted',
          'external_unverified',
          'venue_reported'
        )
      );
  END IF;
END;
$$;

UPDATE public.matches
SET
  location_name_snapshot = COALESCE(location_name_snapshot, location),
  latitude_snapshot = COALESCE(latitude_snapshot, location_lat),
  longitude_snapshot = COALESCE(longitude_snapshot, location_lng),
  location_quality_status = COALESCE(location_quality_status, 'confirmed')
WHERE location_name_snapshot IS NULL
   OR latitude_snapshot IS NULL
   OR longitude_snapshot IS NULL
   OR location_quality_status IS NULL;

CREATE INDEX IF NOT EXISTS venues_normalized_name_trgm_idx
  ON public.venues USING GIN (normalized_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS venue_aliases_normalized_alias_trgm_idx
  ON public.venue_aliases USING GIN (normalized_alias gin_trgm_ops);

CREATE INDEX IF NOT EXISTS venues_geography_point_idx
  ON public.venues USING GIST (geography_point);

CREATE INDEX IF NOT EXISTS venues_country_city_idx ON public.venues(country_code, city);
CREATE INDEX IF NOT EXISTS venues_times_used_idx ON public.venues(times_used DESC);
CREATE INDEX IF NOT EXISTS venues_verification_status_idx ON public.venues(verification_status);
CREATE INDEX IF NOT EXISTS venues_provider_place_idx ON public.venues(provider, provider_place_id);
CREATE INDEX IF NOT EXISTS matches_venue_id_idx ON public.matches(venue_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_venues_updated_at ON public.venues;
CREATE TRIGGER set_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.increment_venue_usage_from_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF NEW.venue_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.venue_id IS DISTINCT FROM OLD.venue_id) THEN
    UPDATE public.venues
    SET times_used = times_used + 1,
        last_used_at = now()
    WHERE id = NEW.venue_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_venue_usage ON public.matches;
CREATE TRIGGER on_match_venue_usage
  AFTER INSERT OR UPDATE OF venue_id ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_venue_usage_from_match();

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "venues_authenticated_read" ON public.venues;
CREATE POLICY "venues_authenticated_read"
  ON public.venues
  FOR SELECT
  TO authenticated
  USING (verification_status <> 'rejected');

DROP POLICY IF EXISTS "venues_authenticated_insert" ON public.venues;
CREATE POLICY "venues_authenticated_insert"
  ON public.venues
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "venue_aliases_authenticated_read" ON public.venue_aliases;
CREATE POLICY "venue_aliases_authenticated_read"
  ON public.venue_aliases
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "venue_aliases_authenticated_insert" ON public.venue_aliases;
CREATE POLICY "venue_aliases_authenticated_insert"
  ON public.venue_aliases
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.venues v
      WHERE v.id = venue_id
        AND v.verification_status <> 'rejected'
    )
  );

DROP POLICY IF EXISTS "venue_reports_owner_read" ON public.venue_reports;
CREATE POLICY "venue_reports_owner_read"
  ON public.venue_reports
  FOR SELECT
  TO authenticated
  USING (reported_by = auth.uid());

DROP POLICY IF EXISTS "venue_reports_authenticated_insert" ON public.venue_reports;
CREATE POLICY "venue_reports_authenticated_insert"
  ON public.venue_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reported_by IS NULL OR reported_by = auth.uid());
