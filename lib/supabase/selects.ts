export const PUBLIC_USER_SELECT = 'id, username, full_name, avatar_url, preferred_position, matches_played, reliability_score, average_level, average_attitude, bio, created_at';

export const MATCH_CARD_SELECT = `
  id,
  title,
  location,
  date_time,
  requested_positions,
  level,
  price_per_player,
  organizer:users(id,full_name,username),
  participants:match_participants(status)
`;
