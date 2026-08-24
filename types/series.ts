import type { Match, RequestedPositions, UserProfile } from '@/types/database';

export interface SeriesVenue {
  canonical_name: string;
  address: string | null;
  city: string;
}

export interface MatchSeries {
  id: string;
  organizer_id: string;
  title: string;
  venue_id: string | null;
  city: string | null;
  automation_mode: 'manual' | 'auto';
  requested_positions: RequestedPositions;
  min_players: number;
  price_per_player: number;
  requires_approval: boolean;
  confirmation_deadline_hours: number;
  auto_publish_if_short: boolean;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  venue?: SeriesVenue | null;
}

export interface SeriesMember {
  id: string;
  series_id: string;
  user_id: string;
  status: 'active' | 'removed';
  created_at: string;
  user?: UserProfile | null;
}

export type SeriesMatch = Match & {
  series_id: string;
  is_private: boolean;
  recruiting_public: boolean;
  confirmation_deadline: string | null;
};
