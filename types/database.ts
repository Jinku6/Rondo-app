// Tipos principales de la base de datos

export type PreferredPosition = 'portero' | 'defensa' | 'mediocentro' | 'delantero';

export type MatchStatus = 'open' | 'full' | 'completed' | 'cancelled';

export type ParticipantStatus = 'pending' | 'approved' | 'joined' | 'rejected' | 'dropped';

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

export interface Match {
  id: string;
  organizer_id: string;
  title: string;
  location: string;
  date_time: string;
  requested_positions: {
    portero: number;
    defensa: number;
    mediocentro: number;
    delantero: number;
    cualquiera: number;
  };
  team_a_color: string | null;
  team_b_color: string | null;
  level: 'tranquilo' | 'medio' | 'competitivo';
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
  level_rating: number;
  attitude_rating: number;
  created_at: string;
}
