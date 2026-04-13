-- ================================================
-- SCHEMA: App de Fútbol MVP
-- Ejecutar en Supabase SQL Editor (en orden)
-- ================================================

-- 1. Tabla de perfiles de usuario (extiende auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  preferred_position TEXT CHECK (preferred_position IN ('portero', 'defensa', 'mediocentro', 'delantero')),
  matches_played INTEGER NOT NULL DEFAULT 0,
  reliability_score NUMERIC NOT NULL DEFAULT 100,
  average_level NUMERIC NOT NULL DEFAULT 0,
  average_attitude NUMERIC NOT NULL DEFAULT 0,
  matches_archived INTEGER NOT NULL DEFAULT 0,
  attended_archived INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabla de partidos
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  date_time TIMESTAMPTZ NOT NULL,
  max_players INTEGER NOT NULL DEFAULT 10,
  price_per_player NUMERIC DEFAULT 0,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla de participantes por partido
CREATE TABLE IF NOT EXISTS public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('pending', 'approved', 'joined', 'rejected', 'dropped')),
  attended BOOLEAN,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- 4. Tabla de valoraciones post-partido
CREATE TABLE IF NOT EXISTS public.match_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  level_rating INTEGER CHECK (level_rating IS NULL OR (level_rating >= 1 AND level_rating <= 5)),
  attitude_rating INTEGER CHECK (attitude_rating IS NULL OR (attitude_rating >= 1 AND attitude_rating <= 5)),
  attitude TEXT CHECK (attitude IS NULL OR attitude IN ('positive', 'neutral', 'negative')),
  attended BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, reviewer_id, reviewee_id)
);

-- ================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_reviews ENABLE ROW LEVEL SECURITY;

-- Users: cualquiera puede ver perfiles, solo el propio usuario edita el suyo
CREATE POLICY "Users: read all" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users: update own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users: insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Matches: cualquiera las puede ver, solo el organizador las modifica
CREATE POLICY "Matches: read all" ON public.matches FOR SELECT USING (true);
CREATE POLICY "Matches: insert own" ON public.matches FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Matches: update own" ON public.matches FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "Matches: delete own" ON public.matches FOR DELETE USING (auth.uid() = organizer_id);

-- Participants: se ven todos los de un partido, el propio usuario puede insertarse/borrar
CREATE POLICY "Participants: read all" ON public.match_participants FOR SELECT USING (true);
CREATE POLICY "Participants: insert own" ON public.match_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Participants: update by organizer" ON public.match_participants FOR UPDATE
  USING (
    auth.uid() IN (SELECT organizer_id FROM public.matches WHERE id = match_id)
    OR auth.uid() = user_id
  );
CREATE POLICY "Participants: delete own" ON public.match_participants FOR DELETE USING (auth.uid() = user_id);

-- Reviews: solo el organizador del partido puede crearlas, todos pueden leerlas
CREATE POLICY "Reviews: read all" ON public.match_reviews FOR SELECT USING (true);
CREATE POLICY "Reviews: insert by organizer" ON public.match_reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND auth.uid() IN (SELECT organizer_id FROM public.matches WHERE id = match_id)
  );

-- ================================================
-- TRIGGER: Crear perfil automáticamente al registrarse
-- ================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- TRIGGER: Actualizar stats de asistencia del usuario tras review
-- ================================================

CREATE OR REPLACE FUNCTION public.update_user_stats()
RETURNS trigger AS $$
DECLARE
  avg_lvl NUMERIC;
  avg_att NUMERIC;
