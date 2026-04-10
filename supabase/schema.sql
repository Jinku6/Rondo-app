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
-- Se ejecuta cuando el organizador marca asistencia
-- ================================================

CREATE OR REPLACE FUNCTION public.update_reliability()
RETURNS trigger AS $$
DECLARE
  total INTEGER;
  attended_count INTEGER;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE attended = true)
  INTO total, attended_count
  FROM public.match_participants
  WHERE user_id = NEW.user_id AND attended IS NOT NULL;

  IF total > 0 THEN
    UPDATE public.users
    SET
      reliability_score = ROUND((attended_count::NUMERIC / total::NUMERIC) * 100, 1),
      matches_played = total
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_attendance_updated
  AFTER UPDATE OF attended ON public.match_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_reliability();
