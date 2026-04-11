// Tipos principales de la base de datos

export type PreferredPosition = 'portero' | 'defensa' | 'mediocentro' | 'delantero';

export type MatchLevel = 'tranquilo' | 'medio' | 'competitivo';

export type MatchStatus = 'open' | 'full' | 'completed' | 'cancelled';

export type ParticipantStatus = 'pending' | 'approved' | 'joined' | 'rejected' | 'dropped';

export type PositionKey = 'portero' | 'defensa' | 'mediocentro' | 'delantero' | 'cualquiera';

export type RequestedPositions = Record<PositionKey, number>;

export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  preferred_position: PreferredPosition | null;
  matches_played: number;
  reliability_score: number;
  average_level: number;
  average_attitude: number;
  created_at: string;
}

export interface UserPrivateData {
  user_id: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  organizer_id: string;
  title: string;
  location: string;
  location_lat: number | null;
  location_lng: number | null;
  location_city: string | null;
  date_time: string;
  requested_positions: RequestedPositions;
  team_a_color: string | null;
  team_b_color: string | null;
  level: MatchLevel;
  description: string;
  price_per_player: number;
  requires_approval: boolean;
  status: MatchStatus;
  created_at: string;
  // Joins opcionales
  organizer?: UserProfile;
  participants?: MatchParticipant[];
  participant_count?: number;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  status: ParticipantStatus;
  attended: boolean | null;
  joined_at: string;
  // Join opcional
  user?: UserProfile;
}

export interface MatchReview {
  id: string;
  match_id: string;
  reviewer_id: string;
  reviewee_id: string;
  level_rating: number | null;
  attitude_rating: number | null;
  attitude: 'positive' | 'neutral' | 'negative' | null;
  attended: boolean;
  created_at: string;
}

export type NotificationType = 'pending_organizer_review' | 'pending_player_review';

export interface Notification {
  id: string;
  user_id: string;
  match_id: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
  // Join opcional
  match?: { title: string } | null;
}

export interface ChatMessage {
  id: string;
  match_id: string;
  player_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  // Join opcional
  sender?: UserProfile;
}