BEGIN
  -- Solo promediar ratings no-null
  SELECT AVG(level_rating)
  INTO avg_lvl
  FROM public.match_reviews
  WHERE reviewee_id = NEW.reviewee_id
    AND level_rating IS NOT NULL;

  SELECT AVG(
    CASE attitude
      WHEN 'positive' THEN 5
      WHEN 'neutral' THEN 3
      WHEN 'negative' THEN 1
    END
  )
  INTO avg_att
  FROM public.match_reviews
  WHERE reviewee_id = NEW.reviewee_id
    AND attitude IS NOT NULL;

  UPDATE public.users
  SET
    average_level = COALESCE(ROUND(avg_lvl, 1), average_level),
    average_attitude = COALESCE(ROUND(avg_att, 1), average_attitude)
  WHERE id = NEW.reviewee_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_review_created
  AFTER INSERT ON public.match_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_user_stats();

-- ================================================
-- FUNCTION: Actualizar fiabilidad (% asistencia)
-- Incluye partidos archivados para preservar historial completo
-- ================================================

CREATE OR REPLACE FUNCTION public.update_reliability()
RETURNS trigger AS $$
DECLARE
  total INTEGER;
  attended_count INTEGER;
  archived_total INTEGER;
  archived_attended INTEGER;
BEGIN
  -- Participaciones activas (en BD)
  SELECT COUNT(*), COUNT(*) FILTER (WHERE attended = true)
  INTO total, attended_count
  FROM public.match_participants
  WHERE user_id = NEW.user_id AND attended IS NOT NULL;

  -- Participaciones archivadas (de partidos ya eliminados)
  SELECT matches_archived, attended_archived
  INTO archived_total, archived_attended
  FROM public.users
  WHERE id = NEW.user_id;

  IF (total + COALESCE(archived_total, 0)) > 0 THEN
    UPDATE public.users
    SET
      reliability_score = ROUND(
        ((attended_count + COALESCE(archived_attended, 0))::NUMERIC /
         (total + COALESCE(archived_total, 0))::NUMERIC) * 100, 1
      ),
      matches_played = total + COALESCE(archived_total, 0)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_attendance_updated
  AFTER UPDATE OF attended ON public.match_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_reliability();

-- ================================================
-- 5. Tabla de mensajes de chat
-- ================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- ROW LEVEL SECURITY (RLS) FOR CHAT
-- ================================================

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chats: read own match chats" ON public.chat_messages
FOR SELECT USING (
  auth.uid() = player_id OR 
  auth.uid() IN (SELECT organizer_id FROM public.matches WHERE id = match_id)
);

CREATE POLICY "Chats: insert own match chats" ON public.chat_messages
FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  (
    auth.uid() = player_id OR
    auth.uid() IN (SELECT organizer_id FROM public.matches WHERE id = match_id)
  )
);

CREATE POLICY "Chats: update is_read" ON public.chat_messages
FOR UPDATE USING (
  auth.uid() = player_id OR
  auth.uid() IN (SELECT organizer_id FROM public.matches WHERE id = match_id)
) WITH CHECK (
  auth.uid() = player_id OR
  auth.uid() IN (SELECT organizer_id FROM public.matches WHERE id = match_id)
);

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;

-- ================================================
-- TRIGGER: Eliminar mensajes al finalizar/cancelar un partido
-- ================================================

CREATE OR REPLACE FUNCTION public.delete_chats_on_match_end()
RETURNS trigger AS $$
BEGIN
  IF (NEW.status = 'completed' OR NEW.status = 'cancelled') AND
     (OLD.status IS DISTINCT FROM NEW.status) THEN
    DELETE FROM public.chat_messages WHERE match_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_match_ended
  AFTER UPDATE OF status ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.delete_chats_on_match_end();

-- ================================================
-- REALTIME: Habilitar para chat_messages
-- ================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- ================================================
-- RPC: Obtener hilos de chat del usuario actual
-- ================================================

CREATE OR REPLACE FUNCTION get_user_chat_threads()
RETURNS TABLE (
  match_id UUID,
  player_id UUID,
  organizer_id UUID,
  match_title TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  sender_id UUID,
  is_read BOOLEAN,
  other_user_name TEXT,
  other_user_avatar TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH thread_latest AS (
    SELECT 
      c.match_id, 
      c.player_id, 
      c.content, 
      c.created_at, 
      c.sender_id, 
      c.is_read,
      ROW_NUMBER() OVER (PARTITION BY c.match_id, c.player_id ORDER BY c.created_at DESC) as rn
    FROM public.chat_messages c
    WHERE c.player_id = auth.uid()
       OR c.match_id IN (SELECT m.id FROM public.matches m WHERE m.organizer_id = auth.uid())
  )
  SELECT 
    t.match_id,
    t.player_id,
    m.organizer_id,
    m.title AS match_title,
    t.content AS last_message,
    t.created_at AS last_message_at,
    t.sender_id,
    t.is_read,
    u.full_name AS other_user_name,
    u.avatar_url AS other_user_avatar
  FROM thread_latest t
  JOIN public.matches m ON m.id = t.match_id
  JOIN public.users u ON u.id = CASE WHEN auth.uid() = t.player_id THEN m.organizer_id ELSE t.player_id END
  WHERE t.rn = 1
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================
-- FUNCTION: Limpiar partidos antiguos (> 2 años)
-- Preserva estadísticas acumulando historial en users
-- ================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_matches()
RETURNS TABLE(deleted_matches_count INTEGER, affected_users_count INTEGER) AS $$
DECLARE
  match_count INTEGER;
  user_count INTEGER;
BEGIN
  -- Contar partidos y usuarios afectados
  SELECT COUNT(*) INTO match_count
  FROM public.matches
  WHERE date_time < (now() - interval '2 years');

  SELECT COUNT(DISTINCT mp.user_id) INTO user_count
  FROM public.match_participants mp
  JOIN public.matches m ON m.id = mp.match_id
  WHERE m.date_time < (now() - interval '2 years')
    AND mp.attended IS NOT NULL;

  -- Paso 1: Acumular historial en users ANTES de borrar
  UPDATE public.users u
  SET
    matches_archived  = u.matches_archived  + sub.total,
    attended_archived = u.attended_archived + sub.attended_count
  FROM (
    SELECT
      mp.user_id,
      COUNT(*)                                   AS total,
      COUNT(*) FILTER (WHERE mp.attended = true) AS attended_count
    FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE m.date_time < (now() - interval '2 years')
      AND mp.attended IS NOT NULL
    GROUP BY mp.user_id
  ) sub
  WHERE u.id = sub.user_id;

  -- Paso 2: Eliminar partidos (CASCADE elimina participantes y mensajes)
  DELETE FROM public.matches
  WHERE date_time < (now() - interval '2 years');

  -- Paso 3: Recalcular reliability_score y matches_played con historial preservado
  UPDATE public.users u
  SET
    matches_played    = COALESCE(active.total, 0) + u.matches_archived,
    reliability_score = CASE
      WHEN (COALESCE(active.total, 0) + u.matches_archived) = 0 THEN 100
      ELSE ROUND(
        ((COALESCE(active.attended, 0) + u.attended_archived)::NUMERIC /
         (COALESCE(active.total, 0) + u.matches_archived)::NUMERIC) * 100, 1
      )
    END
  FROM (
    SELECT
      mp.user_id,
      COUNT(*)                                   AS total,
      COUNT(*) FILTER (WHERE mp.attended = true) AS attended
    FROM public.match_participants mp
    WHERE mp.attended IS NOT NULL
    GROUP BY mp.user_id
  ) active
  WHERE u.id = active.user_id
    AND u.matches_archived > 0;

  RETURN QUERY SELECT match_count, user_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread message count specifically
CREATE OR REPLACE FUNCTION get_unread_count()
RETURNS INTEGER AS $$
DECLARE
  count_result INTEGER;
BEGIN
  SELECT count(*)::INTEGER INTO count_result
  FROM public.chat_messages
  WHERE is_read = false
    AND sender_id != auth.uid()
    AND (
      player_id = auth.uid() OR
      match_id IN (SELECT id FROM public.matches WHERE organizer_id = auth.uid())
    );
  RETURN count_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
